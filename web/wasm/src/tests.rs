use super::*;
use sparrow::consts::LBF_SAMPLE_CONFIG;
use sparrow::optimizer::lbf::LBFBuilder;

fn rectangle_input(clearance:f32,demand:u64,height:f32) -> ExtSPInstance {
    serde_json::from_value(json!({
        "name":"rectangles",
        "strip_height":height,
        "min_item_separation":clearance,
        "items":[{
            "id":0,
            "demand":demand,
            "orientation":{"rotation":{"mode":"discrete","angles":[0.0]}},
            "shape":{"type":"rectangle","data":{"x_min":0.0,"y_min":0.0,"width":10.0,"height":10.0}}
        }]
    })).unwrap()
}

#[test]
fn automatic_runs_ignore_phase_timeouts_but_timed_runs_keep_them() {
    let mut automatic = WebTerminator {
        timed: false,
        inner: BasicTerminator::new(),
        interrupt: None,
    };
    automatic.new_timeout(Duration::ZERO);
    assert_eq!(automatic.timeout_at(), None);
    assert!(!automatic.kill());

    let mut timed = WebTerminator {
        timed: true,
        inner: BasicTerminator::new(),
        interrupt: None,
    };
    timed.new_timeout(Duration::from_secs(10));
    assert!(timed.timeout_at().is_some());
    assert!(!timed.kill());
}

#[test]
fn legacy_orientation_json_is_upgraded_without_relaxing_angles() {
    let input = r#"{
      "name":"legacy","strip_height":100,
      "items":[{"id":7,"demand":1,"allowed_orientations":[0,180],
        "shape":{"type":"rectangle","data":{"x_min":0,"y_min":0,"width":10,"height":10}}}]
    }"#;
    let parsed = normalize_external_input(input, 0.3).unwrap();
    assert!((parsed.min_item_separation - 0.3).abs() < 1e-6);
    match &parsed.items[0].base.orientation.rotation {
        ExtRotation::Discrete { angles } => assert_eq!(angles, &vec![0.0,180.0]),
        other => panic!("unexpected rotation mode: {other:?}"),
    }
}

#[test]
fn jagua_uses_clearance_from_native_input() {
    let input = rectangle_input(2.0, 2, 16.0);
    let epoch = Instant::now();
    let importer = Importer::new(DEFAULT_SPARROW_CONFIG.cde_config, None, None);
    let instance = import_instance(&importer, &input).unwrap();
    let builder = LBFBuilder::new(
        instance,
        Xoshiro256PlusPlus::seed_from_u64(42),
        LBF_SAMPLE_CONFIG,
    ).unwrap().construct().unwrap();
    let solution = export(&builder.prob.save(), epoch);
    let mut positions: Vec<_> = solution.layout.placed_items.iter()
        .map(|p| p.transformation.translation).collect();
    positions.sort_by(|a,b| a.0.total_cmp(&b.0));
    let gap = positions[1].0 - positions[0].0 - 10.0;
    let edge = positions.iter()
        .map(|p| p.1.min(16.0 - p.1 - 10.0))
        .fold(f32::INFINITY, f32::min);
    assert!((2.0 - 1e-3..2.1).contains(&gap), "gap={gap}, positions={positions:?}");
    assert!((2.0 - 1e-3..2.1).contains(&edge), "edge={edge}, positions={positions:?}");
}

#[test]
fn fast_preset_keeps_compression_enabled_and_respects_worker_limit() {
    let fast = solver_config("fast", 3, None).unwrap();
    assert_eq!(fast.expl_cfg.shrink_step, 0.01);
    assert_eq!(fast.expl_cfg.max_conseq_failed_attempts, Some(10));
    assert_eq!(fast.expl_cfg.separator_config.iter_no_imprv_limit, 50);
    assert_eq!(fast.expl_cfg.separator_config.strike_limit, 2);
    assert_eq!(fast.expl_cfg.separator_config.n_workers, 2);
    assert_eq!(fast.cmpr_cfg.separator_config.n_workers, 3);
    assert_eq!(fast.cmpr_cfg.shrink_range, (0.0005, 0.0001));
    assert!(matches!(fast.cmpr_cfg.shrink_decay, ShrinkDecayStrategy::FailureBased(0.9)));
    assert_eq!(fast.cmpr_cfg.separator_config.iter_no_imprv_limit, 50);
    assert_eq!(fast.cmpr_cfg.separator_config.strike_limit, 2);
    assert_eq!(fast.cde_config.cd_threshold, 16);

    let serial = solver_config("fast", 1, Some(300)).unwrap();
    assert_eq!(serial.expl_cfg.separator_config.n_workers, 1);
    assert_eq!(serial.cmpr_cfg.separator_config.n_workers, 1);
    assert_eq!(serial.expl_cfg.time_limit, Duration::from_secs(240));
    assert_eq!(serial.cmpr_cfg.time_limit, Duration::from_secs(60));

    let standard = solver_config("standard", 3, None).unwrap();
    assert_eq!(standard.expl_cfg.shrink_step, DEFAULT_SPARROW_CONFIG.expl_cfg.shrink_step);
    assert_eq!(
        standard.cmpr_cfg.separator_config.strike_limit,
        DEFAULT_SPARROW_CONFIG.cmpr_cfg.separator_config.strike_limit
    );
    assert!(solver_config("unknown", 3, None).is_err());
}

