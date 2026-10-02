use jagua_rs::Instant;
use jagua_rs::io::import::Importer;
use jagua_rs::io::ext_repr::{ExtLayout, ExtPlacedItem, ExtShape, ExtTransformation};
use jagua_rs::probs::spp::entities::{SPInstance, SPSolution};
use jagua_rs::probs::spp::io::{export, ext_repr::{ExtSPInstance, ExtSPSolution}, import_instance, import_solution};
use rand::{SeedableRng, rngs::Xoshiro256PlusPlus};
use serde_json::json;
use sparrow::config::{DEFAULT_SPARROW_CONFIG, ShrinkDecayStrategy, SparrowConfig};
use sparrow::consts::{DEFAULT_FAIL_DECAY_RATIO_CMPR, DEFAULT_MAX_CONSEQ_FAILS_EXPL};
use sparrow::optimizer::optimize;
use sparrow::util::listener::{OptimizationPhase, ReportType, SolutionListener};
use sparrow::util::terminator::{BasicTerminator, Terminator};
use std::time::Duration;
use wasm_bindgen::prelude::*;

#[cfg(feature = "threads")]
pub use wasm_bindgen_rayon::init_thread_pool;

#[wasm_bindgen]
pub fn thread_count() -> usize {
    #[cfg(feature = "threads")]
    { rayon::current_num_threads() }
    #[cfg(not(feature = "threads"))]
    { 1 }
}

mod svg;
mod logging;

#[cfg(feature = "benchmark")]
pub mod benchmark;

#[cfg(test)]
mod tests;

struct Listener {
    callback: js_sys::Function,
    initialized_at: Instant,
    solve_started_at: Option<Instant>,
    sequence: u32,
    last_snapshot: Option<Instant>,
    exploration_workers: usize,
    compression_workers: usize,
}

impl Listener {
    fn send(&self, value: serde_json::Value) {
        self.callback.call1(&JsValue::NULL, &JsValue::from_str(&value.to_string()))
            .expect("worker callback must accept solver messages");
    }
}

const WARM_START_EPS_MM: f32 = 0.01;

fn shape_points(shape: &ExtShape) -> Vec<(f32, f32)> {
    match shape {
        ExtShape::Rectangle { x_min, y_min, width, height } => vec![
            (*x_min, *y_min),
            (*x_min + *width, *y_min),
            (*x_min + *width, *y_min + *height),
            (*x_min, *y_min + *height),
        ],
        ExtShape::SimplePolygon(poly) => poly.0.clone(),
        ExtShape::Polygon(poly) => poly.outer.0.clone(),
        ExtShape::MultiPolygon(polys) => polys.iter().flat_map(|poly| poly.outer.0.iter().copied()).collect(),
    }
}

fn rotated_bounds(points: &[(f32, f32)], angle_deg: f32) -> Option<(f32, f32, f32, f32)> {
    if points.is_empty() || !angle_deg.is_finite() { return None; }
    let angle = angle_deg.to_radians();
    let (c, s) = (angle.cos(), angle.sin());
    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    for &(x, y) in points {
        let rx = x * c - y * s;
        let ry = x * s + y * c;
        min_x = min_x.min(rx);
        min_y = min_y.min(ry);
        max_x = max_x.max(rx);
        max_y = max_y.max(ry);
    }
    [min_x, min_y, max_x, max_y].iter().all(|v| v.is_finite())
        .then_some((min_x, min_y, max_x, max_y))
}

fn safe_warm_start(external: &ExtSPInstance, clearance: f32) -> Result<ExtSPSolution, String> {
    let edge = clearance + WARM_START_EPS_MM;
    let usable_height = external.strip_height - 2.0 * edge;
    if usable_height <= 0.0 {
        return Err("material width leaves no interior room after clearance".into());
    }
    let mut cursor = edge;
    let mut placed_items = Vec::new();

    for item in &external.items {
        let points = shape_points(&item.base.shape);
        if points.is_empty() {
            return Err(format!("item {} has no usable outline", item.base.id));
        }
        let angles = item.base.allowed_orientations.clone()
            .unwrap_or_else(|| vec![0.0, 90.0, 180.0, 270.0]);
        let mut best: Option<(f32, (f32, f32, f32, f32))> = None;
        for angle in angles {
            let Some(bbox) = rotated_bounds(&points, angle) else { continue; };
            let width = bbox.2 - bbox.0;
            let height = bbox.3 - bbox.1;
            if height <= usable_height + 1e-4 && width > 0.0 {
                if best.as_ref().is_none_or(|(_, current)| width < current.2 - current.0) {
                    best = Some((angle, bbox));
                }
            }
        }
        let Some((angle, bbox)) = best else {
            return Err(format!("item {} cannot fit the material width in its allowed rotations", item.base.id));
        };
        let width = bbox.2 - bbox.0;
        for _ in 0..item.demand {
            placed_items.push(ExtPlacedItem {
                item_id: item.base.id,
                transformation: ExtTransformation {
                    rotation: angle,
                    translation: (cursor - bbox.0, edge - bbox.1),
                },
            });
            cursor += width + clearance + WARM_START_EPS_MM;
        }
    }

    let strip_width = (cursor - clearance - WARM_START_EPS_MM + edge).max(edge * 2.0);
    Ok(ExtSPSolution {
        strip_width,
        layout: ExtLayout { container_id: 0, placed_items, density: 0.0 },
        density: 0.0,
        run_time_sec: 0,
    })
}

