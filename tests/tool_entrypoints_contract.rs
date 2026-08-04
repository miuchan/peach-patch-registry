mod support;

use assert_cmd::Command;
use predicates::str::contains;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use support::{compile_rust_fixture, copy_tree, TemporaryDirectory};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

fn registry_fixture() -> PathBuf {
    root().join("tests/fixtures/registry")
}

fn fake_scaffold_source() -> PathBuf {
    root().join("tests/fixtures/fake_scaffold.rs")
}

fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&fs::read(path).expect("JSON fixture should exist"))
        .expect("fixture should contain JSON")
}

fn node_script(script: &str) -> Command {
    let mut command = Command::new("node");
    command.current_dir(root()).arg(root().join(script));
    command
}

#[test]
fn legacy_node_entrypoints_forward_publication_and_verification_to_rust() {
    let checkout = TemporaryDirectory::new("rust-entrypoints");
    copy_tree(&registry_fixture(), checkout.path());
    let index = read_json(&checkout.path().join("index.json"));
    let mut candidate = index["packages"][0].clone();
    candidate["version"] = Value::String("1.2.0".to_owned());
    candidate["localBuild"] = serde_json::json!({
        "sourceCommit": "2222222222222222222222222222222222222222",
        "fingerprint": "node-shim-fixture-v1",
        "builtAt": "2026-08-03T02:03:04.000Z"
    });
    let catalog = checkout.path().join("catalog.json");
    fs::write(
        &catalog,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&vec![candidate]).expect("catalog should serialize")
        ),
    )
    .expect("catalog should be written");
    let dynamic_root = checkout.path().join("dynamic");
    let dynamic_artifact = dynamic_root.join("Fixture/Gain/module.wasm");
    fs::create_dir_all(
        dynamic_artifact
            .parent()
            .expect("artifact should have a parent"),
    )
    .expect("dynamic artifact directory should be created");
    fs::write(&dynamic_artifact, b"node-shim-wasm\n").expect("dynamic artifact should be written");

    let output = node_script("scripts/publish-registry.mjs")
        .args([
            "--root",
            checkout
                .path()
                .to_str()
                .expect("checkout path should be UTF-8"),
            "--catalog",
            catalog.to_str().expect("catalog path should be UTF-8"),
            "--dynamic-root",
            dynamic_root.to_str().expect("dynamic root should be UTF-8"),
            "--key",
            "Fixture/Gain",
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let published: Value = serde_json::from_slice(&output).expect("publisher should emit JSON");
    assert_eq!(published["updated"], 1);
    assert_eq!(published["packages"], 1);

    let artifact = checkout
        .path()
        .join("packages/Fixture/Gain/1.2.0/module.wasm");
    let manifest = read_json(
        artifact
            .parent()
            .expect("artifact should have a parent")
            .join("manifest.json")
            .as_path(),
    );
    let digest = format!(
        "{:x}",
        Sha256::digest(fs::read(&artifact).expect("artifact should exist"))
    );
    assert_eq!(manifest["module"]["artifact"]["sha256"], digest);
    assert_eq!(manifest["build"]["fingerprint"], "node-shim-fixture-v1");

    node_script("scripts/verify-registry.mjs")
        .args([
            "--root",
            checkout
                .path()
                .to_str()
                .expect("checkout path should be UTF-8"),
        ])
        .assert()
        .success()
        .stdout(contains("verified 1 packages (15 bytes)"));
}

#[test]
fn publication_shim_preserves_a_failing_exit_status() {
    node_script("scripts/publish-registry.mjs")
        .args(["--key", "Fixture/DefinitelyMissing"])
        .assert()
        .failure()
        .stderr(contains("Unknown registry key: Fixture/DefinitelyMissing"));
}

#[test]
fn source_discovery_shim_forwards_the_immutable_library_queue_contract() {
    let checkout = TemporaryDirectory::new("rust-discovery-entrypoint");
    copy_tree(&registry_fixture(), checkout.path());
    let library = checkout.path().join("library-index");
    let manifests = library.join("manifests");
    fs::create_dir_all(&manifests).expect("manifest directory should be created");
    fs::write(
        manifests.join("Fixture.json"),
        format!(
            "{}\n",
            serde_json::to_string_pretty(&serde_json::json!({
                "slug": "Fixture",
                "version": "1.0.0",
                "license": "MIT",
                "sourceUrl": "https://github.com/example/fixture",
                "modules": [{"slug": "Gain"}, {"slug": "Pending"}]
            }))
            .expect("Library fixture should serialize")
        ),
    )
    .expect("Library fixture should be written");
    Command::new("git")
        .current_dir(&library)
        .args(["init", "-q"])
        .assert()
        .success();
    Command::new("git")
        .current_dir(&library)
        .args(["add", "."])
        .assert()
        .success();
    Command::new("git")
        .current_dir(&library)
        .args([
            "-c",
            "user.name=Peach Tests",
            "-c",
            "user.email=tests@example.invalid",
            "commit",
            "-qm",
            "fixture",
        ])
        .assert()
        .success();
    let queue = checkout.path().join("queue.json");
    let output = node_script("scripts/discover-open-source-modules.mjs")
        .args([
            "--root",
            checkout.path().to_str().expect("checkout should be UTF-8"),
            "--library-index",
            library.to_str().expect("Library path should be UTF-8"),
            "--output",
            queue.to_str().expect("queue path should be UTF-8"),
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let report: Value = serde_json::from_slice(&output).expect("discovery should emit JSON");
    assert_eq!(
        [
            report["packages"].as_u64(),
            report["modules"].as_u64(),
            report["compiled"].as_u64(),
            report["pending"].as_u64(),
        ],
        [Some(1), Some(2), Some(1), Some(1)]
    );
    let queue = read_json(&queue);
    let records = queue["moduleRecords"]
        .as_array()
        .expect("queue should contain module records")
        .iter()
        .map(|record| (record["key"].as_str(), record["compiled"].as_bool()))
        .collect::<Vec<_>>();
    assert_eq!(
        records,
        vec![
            (Some("Fixture/Gain"), Some(true)),
            (Some("Fixture/Pending"), Some(false))
        ]
    );
}

#[test]
fn batch_build_shim_forwards_scheduling_with_a_rust_adapter_fixture() {
    let checkout = TemporaryDirectory::new("rust-build-entrypoint");
    copy_tree(&registry_fixture(), checkout.path());
    let work = checkout.path().join("work");
    fs::create_dir_all(&work).expect("work directory should be created");
    let queue = work.join("queue.json");
    fs::write(
        &queue,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&serde_json::json!({
                "schemaVersion": 1,
                "moduleRecords": [{
                    "key": "Fixture/Shim",
                    "plugin": "Fixture",
                    "model": "Shim",
                    "version": "1.0.0",
                    "sourceUrl": "https://github.com/example/fixture",
                    "libraryUrl": "https://library.vcvrack.com/Fixture/Shim"
                }]
            }))
            .expect("build queue should serialize")
        ),
    )
    .expect("build queue should be written");
    let state = work.join("state.json");
    let catalog = work.join("catalog.json");
    let dynamic_root = work.join("dynamic");
    let fixture_binary =
        compile_rust_fixture(&fake_scaffold_source(), &work.join("bin"), "fake-scaffold");
    let output = node_script("scripts/build-open-source-modules.mjs")
        .args([
            "--root",
            checkout.path().to_str().expect("checkout should be UTF-8"),
            "--queue",
            queue.to_str().expect("queue path should be UTF-8"),
            "--state",
            state.to_str().expect("state path should be UTF-8"),
            "--catalog",
            catalog.to_str().expect("catalog path should be UTF-8"),
            "--output-root",
            work.join("builds")
                .to_str()
                .expect("build root should be UTF-8"),
            "--source-cache",
            work.join("sources")
                .to_str()
                .expect("source cache should be UTF-8"),
            "--dynamic-root",
            dynamic_root.to_str().expect("dynamic root should be UTF-8"),
            "--adapter-script",
            fake_scaffold_source()
                .to_str()
                .expect("adapter source should be UTF-8"),
            "--node",
            fixture_binary
                .to_str()
                .expect("fixture binary should be UTF-8"),
            "--concurrency",
            "1",
        ])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let report: Value = serde_json::from_slice(&output).expect("builder should emit JSON");
    assert_eq!(
        [
            report["attempted"].as_u64(),
            report["succeeded"].as_u64(),
            report["failed"].as_u64()
        ],
        [Some(1), Some(1), Some(0)]
    );
    assert_eq!(
        read_json(&state)["modules"]["Fixture/Shim"]["status"],
        "compiled"
    );
    assert_eq!(
        fs::read_to_string(dynamic_root.join("Fixture/Shim/module.wasm"))
            .expect("dynamic artifact should exist"),
        "Fixture/Shim fixture wasm\n"
    );
}
