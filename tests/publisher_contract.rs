mod support;

use peach_cli::repository::verify_checkout;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use support::{copy_tree, TemporaryDirectory};

fn fixture_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/registry")
}

fn read_json(path: impl AsRef<Path>) -> Value {
    serde_json::from_slice(&fs::read(path).expect("JSON fixture should exist"))
        .expect("JSON fixture should parse")
}

fn assert_object_key_order(path: impl AsRef<Path>, keys: &[&str]) {
    let content = fs::read_to_string(path).expect("JSON output should be readable");
    let mut previous = None;
    for key in keys {
        let position = content
            .find(&format!("\"{key}\""))
            .unwrap_or_else(|| panic!("JSON output should contain key {key}"));
        if let Some(previous) = previous {
            assert!(
                previous < position,
                "JSON keys should retain canonical order: {keys:?}"
            );
        }
        previous = Some(position);
    }
}

fn stderr(output: &Output) -> String {
    String::from_utf8(output.stderr.clone()).expect("stderr should be UTF-8")
}

fn staged_release(label: &str) -> (TemporaryDirectory, PathBuf, PathBuf) {
    let temporary = TemporaryDirectory::new(label);
    copy_tree(&fixture_root(), temporary.path());
    let index: Value = serde_json::from_slice(
        &fs::read(temporary.path().join("index.json")).expect("fixture index should exist"),
    )
    .expect("fixture index should be JSON");
    let mut catalog_package = index["packages"][0].clone();
    catalog_package["version"] = Value::String("1.1.0".to_owned());
    catalog_package["description"] = Value::String("Published by Rust".to_owned());
    catalog_package["localBuild"] = serde_json::json!({
        "sourceCommit": "1111111111111111111111111111111111111111",
        "fingerprint": "rust-publisher-fixture-v1",
        "builtAt": "2026-08-03T01:02:03.000Z"
    });
    catalog_package["fixtureExtension"] = Value::String("preserved".to_owned());
    let catalog_path = temporary.path().join("catalog.json");
    fs::write(
        &catalog_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&vec![catalog_package]).expect("catalog should serialize")
        ),
    )
    .expect("catalog should be writable");
    let dynamic_root = temporary.path().join("dynamic");
    let dynamic_artifact = dynamic_root.join("Fixture/Gain/module.wasm");
    fs::create_dir_all(
        dynamic_artifact
            .parent()
            .expect("artifact should have a parent"),
    )
    .expect("dynamic package directory should be created");
    fs::write(&dynamic_artifact, b"published-rust-wasm\n")
        .expect("dynamic artifact should be writable");
    (temporary, catalog_path, dynamic_root)
}

fn run_publisher(arguments: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(arguments)
        .output()
        .expect("peach-registry should run")
}

