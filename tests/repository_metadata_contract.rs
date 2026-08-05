use assert_cmd::Command;
use regex::Regex;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

fn read_json(path: impl AsRef<Path>) -> Value {
    serde_json::from_slice(&fs::read(path).expect("repository JSON should exist"))
        .expect("repository JSON should parse")
}

#[test]
fn hidden_packages_are_compatibility_only_across_repository_metadata() {
    let index = read_json(root().join("index.json"));
    let status = read_json(root().join("build-status.json"));
    let coverage = read_json(root().join("coverage.json"));
    let packages = index["packages"]
        .as_array()
        .expect("index packages should be an array");
    let hidden_keys = packages
        .iter()
        .filter(|item| item["hidden"] == true)
        .map(|item| {
            item["key"]
                .as_str()
                .expect("package key should be a string")
                .to_owned()
        })
        .collect::<HashSet<_>>();
    assert!(
        !hidden_keys.is_empty(),
        "the repository fixture should exercise compatibility-only packages"
    );

    let visible = packages
        .iter()
        .filter(|item| item["hidden"] != true)
        .collect::<Vec<_>>();
    let visible_bytes = visible.iter().fold(0_u64, |total, item| {
        total
            + item["artifact"]["size"]
                .as_u64()
                .expect("artifact size should be an integer")
    });
    let visible_strategies = visible.iter().fold(BTreeMap::new(), |mut counts, item| {
        let strategy = item["runtime"]["strategy"]
            .as_str()
            .expect("runtime strategy should be a string");
        *counts.entry(strategy).or_insert(0_u64) += 1;
        counts
    });
    assert_eq!(
        coverage["compiledModules"],
        u64::try_from(visible.len()).expect("visible package count should fit u64")
    );
    assert_eq!(coverage["bytes"], visible_bytes);
    for (strategy, count) in visible_strategies {
        assert_eq!(coverage["strategies"][strategy], count);
    }
    assert!(status["records"]
        .as_array()
        .expect("status records should be an array")
        .iter()
        .all(|item| !hidden_keys
            .contains(item["key"].as_str().expect("status key should be a string"))));

    for item in packages.iter().filter(|item| item["hidden"] == true) {
        let manifest_url = item["manifestUrl"]
            .as_str()
            .expect("manifest URL should be a string");
        let manifest = read_json(root().join(manifest_url));
        assert_eq!(&manifest["module"], item);
        assert!(root()
            .join(
                item["wasmUrl"]
                    .as_str()
                    .expect("WASM URL should be a string")
            )
            .exists());
    }
}

#[test]
fn branches_publishes_its_90px_panel_with_exact_control_dimensions() {
    let index = read_json(root().join("index.json"));
    let manifest =
        read_json(root().join("packages/AudibleInstruments/Branches/2.0.0/manifest.json"));
    let module = index["packages"]
        .as_array()
        .expect("index packages should be an array")
        .iter()
        .find(|item| item["key"] == "AudibleInstruments/Branches")
        .expect("Branches should be present in the index");
    assert_eq!(module["width"], 90);
    assert_eq!(manifest["module"]["width"], 90);

    let controls = module["params"]
        .as_array()
        .expect("module params should be an array")
        .iter()
        .map(|param| serde_json::json!({"id": param["id"], "position": param["position"]}))
        .collect::<Vec<_>>();
    let manifest_controls = manifest["module"]["params"]
        .as_array()
        .expect("manifest params should be an array")
        .iter()
        .map(|param| serde_json::json!({"id": param["id"], "position": param["position"]}))
        .collect::<Vec<_>>();
    assert_eq!(controls, manifest_controls);
    let dimensions = controls
        .iter()
        .map(|control| {
            (
                control["position"]["width"]
                    .as_f64()
                    .expect("control width should be numeric"),
                control["position"]["height"]
                    .as_f64()
                    .expect("control height should be numeric"),
            )
        })
        .collect::<Vec<_>>();
    assert_eq!(
        dimensions,
        vec![
            (39.6836, 39.6836),
            (39.6836, 39.6836),
            (15.36, 15.3577),
            (15.36, 15.3577)
        ]
    );
    let right_edge = controls
        .iter()
        .map(|control| {
            let position = &control["position"];
            position["x"].as_f64().expect("control x should be numeric")
                + if position["centered"].as_bool().unwrap_or(false) {
                    position["width"]
                        .as_f64()
                        .expect("control width should be numeric")
                        / 2.0
                } else {
                    position["width"]
                        .as_f64()
                        .expect("control width should be numeric")
                }
        })
        .fold(f64::NEG_INFINITY, f64::max);
    assert_eq!((right_edge / 15.0).ceil() * 15.0, 90.0);
}

