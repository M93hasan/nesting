use jagua_rs::Instant;
use jagua_rs::io::import::Importer;
use jagua_rs::io::ext_repr::{ExtLayout, ExtPlacedItem, ExtRotation, ExtShape, ExtTransformation};
use jagua_rs::probs::spp::entities::SPSolution;
use jagua_rs::probs::spp::io::{export, ext_repr::{ExtSPInstance, ExtSPSolution}, import_instance, import_solution};
use rand::{SeedableRng, rngs::Xoshiro256PlusPlus};
use serde_json::{json, Value};
use sparrow::config::{DEFAULT_SPARROW_CONFIG, ShrinkDecayStrategy, SparrowConfig};

use sparrow::optimizer::{lbf::ConstructionError, optimize};
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

fn normalize_external_input(input: &str, fallback_clearance: f32) -> Result<ExtSPInstance, JsValue> {
    let mut value: Value = serde_json::from_str(input)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let root = value.as_object_mut()
        .ok_or_else(|| JsValue::from_str("Sparrow input must be a JSON object"))?;
    if !root.contains_key("min_item_separation") {
        root.insert("min_item_separation".into(), json!(fallback_clearance));
    }
    let items = root.get_mut("items")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| JsValue::from_str("Sparrow input must contain an items array"))?;
    for item in items {
        let object = item.as_object_mut()
            .ok_or_else(|| JsValue::from_str("Sparrow item must be an object"))?;
        if !object.contains_key("orientation") {
            let legacy = object.remove("allowed_orientations");
            let rotation = match legacy {
                Some(Value::Array(angles)) => json!({"mode":"discrete","angles":angles}),
                Some(Value::Null) | None => json!({"mode":"continuous"}),
                Some(_) => return Err(JsValue::from_str("allowed_orientations must be an array, null, or omitted")),
            };
            object.insert("orientation".into(), json!({"rotation":rotation}));
        } else if object.contains_key("allowed_orientations") {
            return Err(JsValue::from_str("Do not mix legacy allowed_orientations with orientation.rotation"));
        }
    }
    serde_json::from_value(value).map_err(|e| JsValue::from_str(&e.to_string()))
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

#[derive(Clone)]
struct WarmItem {
    item_id: u64,
    angle: f32,
    bbox: (f32, f32, f32, f32),
    width: f32,
    height: f32,
}

struct WarmColumn {
    items: Vec<WarmItem>,
    used_height: f32,
    width: f32,
}

fn safe_warm_start(external: &ExtSPInstance, clearance: f32) -> Result<ExtSPSolution, String> {
    let edge = clearance + WARM_START_EPS_MM;
    let gap = clearance + WARM_START_EPS_MM;
    let usable_height = external.strip_height - 2.0 * edge;
    if usable_height <= 0.0 {
        return Err("material width leaves no interior room after clearance".into());
    }

    let mut copies = Vec::new();
    for item in &external.items {
        let points = shape_points(&item.base.shape);
        if points.is_empty() {
            return Err(format!("item {} has no usable outline", item.base.id));
        }
        let angles = match &item.base.orientation.rotation {
            ExtRotation::Continuous {} => vec![0.0, 90.0, 180.0, 270.0],
            ExtRotation::Discrete { angles } => angles.clone(),
            ExtRotation::Stepped { step } => {
                let count = (360.0 / *step).round().max(1.0) as usize;
                (0..count).map(|i| i as f32 * 360.0 / count as f32).collect()
            }
        };
        let mut best: Option<WarmItem> = None;
        for angle in angles {
            let Some(bbox) = rotated_bounds(&points, angle) else { continue; };
            let width = bbox.2 - bbox.0;
            let height = bbox.3 - bbox.1;
            if height > usable_height + 1e-4 || width <= 0.0 || height <= 0.0 { continue; }
            let candidate = WarmItem { item_id: item.base.id, angle, bbox, width, height };
            let candidate_box_area = width * height;
            let better = best.as_ref().is_none_or(|current| {
                let current_box_area = current.width * current.height;
                candidate_box_area < current_box_area - 1e-4
                    || ((candidate_box_area - current_box_area).abs() <= 1e-4 && width < current.width)
            });
            if better { best = Some(candidate); }
        }
        let Some(best) = best else {
            return Err(format!("item {} cannot fit the material width in its allowed rotations", item.base.id));
        };
        copies.extend(std::iter::repeat_n(best, item.demand as usize));
    }

    // First-fit decreasing on the fixed strip height gives Sparrow a compact,
    // collision-free seed. It is only an initial state: exploration and
    // compression are still free to move every copy afterwards.
    copies.sort_by(|a, b| b.height.total_cmp(&a.height).then_with(|| b.width.total_cmp(&a.width)));
    let mut columns: Vec<WarmColumn> = Vec::new();
    for copy in copies {
        let best_column = columns.iter().enumerate()
            .filter_map(|(index, column)| {
                let needed = if column.items.is_empty() { copy.height } else { gap + copy.height };
                (column.used_height + needed <= usable_height + 1e-4)
                    .then_some((index, usable_height - column.used_height - needed))
            })
            .min_by(|a, b| a.1.total_cmp(&b.1))
            .map(|(index, _)| index);
        if let Some(index) = best_column {
            let column = &mut columns[index];
            column.used_height += gap + copy.height;
            column.width = column.width.max(copy.width);
            column.items.push(copy);
        } else {
            columns.push(WarmColumn { used_height: copy.height, width: copy.width, items: vec![copy] });
        }
    }

    let mut placed_items = Vec::new();
    let mut x = edge;
    for column in &columns {
        let mut y = edge;
        for copy in &column.items {
            placed_items.push(ExtPlacedItem {
                item_id: copy.item_id,
                transformation: ExtTransformation {
                    reflected: false,
                    rotation: copy.angle,
                    translation: (x - copy.bbox.0, y - copy.bbox.1),
                },
            });
            y += copy.height + gap;
        }
        x += column.width + gap;
    }
    let strip_width = (x - gap + edge).max(edge * 2.0);
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

    fn report(&mut self, report: ReportType, solution: &SPSolution) {
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
            "solution": export(solution, self.initialized_at)}));
    }
}