#[test]
fn publisher_preserves_metadata_and_emits_a_verifiable_versioned_package() {
    let (release, catalog, dynamic_root) = staged_release("publisher-success");
    fs::write(
        release.path().join("build-status.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "schemaVersion": 1,
            "generatedAt": "2026-08-03T00:00:00.000Z",
            "packages": 1,
            "modules": 1,
            "status": { "compiled": 0, "failed": 0, "pending": 1 },
            "records": [{
                "key": "Fixture/Gain",
                "plugin": "Fixture",
                "model": "Gain",
                "status": "pending",
                "assessment": { "strategy": "manual-browser-adapter" }
            }]
        }))
        .expect("build status should serialize"),
    )
    .expect("build status should be writable");
    fs::write(
        release.path().join("coverage.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "schemaVersion": 1,
            "generatedAt": "2026-08-03T00:00:00.000Z",
            "compiledModules": 0,
            "plugins": 0,
            "openSourceCandidates": 1,
            "openSourceStatus": { "compiled": 0, "failed": 0, "pending": 1 },
            "strategies": {},
            "bytes": 0
        }))
        .expect("coverage should serialize"),
    )
    .expect("coverage should be writable");
    let output = run_publisher(&[
        "publish",
        "--root",
        release
            .path()
            .to_str()
            .expect("release path should be UTF-8"),
        "--catalog",
        catalog.to_str().expect("catalog path should be UTF-8"),
        "--dynamic-root",
        dynamic_root.to_str().expect("dynamic root should be UTF-8"),
        "--key",
        "Fixture/Gain",
        "--format",
        "json",
    ]);
    assert!(output.status.success(), "{}", stderr(&output));
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("publisher should emit a JSON report");
    assert_eq!(report["updated"], 1);
    assert_eq!(report["packages"], 1);

    let package_root = release.path().join("packages/Fixture/Gain/1.1.0");
    let artifact =
        fs::read(package_root.join("module.wasm")).expect("published artifact should be present");
    assert_eq!(artifact, b"published-rust-wasm\n");
    let expected_digest = format!("{:x}", Sha256::digest(&artifact));
    let manifest: Value = serde_json::from_slice(
        &fs::read(package_root.join("manifest.json"))
            .expect("published manifest should be present"),
    )
    .expect("published manifest should be JSON");
    assert_eq!(manifest["module"]["artifact"]["sha256"], expected_digest);
    assert_eq!(manifest["module"]["artifact"]["size"], artifact.len());
    assert_eq!(
        manifest["module"]["sourceCommit"],
        "1111111111111111111111111111111111111111"
    );
    assert_eq!(manifest["module"]["fixtureExtension"], "preserved");
    assert!(manifest["module"].get("localBuild").is_none());
    assert_eq!(
        manifest["source"]["url"],
        "https://github.com/example/fixture"
    );
    assert_eq!(
        manifest["source"]["commit"],
        "1111111111111111111111111111111111111111"
    );
    assert_eq!(manifest["build"]["strategy"], "compatibility-fixture");
    assert_eq!(
        manifest["build"]["fingerprint"],
        "rust-publisher-fixture-v1"
    );
    assert_eq!(manifest["build"]["builtAt"], "2026-08-03T01:02:03.000Z");

    let status = read_json(release.path().join("build-status.json"));
    assert_eq!(
        status["status"],
        serde_json::json!({
            "compiled": 1,
            "failed": 0,
            "pending": 0
        })
    );
    assert_eq!(status["records"][0]["status"], "compiled");
    assert_eq!(
        status["records"][0]["sourceCommit"],
        "1111111111111111111111111111111111111111"
    );
    assert!(status["records"][0].get("assessment").is_none());
    let coverage = read_json(release.path().join("coverage.json"));
    assert_eq!(coverage["compiledModules"], 1);
    assert_eq!(coverage["plugins"], 1);
    assert_eq!(coverage["openSourceStatus"], status["status"]);
    assert_eq!(coverage["strategies"]["compatibility-fixture"], 1);
    assert_eq!(coverage["bytes"], artifact.len());

    assert_object_key_order(
        release.path().join("index.json"),
        &[
            "schemaVersion",
            "abiVersion",
            "generatedAt",
            "packageCount",
            "totalBytes",
            "packages",
        ],
    );
    assert_object_key_order(
        package_root.join("manifest.json"),
        &["schemaVersion", "abiVersion", "module", "source", "build"],
    );
    assert_object_key_order(
        release.path().join("build-status.json"),
        &[
            "schemaVersion",
            "generatedAt",
            "packages",
            "modules",
            "status",
            "records",
        ],
    );
    assert_object_key_order(
        release.path().join("coverage.json"),
        &[
            "schemaVersion",
            "generatedAt",
            "compiledModules",
            "plugins",
            "openSourceCandidates",
            "openSourceStatus",
            "strategies",
            "bytes",
        ],
    );

    verify_checkout(release.path()).expect("published checkout should satisfy repository contract");
}