impl SolutionListener for Listener {
    fn report_phase(&mut self, phase: OptimizationPhase) {
        let now = Instant::now();
        self.solve_started_at.get_or_insert(now);
        self.send(json!({"type": "phase", "phase": format!("{phase:?}"),
            "workers": match phase { OptimizationPhase::Exploration => self.exploration_workers, OptimizationPhase::Compression => self.compression_workers },
            "initializationMs": self.solve_started_at.unwrap().duration_since(self.initialized_at).as_secs_f64() * 1000.0}));
    }

    fn report(&mut self, report: ReportType, solution: &SPSolution, instance: &SPInstance) {
        let feasible = matches!(report, ReportType::ExplFeas | ReportType::CmprFeas | ReportType::Final);
        let now = Instant::now();
        // Throttle live serialization at the source; always deliver feasible results.
        if !feasible && self.last_snapshot.is_some_and(|last| now.duration_since(last) < Duration::from_millis(100)) {
            return;
        }
        self.last_snapshot = Some(now);
        self.sequence += 1;
        self.send(json!({"type": if feasible { "candidate" } else { "live" }, "sequence": self.sequence,
            "report": format!("{report:?}"),
            "elapsedMs": self.solve_started_at.unwrap_or(self.initialized_at).elapsed().as_secs_f64() * 1000.0,
            "solution": export(instance, solution, self.initialized_at)}));
    }
}

/// The worker validates normalized geometry before crossing the WASM boundary.
#[wasm_bindgen]
pub fn run(input: &str, seconds: Option<u32>, seed: &str, clearance: f32, preset: &str, callback: js_sys::Function, interrupt: Option<js_sys::Function>) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    logging::init();
    let initialized_at = Instant::now();
    if !matches!(seconds, None | Some(10 | 30 | 60 | 120 | 300 | 600)) || input.len() > 10 * 1024 * 1024 || !clearance.is_finite() || clearance < 0.0 {
        return Err(JsValue::from_str("Invalid duration or oversized input"));
    }
    let seed = seed.parse::<u64>().map_err(|e| JsValue::from_str(&e.to_string()))?;
    let external: ExtSPInstance = serde_json::from_str(input)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    if !external.strip_height.is_finite() || external.strip_height <= clearance || external.strip_height > 100_000.0
        || external.items.is_empty() || external.items.len() > 500
        || external.items.iter().any(|item| item.demand == 0 || item.demand > 500)
        || external.items.iter().map(|item| item.demand).sum::<u64>() > 500 {
        return Err(JsValue::from_str("Invalid strip dimensions or demand"));
    }
    let mut config = solver_config(preset, thread_count(), seconds).map_err(JsValue::from_str)?;
    config.min_item_separation = (clearance > 0.0).then_some(clearance);
    callback.call1(&JsValue::NULL, &JsValue::from_str(&json!({
        "type": "configuration", "configuration": format!("{config:#?}")
    }).to_string())).expect("worker callback must accept solver messages");
    let importer = Importer::new(config.cde_config, config.poly_simpl_tolerance, config.min_item_separation, config.narrow_concavity_cutoff_ratio);
    let instance = import_instance(&importer, &external)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut listener = Listener { callback, initialized_at, solve_started_at: None, sequence: 0, last_snapshot: None,
        exploration_workers: config.expl_cfg.separator_config.n_workers,
        compression_workers: config.cmpr_cfg.separator_config.n_workers };
    let mut terminator = WebTerminator { timed: seconds.is_some(), inner: BasicTerminator::new(), interrupt };
    let solution = match optimize(instance.clone(), Xoshiro256PlusPlus::seed_from_u64(seed), &mut listener,
        &mut terminator, &config.expl_cfg, &config.cmpr_cfg, None) {
        Ok(solution) => solution,
        Err(error) => {
            let warm_external = safe_warm_start(&external, clearance).map_err(|reason|
                JsValue::from_str(&format!(
                    "No valid initial placement could be constructed for item {}. Warm-start fallback also failed: {reason}.",
                    error.item_id
                )))?;
            let warm_solution = import_solution(&instance, &warm_external);
            listener.send(json!({"type":"solver-log","line":format!(
                "Warm-start recovery: initial constructor rejected item {}; all copies remain in Sparrow optimization.",
                error.item_id
            ),"timestamp":js_sys::Date::now()}));
            optimize(instance.clone(), Xoshiro256PlusPlus::seed_from_u64(seed ^ 0x9E3779B97F4A7C15), &mut listener,
                &mut terminator, &config.expl_cfg, &config.cmpr_cfg, Some(&warm_solution))
            .map_err(|warm_error| JsValue::from_str(&format!(
                "Warm-start optimization failed after initial placement error on item {}: {}",
                error.item_id, warm_error
            )))?
        }
    };
    // Keep the final solution alive through the last listener report in optimize.
    let _ = solution;
    listener.send(json!({"type": "finished"}));
    Ok(())
}