/// The worker validates normalized geometry before crossing the WASM boundary.
#[wasm_bindgen]
pub fn run(input: &str, seconds: Option<u32>, seed: &str, clearance: f32, preset: &str, callback: js_sys::Function, interrupt: Option<js_sys::Function>) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    logging::init();
    let initialized_at = Instant::now();
    if seconds.is_some_and(|seconds| !(5..=600).contains(&seconds)) || input.len() > 10 * 1024 * 1024 || !clearance.is_finite() || clearance < 0.0 {
        return Err(JsValue::from_str("Invalid duration or oversized input"));
    }
    let seed = seed.parse::<u64>().map_err(|e| JsValue::from_str(&e.to_string()))?;
    let external = normalize_external_input(input, clearance)?;
    if !external.strip_height.is_finite() || !external.min_item_separation.is_finite()
        || external.min_item_separation < 0.0 || external.strip_height <= external.min_item_separation
        || external.strip_height > 100_000.0 || external.items.is_empty() || external.items.len() > 500
        || external.items.iter().any(|item| item.demand == 0 || item.demand > 500)
        || external.items.iter().map(|item| item.demand).sum::<u64>() > 500 {
        return Err(JsValue::from_str("Invalid strip dimensions or demand"));
    }
    let config = solver_config(preset, thread_count(), seconds).map_err(JsValue::from_str)?;
    callback.call1(&JsValue::NULL, &JsValue::from_str(&json!({
        "type": "configuration",
        "configuration": format!("{config:#?}\nmin_item_separation: {}", external.min_item_separation)
    }).to_string())).expect("worker callback must accept solver messages");
    let importer = Importer::new(config.cde_config, config.poly_simpl_tolerance, config.narrow_concavity_cutoff_ratio);
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
            let Some(construction) = error.downcast_ref::<ConstructionError>() else {
                return Err(JsValue::from_str(&error.to_string()));
            };
            let item_id = construction.external_id;
            let warm_external = safe_warm_start(&external, external.min_item_separation).map_err(|reason|
                JsValue::from_str(&format!(
                    "No valid initial placement could be constructed for item {item_id}. Warm-start fallback also failed: {reason}."
                )))?;
            let warm_solution = import_solution(&instance, &warm_external)
                .map_err(|e| JsValue::from_str(&format!("Warm-start import failed: {e}")))?;
            listener.send(json!({"type":"solver-log","line":format!(
                "Warm-start recovery: initial constructor rejected item {item_id}; all copies remain in Sparrow optimization."
            ),"timestamp":js_sys::Date::now()}));
            optimize(instance.clone(), Xoshiro256PlusPlus::seed_from_u64(seed ^ 0x9E3779B97F4A7C15), &mut listener,
                &mut terminator, &config.expl_cfg, &config.cmpr_cfg, Some(&warm_solution))
            .map_err(|warm_error| JsValue::from_str(&format!(
                "Warm-start optimization failed after initial placement error on item {item_id}: {warm_error}"
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
    match preset {
        "standard" => {
            // Quality mode follows Sparrow 0.3's non-early-terminating exploration,
            // then gives Compression enough iterations to actually tighten footwear layouts.
            config.expl_cfg.max_conseq_failed_attempts = None;
            config.cmpr_cfg.shrink_decay = ShrinkDecayStrategy::TimeBased;
            config.cmpr_cfg.separator_config.iter_no_imprv_limit =
                config.cmpr_cfg.separator_config.iter_no_imprv_limit.max(150);
            config.cmpr_cfg.separator_config.strike_limit =
                config.cmpr_cfg.separator_config.strike_limit.max(6);
        },
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
        let exploration_ratio = if preset == "standard" { 0.5 } else { 0.8 };
        config.expl_cfg.time_limit = Duration::from_secs_f64(seconds as f64 * exploration_ratio);
        config.cmpr_cfg.time_limit = Duration::from_secs_f64(seconds as f64 * (1.0 - exploration_ratio));
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
