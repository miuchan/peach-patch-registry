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
