use assert_cmd::Command;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

#[test]
fn native_rack_geometry_replaces_stale_regex_positions_with_live_widget_centers() {
    let temporary = tempfile::tempdir().expect("temporary directory should exist");
    let geometry = temporary.path().join("geometry.tsv");
    fs::write(
        &geometry,
        concat!(
            "Panel\tpanel\t-1\t45\t190\t90\t380\tModuleWidget\n",
            "Panel\tparams\t0\t21\t80\t32\t32\tPluginKnob\n",
            "Panel\tinputs\t0\t18\t340\t24\t24\tPluginPort\n",
        ),
    )
    .expect("geometry fixture should write");
    let script = format!(
        r#"
import {{ mergeNativeGeometry, parseGeometry }} from './scripts/refresh-native-module-ui.mjs';
const geometry = parseGeometry({geometry:?}).get('Panel');
const module = {{
  key: 'Fixture/Panel', width: 45,
  params: [
    {{ id: 0, name: 'Gain', position: {{ x: 1, y: 1 }} }},
    {{ id: 1, name: 'Display X', position: {{ x: 2, y: 2 }} }},
  ],
  inputs: [{{ id: 0, name: 'CV', position: {{ x: 3, y: 3 }} }}],
  outputs: [{{ id: 0, name: 'Internal debug output', position: {{ x: 4, y: 4 }} }}],
}};
process.stdout.write(JSON.stringify(mergeNativeGeometry(module, geometry)));
"#,
        geometry = geometry.display().to_string(),
    );
    let output = Command::new("node")
        .current_dir(root())
        .args(["--input-type=module", "-e", &script])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let module: Value = serde_json::from_slice(&output).expect("merged module should be JSON");
    assert_eq!(module["width"], 90);
    assert_eq!(module["params"][0]["position"]["x"], 21);
    assert_eq!(module["params"][0]["position"]["widget"], "PluginKnob");
    assert_eq!(module["params"][1].get("position"), None);
    assert_eq!(module["params"][1]["hidden"], true);
    assert_eq!(module["inputs"][0]["position"]["centered"], true);
    assert_eq!(module["outputs"][0]["hidden"], true);
    assert_eq!(module["outputs"][0].get("position"), None);
}

#[test]
fn native_refresh_selects_missing_and_fully_outside_widgets() {
    let script = r#"
import { positionInsidePanel } from './scripts/refresh-native-module-ui.mjs';
const positions = {
  missing: positionInsidePanel(90),
  inside: positionInsidePanel(90, { x: 45, y: 190, width: 30, height: 30, centered: true }),
  overlapsEdge: positionInsidePanel(90, { x: 88, y: 190, width: 30, height: 30, centered: true }),
  outsideX: positionInsidePanel(90, { x: 110, y: 190, width: 30, height: 30, centered: true }),
  outsideY: positionInsidePanel(90, { x: 45, y: 400, width: 30, height: 30, centered: true }),
};
process.stdout.write(JSON.stringify(positions));
"#;
    let output = Command::new("node")
        .current_dir(root())
        .args(["--input-type=module", "-e", script])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let result: Value = serde_json::from_slice(&output).expect("result should be JSON");
    assert_eq!(result["missing"], false);
    assert_eq!(result["inside"], true);
    assert_eq!(result["overlapsEdge"], true);
    assert_eq!(result["outsideX"], false);
    assert_eq!(result["outsideY"], false);
}

