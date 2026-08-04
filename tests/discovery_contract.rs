mod support;

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use support::{copy_tree, TemporaryDirectory};

fn fixture_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/registry")
}

fn git(directory: &Path, arguments: &[&str]) -> Output {
    Command::new("git")
        .args(arguments)
        .current_dir(directory)
        .output()
        .expect("git should run")
}

fn library_index(root: &Path) -> PathBuf {
    let index = root.join("library-index");
    let manifests = index.join("manifests");
    fs::create_dir_all(&manifests).expect("manifest directory should be created");
    fs::write(
        manifests.join("Fixture.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "slug": "Fixture",
            "name": "Fixture Library Package",
            "version": "1.0.0",
            "license": "MIT",
            "sourceUrl": "https://github.com/example/fixture",
            "modules": [
                { "slug": "Gain", "name": "Fixture Gain", "tags": ["Effect"] },
                { "slug": "Pending", "description": "Not compiled yet" },
                { "slug": "../Escape", "name": "Unsafe" },
                { "name": "Missing slug" }
            ]
        }))
        .expect("manifest should serialize"),
    )
    .expect("manifest should be writable");
    fs::write(
        manifests.join("Closed.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "slug": "Closed",
            "version": "1.0.0",
            "license": "Proprietary",
            "sourceUrl": "https://github.com/example/closed",
            "modules": [{ "slug": "Secret" }]
        }))
        .expect("manifest should serialize"),
    )
    .expect("manifest should be writable");
    fs::write(
        manifests.join("MissingModules.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "slug": "MissingModules",
            "version": "1.0.0",
            "license": "BSD-3-Clause",
            "sourceUrl": "https://github.com/example/missing"
        }))
        .expect("manifest should serialize"),
    )
    .expect("manifest should be writable");
    fs::write(manifests.join("Invalid.json"), b"{not-json\n")
        .expect("invalid manifest fixture should be writable");

    assert!(git(&index, &["init", "-q"]).status.success());
    assert!(git(&index, &["add", "."]).status.success());
    assert!(git(
        &index,
        &[
            "-c",
            "user.name=Peach Tests",
            "-c",
            "user.email=tests@example.invalid",
            "commit",
            "-qm",
            "fixture",
        ],
    )
    .status
    .success());
    index
}

fn run_discovery(arguments: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(arguments)
        .output()
        .expect("peach-registry should run")
}

fn stderr(output: &Output) -> String {
    String::from_utf8(output.stderr.clone()).expect("stderr should be UTF-8")
}

#[test]
fn discovery_uses_an_immutable_library_snapshot_and_emits_a_safe_queue() {
    let checkout = TemporaryDirectory::new("discovery-success");
    copy_tree(&fixture_root(), checkout.path());
    let library = library_index(checkout.path());
    let output_path = checkout.path().join("build/queue.json");
    let output = run_discovery(&[
        "discover",
        "--root",
        checkout
            .path()
            .to_str()
            .expect("checkout path should be UTF-8"),
        "--library-index",
        library.to_str().expect("library path should be UTF-8"),
        "--output",
        output_path.to_str().expect("output path should be UTF-8"),
        "--format",
        "json",
    ]);
    assert!(output.status.success(), "{}", stderr(&output));
    let report: Value = serde_json::from_slice(&output.stdout).expect("discovery should emit JSON");
    assert_eq!(report["packages"], 1);
    assert_eq!(report["modules"], 2);
    assert_eq!(report["compiled"], 1);
    assert_eq!(report["pending"], 1);

    let queue: Value =
        serde_json::from_slice(&fs::read(&output_path).expect("discovery queue should be written"))
            .expect("discovery queue should be JSON");
    let revision = String::from_utf8(git(&library, &["rev-parse", "HEAD"]).stdout)
        .expect("revision should be UTF-8")
        .trim()
        .to_owned();
    assert_eq!(queue["sourceRevision"], revision);
    assert_eq!(queue["packageRecords"][0]["plugin"], "Fixture");
    assert_eq!(
        queue["packageRecords"][0]["modules"],
        serde_json::json!(["Fixture/Gain", "Fixture/Pending"])
    );
    assert_eq!(queue["moduleRecords"][0]["key"], "Fixture/Gain");
    assert_eq!(queue["moduleRecords"][0]["compiled"], true);
    assert_eq!(queue["moduleRecords"][1]["key"], "Fixture/Pending");
    assert_eq!(queue["moduleRecords"][1]["compiled"], false);
    assert!(queue["moduleRecords"]
        .as_array()
        .expect("module records should be an array")
        .iter()
        .all(|item| item["key"] != "Fixture/../Escape"));
}

#[test]
fn discovery_failure_does_not_create_a_queue() {
    let checkout = TemporaryDirectory::new("discovery-missing-index");
    copy_tree(&fixture_root(), checkout.path());
    let output_path = checkout.path().join("queue.json");
    let missing = checkout.path().join("missing-library-index");
    let output = run_discovery(&[
        "discover",
        "--root",
        checkout
            .path()
            .to_str()
            .expect("checkout path should be UTF-8"),
        "--library-index",
        missing.to_str().expect("library path should be UTF-8"),
        "--output",
        output_path.to_str().expect("output path should be UTF-8"),
    ]);
    assert!(!output.status.success());
    assert!(stderr(&output).contains("git:"));
    assert!(!output_path.exists());
}
