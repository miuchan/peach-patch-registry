mod support;

use peach_cli::repository::verify_checkout;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use support::{copy_tree, TemporaryDirectory};

fn fixture_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/registry")
}

fn mutable_fixture(label: &str) -> TemporaryDirectory {
    let temporary = TemporaryDirectory::new(label);
    copy_tree(&fixture_root(), temporary.path());
    temporary
}

#[test]
fn repository_verifier_accepts_the_versioned_package_contract() {
    let report = verify_checkout(&fixture_root()).expect("fixture registry should verify");
    assert_eq!(report.package_count, 1);
    assert_eq!(report.total_bytes, 19);
}

#[test]
fn repository_verifier_accepts_hidden_compatibility_packages() {
    let fixture = mutable_fixture("hidden-compatibility-package");
    let index_path = fixture.path().join("index.json");
    let manifest_path = fixture
        .path()
        .join("packages/Fixture/Gain/1.0.0/manifest.json");
    let mut index: Value =
        serde_json::from_slice(&fs::read(&index_path).expect("index should exist"))
            .expect("index should be JSON");
    let mut manifest: Value =
        serde_json::from_slice(&fs::read(&manifest_path).expect("manifest should exist"))
            .expect("manifest should be JSON");
    index["packages"][0]["hidden"] = Value::Bool(true);
    manifest["module"]["hidden"] = Value::Bool(true);
    for (file, value) in [(&index_path, &index), (&manifest_path, &manifest)] {
        fs::write(
            file,
            format!(
                "{}\n",
                serde_json::to_string_pretty(value).expect("JSON should serialize")
            ),
        )
        .expect("JSON should be writable");
    }

    let report = verify_checkout(fixture.path()).expect("hidden package should remain verifiable");
    assert_eq!(report.package_count, 1);
    assert_eq!(report.total_bytes, 19);
}

#[test]
fn repository_verifier_rejects_artifact_tampering() {
    let fixture = mutable_fixture("artifact-tamper");
    fs::write(
        fixture
            .path()
            .join("packages/Fixture/Gain/1.0.0/module.wasm"),
        b"tampered",
    )
    .expect("artifact should be writable");
    let error = verify_checkout(fixture.path()).expect_err("tampered artifact should fail");
    assert!(error.contains("Integrity mismatch Fixture/Gain"));
}

#[test]
fn repository_verifier_rejects_manifest_drift() {
    let fixture = mutable_fixture("manifest-drift");
    let manifest_path = fixture
        .path()
        .join("packages/Fixture/Gain/1.0.0/manifest.json");
    let mut manifest: Value =
        serde_json::from_slice(&fs::read(&manifest_path).expect("manifest should exist"))
            .expect("manifest should be JSON");
    manifest["module"]["version"] = Value::String("2.0.0".to_owned());
    fs::write(
        &manifest_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&manifest).expect("manifest should serialize")
        ),
    )
    .expect("manifest should be writable");
    let error = verify_checkout(fixture.path()).expect_err("manifest drift should fail");
    assert!(error.contains("Manifest mismatch for Fixture/Gain"));
}

#[test]
fn repository_verifier_rejects_non_positive_panel_widths() {
    let fixture = mutable_fixture("panel-width");
    let index_path = fixture.path().join("index.json");
    let mut index: Value =
        serde_json::from_slice(&fs::read(&index_path).expect("index should exist"))
            .expect("index should be JSON");
    index["packages"][0]["width"] = Value::from(0);
    fs::write(
        &index_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&index).expect("index should serialize")
        ),
    )
    .expect("index should be writable");
    let error = verify_checkout(fixture.path()).expect_err("invalid panel width should fail");
    assert!(error.contains("Invalid package record"));
}

#[test]
fn repository_verifier_rejects_paths_outside_the_package_layout() {
    let fixture = mutable_fixture("path-drift");
    let index_path = fixture.path().join("index.json");
    let mut index: Value =
        serde_json::from_slice(&fs::read(&index_path).expect("index should exist"))
            .expect("index should be JSON");
    index["packages"][0]["wasmUrl"] = Value::String("../module.wasm".to_owned());
    fs::write(
        &index_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&index).expect("index should serialize")
        ),
    )
    .expect("index should be writable");
    let error = verify_checkout(fixture.path()).expect_err("path drift should fail");
    assert!(error.contains("identity or package path mismatch for Fixture/Gain"));
}

#[test]
fn repository_verifier_checks_registry_relative_panel_artwork_dimensions() {
    let fixture = mutable_fixture("panel-artwork");
    let index_path = fixture.path().join("index.json");
    let manifest_path = fixture
        .path()
        .join("packages/Fixture/Gain/1.0.0/manifest.json");
    let panel_path = fixture
        .path()
        .join("packages/Fixture/Gain/1.0.0/panel.webp");
    let panel_url = "packages/Fixture/Gain/1.0.0/panel.webp";
    let mut index: Value =
        serde_json::from_slice(&fs::read(&index_path).expect("index should exist"))
            .expect("index should be JSON");
    let mut manifest: Value =
        serde_json::from_slice(&fs::read(&manifest_path).expect("manifest should exist"))
            .expect("manifest should be JSON");
    index["packages"][0]["screenshotUrl"] = Value::String(panel_url.to_owned());
    manifest["module"]["screenshotUrl"] = Value::String(panel_url.to_owned());
    for (path, value) in [(&index_path, &index), (&manifest_path, &manifest)] {
        fs::write(
            path,
            format!(
                "{}\n",
                serde_json::to_string_pretty(value).expect("JSON should serialize")
            ),
        )
        .expect("JSON should be writable");
    }
    let mut webp = vec![0_u8; 30];
    webp[0..4].copy_from_slice(b"RIFF");
    webp[4..8].copy_from_slice(&22_u32.to_le_bytes());
    webp[8..12].copy_from_slice(b"WEBP");
    webp[12..16].copy_from_slice(b"VP8X");
    webp[16..20].copy_from_slice(&10_u32.to_le_bytes());
    let width_minus_one = 44_u32.to_le_bytes();
    let height_minus_one = 379_u32.to_le_bytes();
    webp[24..27].copy_from_slice(&width_minus_one[..3]);
    webp[27..30].copy_from_slice(&height_minus_one[..3]);
    fs::write(&panel_path, &webp).expect("panel should be writable");
    verify_checkout(fixture.path()).expect("matching local panel should verify");

    webp[24] = 89;
    fs::write(&panel_path, webp).expect("panel should be writable");
    let error = verify_checkout(fixture.path()).expect_err("wrong panel dimensions should fail");
    assert!(error.contains("Panel artwork dimensions mismatch for Fixture/Gain"));
}