#[test]
fn reviewed_non_widget_parameters_are_not_reintroduced_as_generic_controls() {
    let script = r#"
import { applyModuleUiOverrides } from './lib/module-ui-overrides.mjs';
const fixture = (key, count) => ({
  key,
  params: Array.from({ length: count }, (_, id) => ({ id, name: `P${id}`, position: { x: id, y: id } })),
});
const morph = applyModuleUiOverrides(fixture('23volts/Morph', 10));
const scope = applyModuleUiOverrides(fixture('ModularFungi/Opsylloscope', 20));
const ant = applyModuleUiOverrides(fixture('AuntyLangtonsFree/MusicalAnt', 22));
const molphar = applyModuleUiOverrides(fixture('Myth/Molphar', 26));
const sseg = applyModuleUiOverrides(fixture('FrozenWasteland/SeriouslySlowEG', 11));
process.stdout.write(JSON.stringify({ morph, scope, ant, molphar, sseg }));
"#;
    let output = Command::new("node")
        .current_dir(root())
        .args(["--input-type=module", "-e", script])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let result: Value = serde_json::from_slice(&output).expect("result should be JSON");
    assert_eq!(result["morph"]["params"][8]["hidden"], true);
    assert_eq!(result["morph"]["params"][9]["hidden"], true);
    assert_eq!(result["morph"]["params"][8].get("position"), None);
    assert_eq!(
        result["morph"]["runtime"]["visuals"][0]["kind"],
        "morph-pad"
    );
    assert_eq!(result["scope"]["params"][5]["contextOnly"], true);
    assert_eq!(result["scope"]["params"][5].get("position"), None);
    assert_eq!(result["ant"]["params"][14]["hidden"], true);
    assert_eq!(result["molphar"]["params"][25]["hidden"], true);
    assert_eq!(result["sseg"]["params"][10]["position"]["x"], 106);
    assert_eq!(result["sseg"]["params"][10]["position"]["y"], 246);
}

#[test]
fn full_ui_audit_rejects_missing_and_outside_visible_controls_only() {
    let script = r#"
import { moduleUiIssues } from './scripts/audit-module-ui.mjs';
const module = {
  key: 'Fixture/Panel',
  width: 90,
  screenshotUrl: 'https://library.vcvrack.com/screenshots/400/Fixture/Panel.webp',
  params: [
    { id: 0, name: 'Missing' },
    { id: 1, name: 'Outside', position: { x: 110, y: 190, width: 20, height: 20, centered: true } },
    { id: 2, name: 'Hidden', hidden: true },
    { id: 3, name: 'Context', contextOnly: true },
  ],
  inputs: [{ id: 0, name: 'Input', position: { x: 10, y: 360, width: 20, height: 20, centered: true } }],
  outputs: [],
};
process.stdout.write(JSON.stringify(moduleUiIssues(module)));
"#;
    let output = Command::new("node")
        .current_dir(root())
        .args(["--input-type=module", "-e", script])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let result: Value = serde_json::from_slice(&output).expect("result should be JSON");
    assert_eq!(result.as_array().map(Vec::len), Some(2));
    assert_eq!(result[0]["kind"], "missing-widget-position");
    assert_eq!(result[1]["kind"], "widget-outside-panel");
}

#[test]
fn native_build_configuration_preserves_legacy_plugin_toolchains() {
    let script = r#"
import { nativeBuildConfiguration } from './scripts/refresh-native-module-ui.mjs';
process.stdout.write(JSON.stringify({
  ordinary: nativeBuildConfiguration('HetrickCV', 2),
  sse: nativeBuildConfiguration('RPJ', 2),
  oldDaisy: nativeBuildConfiguration('SeasideModular', 2),
  rack1: nativeBuildConfiguration('23volts', 1),
}));
"#;
    let output = Command::new("node")
        .current_dir(root())
        .args(["--input-type=module", "-e", script])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let result: Value = serde_json::from_slice(&output).expect("result should be JSON");
    assert_eq!(result["ordinary"]["architecture"], "arm64");
    assert_eq!(result["sse"]["architecture"], "x86_64");
    assert_eq!(result["oldDaisy"]["extraFlags"][0], "-include");
    assert_eq!(result["oldDaisy"]["extraFlags"][1], "stddef.h");
    assert_eq!(result["rack1"]["architecture"], "x86_64");
}