const MUTABLE_KEYS: [&str; 3] = [
    "AudibleInstruments/Braids",
    "AudibleInstruments/Elements",
    "AudibleInstruments/Rings",
];

#[test]
fn mutable_instruments_browser_artifacts_come_only_from_direct_rack_source_builds() {
    let runtime_manifest = read_json(root().join("web-runtime/modules.json"));
    let commit_pattern = Regex::new(r"^[0-9a-f]{40}$").expect("commit regex should compile");
    for key in MUTABLE_KEYS {
        let runtime = runtime_manifest["modules"]
            .as_array()
            .expect("runtime modules should be an array")
            .iter()
            .find(|item| item["key"] == key)
            .unwrap_or_else(|| panic!("{key} should be present in the runtime manifest"));
        assert_eq!(runtime["strategy"], "direct-rack-source-adapter");
        let entry = runtime["entry"]
            .as_str()
            .expect("runtime entry should be a string");
        assert!(
            !root()
                .join("web-runtime/plugins")
                .join(format!("{entry}.cpp"))
                .exists(),
            "{key} should not retain a simplified C++ fallback"
        );
        let package_artifact = runtime["packageArtifact"]
            .as_str()
            .expect("package artifact should be a string");
        let manifest_path = root()
            .join(package_artifact)
            .parent()
            .expect("package artifact should have a parent")
            .join("manifest.json");
        let manifest = read_json(manifest_path);
        assert_eq!(manifest["module"]["key"], key);
        assert_eq!(manifest["module"]["wasmUrl"], package_artifact);
        assert_eq!(manifest["build"]["strategy"], "direct-rack-source-adapter");
        assert!(manifest["source"]["url"]
            .as_str()
            .expect("source URL should be a string")
            .starts_with("https://github.com/VCVRack/AudibleInstruments"));
        assert!(commit_pattern.is_match(
            manifest["source"]["commit"]
                .as_str()
                .expect("source commit should be a string")
        ));
        let artifact = fs::read(root().join(package_artifact)).expect("artifact should exist");
        assert_eq!(
            u64::try_from(artifact.len()).expect("artifact size should fit u64"),
            manifest["module"]["artifact"]["size"]
                .as_u64()
                .expect("manifest artifact size should be an integer")
        );
        assert_eq!(
            format!("{:x}", Sha256::digest(&artifact)),
            manifest["module"]["artifact"]["sha256"]
                .as_str()
                .expect("manifest digest should be a string")
        );
    }
}

#[test]
fn web_runtime_manifest_reader_resolves_source_built_artifacts() {
    let output = Command::new("node")
        .current_dir(root())
        .arg(root().join("scripts/read-web-runtime-manifest.mjs"))
        .args(MUTABLE_KEYS)
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let output = String::from_utf8(output).expect("manifest reader output should be UTF-8");
    let rows = output
        .trim()
        .lines()
        .map(|line| line.split('\t').collect::<Vec<_>>())
        .collect::<Vec<_>>();
    assert_eq!(rows.len(), MUTABLE_KEYS.len());
    let artifact_pattern =
        Regex::new(r"^packages/AudibleInstruments/(Braids|Elements|Rings)/2\.0\.0/module\.wasm$")
            .expect("artifact regex should compile");
    for row in rows {
        assert_eq!(row.len(), 6);
        assert_eq!(row[4], "direct-rack-source-adapter");
        assert!(artifact_pattern.is_match(row[5]));
    }
}