#[test]
fn targeted_publication_rejects_an_unknown_key_without_mutating_the_index() {
    let (release, catalog, dynamic_root) = staged_release("publisher-unknown-key");
    let index_path = release.path().join("index.json");
    let before = fs::read(&index_path).expect("fixture index should exist");
    let output = run_publisher(&[
        "publish",
        "--root",
        release
            .path()
            .to_str()
            .expect("release path should be UTF-8"),
        "--catalog",
        catalog.to_str().expect("catalog path should be UTF-8"),
        "--dynamic-root",
        dynamic_root.to_str().expect("dynamic root should be UTF-8"),
        "--key",
        "Fixture/Missing",
    ]);
    assert!(!output.status.success());
    assert!(stderr(&output).contains("Unknown registry key: Fixture/Missing"));
    assert_eq!(
        fs::read(index_path).expect("fixture index should remain readable"),
        before
    );
}

#[test]
fn publisher_preserves_existing_build_status_record_order() {
    let (release, catalog, dynamic_root) = staged_release("publisher-record-order");
    fs::write(
        release.path().join("build-status.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "schemaVersion": 1,
            "generatedAt": "2026-08-03T00:00:00.000Z",
            "packages": 2,
            "modules": 2,
            "status": { "compiled": 0, "failed": 0, "pending": 2 },
            "records": [
                { "key": "Zed/Pending", "status": "pending" },
                { "key": "Fixture/Gain", "status": "pending" }
            ]
        }))
        .expect("build status should serialize"),
    )
    .expect("build status should be writable");
    let output = run_publisher(&[
        "publish",
        "--root",
        release
            .path()
            .to_str()
            .expect("release path should be UTF-8"),
        "--catalog",
        catalog.to_str().expect("catalog path should be UTF-8"),
        "--dynamic-root",
        dynamic_root.to_str().expect("dynamic root should be UTF-8"),
        "--key",
        "Fixture/Gain",
    ]);
    assert!(output.status.success(), "{}", stderr(&output));
    let status = read_json(release.path().join("build-status.json"));
    let keys = status["records"]
        .as_array()
        .expect("records should be an array")
        .iter()
        .map(|record| record["key"].as_str().expect("record should have a key"))
        .collect::<Vec<_>>();
    assert_eq!(keys, ["Zed/Pending", "Fixture/Gain"]);
}

#[test]
fn targeted_publication_preserves_unrelated_package_number_lexemes() {
    let (release, catalog, dynamic_root) = staged_release("publisher-package-lexemes");
    let index_path = release.path().join("index.json");
    let mut index = read_json(&index_path);
    let mut stable = index["packages"][0].clone();
    stable["key"] = Value::String("Fixture/Stable".to_owned());
    stable["model"] = Value::String("Stable".to_owned());
    stable["name"] = Value::String("Stable".to_owned());
    stable["wasmUrl"] = Value::String("packages/Fixture/Stable/1.0.0/module.wasm".to_owned());
    stable["manifestUrl"] = Value::String("packages/Fixture/Stable/1.0.0/manifest.json".to_owned());
    stable["fixtureNumber"] =
        serde_json::from_str("0.9700000286102295").expect("number fixture should parse");
    index["packages"]
        .as_array_mut()
        .expect("packages should be an array")
        .push(stable);
    index["packageCount"] = Value::from(2);
    let source = format!(
        "{}\n",
        serde_json::to_string_pretty(&index).expect("fixture index should serialize")
    )
    .replace("0.9700000286102296", "0.9700000286102295");
    assert!(source.contains("\"fixtureNumber\": 0.9700000286102295"));
    fs::write(&index_path, source).expect("fixture index should be writable");

    let output = run_publisher(&[
        "publish",
        "--root",
        release
            .path()
            .to_str()
            .expect("release path should be UTF-8"),
        "--catalog",
        catalog.to_str().expect("catalog path should be UTF-8"),
        "--dynamic-root",
        dynamic_root.to_str().expect("dynamic root should be UTF-8"),
        "--key",
        "Fixture/Gain",
    ]);
    assert!(output.status.success(), "{}", stderr(&output));
    let published = fs::read_to_string(index_path).expect("published index should be readable");
    assert!(published.contains("\"fixtureNumber\": 0.9700000286102295"));
    assert!(!published.contains("\"fixtureNumber\": 0.9700000286102296"));
}