// Fast search values imported from sparrow_extended/src/config.rs (FAST_SPARROW_CONFIG).
// Keep sparrow's geometry optimizations, user clearance and stop-condition controls.
fn solver_config(preset: &str, workers: usize, seconds: Option<u32>) -> Result<SparrowConfig, &'static str> {
    let mut config = DEFAULT_SPARROW_CONFIG;
    config.expl_cfg.max_conseq_failed_attempts = Some(DEFAULT_MAX_CONSEQ_FAILS_EXPL);
    config.cmpr_cfg.shrink_decay = ShrinkDecayStrategy::FailureBased(DEFAULT_FAIL_DECAY_RATIO_CMPR);
    match preset {
        "standard" => {},
        "fast" => {
            config.expl_cfg.shrink_step = 0.01;
            config.expl_cfg.max_conseq_failed_attempts = Some(10);
            config.expl_cfg.separator_config.iter_no_imprv_limit = 50;
            config.expl_cfg.separator_config.strike_limit = 2;
            config.expl_cfg.separator_config.n_workers = 2;
            config.cmpr_cfg.shrink_range = (0.0005, 0.0001);
            config.cmpr_cfg.shrink_decay = ShrinkDecayStrategy::FailureBased(0.9);
            config.cmpr_cfg.separator_config.iter_no_imprv_limit = 50;
            config.cmpr_cfg.separator_config.strike_limit = 2;
            config.cde_config.cd_threshold = 16;
        },
        _ => return Err("Invalid solver preset"),
    }
    config.expl_cfg.separator_config.n_workers = config.expl_cfg.separator_config.n_workers.min(workers);
    config.cmpr_cfg.separator_config.n_workers = config.cmpr_cfg.separator_config.n_workers.min(workers);
    if let Some(seconds) = seconds {
        config.expl_cfg.time_limit = Duration::from_secs_f64(seconds as f64 * 0.8);
        config.cmpr_cfg.time_limit = Duration::from_secs_f64(seconds as f64 * 0.2);
    }
    Ok(config)
}

// Automatic runs rely on the optimizer's failure-based stopping rules.
// The supervising worker handles manual Stop by terminating the runtime.
struct WebTerminator {
    timed: bool,
    inner: BasicTerminator,
    interrupt: Option<js_sys::Function>,
}

impl Terminator for WebTerminator {
    fn kill(&self) -> bool {
        self.inner.kill() || self.interrupt.as_ref().is_some_and(|signal|
            signal.call1(&JsValue::NULL, &JsValue::FALSE)
                .expect("worker must read the phase interrupt").as_bool().unwrap_or(false))
    }
    fn new_timeout(&mut self, timeout: Duration) {
        if let Some(signal) = &self.interrupt {
            signal.call1(&JsValue::NULL, &JsValue::TRUE).expect("worker must reset the phase interrupt");
        }
        if self.timed { self.inner.new_timeout(timeout); }
    }
    fn timeout_at(&self) -> Option<Instant> { self.inner.timeout_at() }
}