#[test]
fn standard_quality_gives_compression_half_the_budget_and_avoids_early_stop() {
    let quality = solver_config("standard", 3, Some(30)).unwrap();
    assert_eq!(quality.expl_cfg.time_limit, Duration::from_secs(15));
    assert_eq!(quality.cmpr_cfg.time_limit, Duration::from_secs(15));
    assert_eq!(quality.expl_cfg.max_conseq_failed_attempts, None);
    assert!(matches!(quality.cmpr_cfg.shrink_decay, ShrinkDecayStrategy::TimeBased));
    assert!(quality.cmpr_cfg.separator_config.iter_no_imprv_limit >= 150);
    assert!(quality.cmpr_cfg.separator_config.strike_limit >= 6);
}

#[test]
fn exact_physical_width_is_feasible_through_the_solver_edge_envelope() {
    let clearance = 0.3;
    let edge_slack = WARM_START_EPS_MM;
    let physical_width = 100.0;
    let input: ExtSPInstance = serde_json::from_value(json!({
        "name":"exact physical width",
        "strip_height":physical_width + 2.0 * (clearance + edge_slack),
        "min_item_separation":clearance,
        "items":[{
            "id":0,
            "demand":1,
            "orientation":{"rotation":{"mode":"discrete","angles":[0.0,180.0]}},
            "shape":{"type":"rectangle","data":{"x_min":0.0,"y_min":0.0,"width":20.0,"height":physical_width}}
        }]
    })).unwrap();
    let warm = safe_warm_start(&input, input.min_item_separation).unwrap();
    let importer = Importer::new(DEFAULT_SPARROW_CONFIG.cde_config, None, None);
    let instance = import_instance(&importer, &input).unwrap();
    let solution = import_solution(&instance, &warm).unwrap();
    let mut prob = jagua_rs::probs::spp::entities::SPProblem::new(instance).unwrap();
    prob.restore(&solution);
    assert!(prob.layout().is_collision_free());
}

#[test]
fn safe_warm_start_keeps_every_copy_and_restricted_rotation() {
    let input: ExtSPInstance = serde_json::from_value(json!({
        "name":"warm",
        "strip_height":1400.0,
        "min_item_separation":0.3,
        "items":[{
            "id":0,
            "demand":3,
            "orientation":{"rotation":{"mode":"discrete","angles":[0.0,180.0]}},
            "shape":{"type":"rectangle","data":{"x_min":0.0,"y_min":0.0,"width":320.0,"height":274.0}}
        }]
    })).unwrap();
    let warm = safe_warm_start(&input, input.min_item_separation).unwrap();
    assert_eq!(warm.layout.placed_items.len(), 3);
    assert!(warm.layout.placed_items.iter().all(|p| !p.transformation.reflected));
    assert!(warm.layout.placed_items.iter().all(|p| [0.0,180.0].contains(&p.transformation.rotation)));
    assert!(warm.strip_width > 320.0 && warm.strip_width < 400.0);
}

#[test]
fn safe_warm_start_never_invents_a_rotation_that_does_not_fit() {
    let input: ExtSPInstance = serde_json::from_value(json!({
        "name":"too tall",
        "strip_height":1400.0,
        "min_item_separation":0.3,
        "items":[{
            "id":0,
            "demand":1,
            "orientation":{"rotation":{"mode":"discrete","angles":[0.0,180.0]}},
            "shape":{"type":"rectangle","data":{"x_min":0.0,"y_min":0.0,"width":100.0,"height":1500.0}}
        }]
    })).unwrap();
    assert!(safe_warm_start(&input, input.min_item_separation).unwrap_err().contains("allowed rotations"));
}
