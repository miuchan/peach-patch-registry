mod support;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use support::{copy_tree, TemporaryDirectory};

fn fixture_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/registry")
}

fn fixture_index() -> PathBuf {
    fixture_root().join("index.json")
}

fn run_peach(arguments: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_peach"))
        .args(arguments)
        .output()
        .expect("peach CLI should run")
}

fn stdout(output: &Output) -> String {
    String::from_utf8(output.stdout.clone()).expect("stdout should be UTF-8")
}

fn stderr(output: &Output) -> String {
    String::from_utf8(output.stderr.clone()).expect("stderr should be UTF-8")
}

#[test]
fn consumer_commands_preserve_the_local_registry_contract() {
    let index_path = fixture_index();
    let index = index_path.to_str().expect("fixture path should be UTF-8");

    let listed = run_peach(&["list", "--registry", index]);
    assert!(listed.status.success(), "{}", stderr(&listed));
    assert!(stdout(&listed).contains("Fixture/Gain"));

    let searched = run_peach(&["search", "SATURATOR", "--registry", index]);
    assert!(searched.status.success(), "{}", stderr(&searched));
    assert!(stdout(&searched).contains("Fixture Gain"));

    let info = run_peach(&["info", "fixture/gain", "--registry", index]);
    assert!(info.status.success(), "{}", stderr(&info));
    let record: serde_json::Value =
        serde_json::from_slice(&info.stdout).expect("info should emit JSON");
    assert_eq!(record["key"], "Fixture/Gain");
}

#[test]
fn hidden_packages_are_loadable_by_exact_key_but_not_discoverable() {
    let fixture = TemporaryDirectory::new("hidden-cli-package");
    copy_tree(&fixture_root(), fixture.path());
    let index_path = fixture.path().join("index.json");
    let mut index: serde_json::Value =
        serde_json::from_slice(&fs::read(&index_path).expect("fixture index should be readable"))
            .expect("fixture index should be JSON");
    index["packages"][0]["hidden"] = serde_json::Value::Bool(true);
    fs::write(
        &index_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&index).expect("fixture index should serialize")
        ),
    )
    .expect("fixture index should be writable");
    let registry = index_path.to_str().expect("fixture path should be UTF-8");

    let listed = run_peach(&["list", "--registry", registry]);
    assert!(listed.status.success(), "{}", stderr(&listed));
    assert!(!stdout(&listed).contains("Fixture/Gain"));

    let searched = run_peach(&["search", "SATURATOR", "--registry", registry]);
    assert!(searched.status.success(), "{}", stderr(&searched));
    assert!(!stdout(&searched).contains("Fixture Gain"));

    let info = run_peach(&["info", "fixture/gain", "--registry", registry]);
    assert!(info.status.success(), "{}", stderr(&info));
    let record: serde_json::Value =
        serde_json::from_slice(&info.stdout).expect("info should emit JSON");
    assert_eq!(record["key"], "Fixture/Gain");
    assert_eq!(record["hidden"], true);
}

#[test]
fn install_and_verify_preserve_paths_manifests_and_integrity_failures() {
    let prefix = TemporaryDirectory::new("cli-prefix");
    let index_path = fixture_index();
    let index = index_path.to_str().expect("fixture path should be UTF-8");
    let prefix_path = prefix.path().to_str().expect("prefix path should be UTF-8");

    let installed = run_peach(&[
        "install",
        "Fixture/Gain",
        "--registry",
        index,
        "--prefix",
        prefix_path,
    ]);
    assert!(installed.status.success(), "{}", stderr(&installed));
    assert!(stdout(&installed).contains("Fixture/Gain@1.0.0 installed"));

    let package = prefix.path().join("packages/Fixture/Gain/1.0.0");
    assert_eq!(
        fs::read(package.join("module.wasm")).expect("installed artifact should exist"),
        b"peach-fixture-wasm\n"
    );
    let manifest: serde_json::Value = serde_json::from_slice(
        &fs::read(package.join("manifest.json")).expect("installed manifest should exist"),
    )
    .expect("installed manifest should be JSON");
    assert_eq!(manifest["module"]["key"], "Fixture/Gain");

    let verified = run_peach(&[
        "verify",
        "fixture/gain",
        "--registry",
        index,
        "--prefix",
        prefix_path,
    ]);
    assert!(verified.status.success(), "{}", stderr(&verified));
    assert!(stdout(&verified).contains("Fixture/Gain@1.0.0 verified"));

    fs::write(package.join("module.wasm"), b"tampered").expect("artifact should be writable");
    let rejected = run_peach(&[
        "verify",
        "Fixture/Gain",
        "--registry",
        index,
        "--prefix",
        prefix_path,
    ]);
    assert!(!rejected.status.success());
    assert!(stderr(&rejected).contains("Integrity check failed for Fixture/Gain"));
}

#[test]
fn file_urls_and_registry_environment_variable_remain_supported() {
    let index = fixture_index();
    let file_url = format!("file://{}", index.display());
    let file_result = run_peach(&["list", "--registry", &file_url]);
    assert!(file_result.status.success(), "{}", stderr(&file_result));
    assert!(stdout(&file_result).contains("Fixture/Gain"));

    let environment_result = Command::new(env!("CARGO_BIN_EXE_peach"))
        .arg("list")
        .env("PEACH_PATCH_REGISTRY", index)
        .output()
        .expect("peach CLI should run with a registry environment variable");
    assert!(
        environment_result.status.success(),
        "{}",
        stderr(&environment_result)
    );
    assert!(stdout(&environment_result).contains("Fixture/Gain"));
}

#[test]
fn consumer_rejects_registry_paths_that_escape_the_versioned_layout() {
    let fixture = TemporaryDirectory::new("unsafe-consumer-path");
    copy_tree(&fixture_root(), fixture.path());
    let index_path = fixture.path().join("index.json");
    let mut index: serde_json::Value =
        serde_json::from_slice(&fs::read(&index_path).expect("fixture index should be readable"))
            .expect("fixture index should be JSON");
    index["packages"][0]["wasmUrl"] = serde_json::Value::String("../outside.wasm".to_owned());
    fs::write(
        &index_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&index).expect("fixture index should serialize")
        ),
    )
    .expect("fixture index should be writable");

    let rejected = run_peach(&[
        "list",
        "--registry",
        index_path.to_str().expect("fixture path should be UTF-8"),
    ]);
    assert!(!rejected.status.success());
    assert!(stderr(&rejected).contains("identity or package path mismatch"));
}
