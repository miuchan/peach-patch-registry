mod support;

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use support::{copy_tree, TemporaryDirectory};

fn registry_fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/registry")
}

fn adapter_fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/fake-scaffold.mjs")
}

fn item(plugin: &str, model: &str) -> Value {
    serde_json::json!({
        "key": format!("{plugin}/{model}"),
        "plugin": plugin,
        "model": model,
        "name": format!("{plugin} {model}"),
        "description": "Scheduler contract fixture",
        "tags": ["Test"],
        "version": "1.0.0",
        "license": "MIT",
        "sourceUrl": format!("https://github.com/example/{plugin}"),
        "libraryUrl": format!("https://library.vcvrack.com/{plugin}/{model}"),
        "compiled": false
    })
}

struct SchedulerFixture {
    checkout: TemporaryDirectory,
    queue: PathBuf,
    state: PathBuf,
    catalog: PathBuf,
    output_root: PathBuf,
    source_cache: PathBuf,
    dynamic_root: PathBuf,
}

impl SchedulerFixture {
    fn new(label: &str, records: Vec<Value>) -> Self {
        let checkout = TemporaryDirectory::new(label);
        copy_tree(&registry_fixture(), checkout.path());
        let queue = checkout.path().join("work/queue.json");
        fs::create_dir_all(queue.parent().expect("queue should have a parent"))
            .expect("queue directory should be created");
        fs::write(
            &queue,
            format!(
                "{}\n",
                serde_json::to_string_pretty(&serde_json::json!({
                    "schemaVersion": 1,
                    "moduleRecords": records
                }))
                .expect("queue should serialize")
            ),
        )
        .expect("queue should be writable");
        Self {
            state: checkout.path().join("work/state.json"),
            catalog: checkout.path().join("work/catalog.json"),
            output_root: checkout.path().join("work/builds"),
            source_cache: checkout.path().join("work/sources"),
            dynamic_root: checkout.path().join("work/dynamic"),
            queue,
            checkout,
        }
    }

    fn arguments(&self) -> Vec<String> {
        [
            "build",
            "--root",
            self.checkout.path().to_str().expect("root should be UTF-8"),
            "--queue",
            self.queue.to_str().expect("queue should be UTF-8"),
            "--state",
            self.state.to_str().expect("state should be UTF-8"),
            "--catalog",
            self.catalog.to_str().expect("catalog should be UTF-8"),
            "--output-root",
            self.output_root
                .to_str()
                .expect("output root should be UTF-8"),
            "--source-cache",
            self.source_cache
                .to_str()
                .expect("source cache should be UTF-8"),
            "--dynamic-root",
            self.dynamic_root
                .to_str()
                .expect("dynamic root should be UTF-8"),
            "--adapter-script",
            adapter_fixture().to_str().expect("adapter should be UTF-8"),
            "--concurrency",
            "2",
            "--format",
            "json",
        ]
        .into_iter()
        .map(str::to_owned)
        .collect()
    }
}

fn run(arguments: &[String]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(arguments)
        .output()
        .expect("peach-registry should run")
}

fn stderr(output: &Output) -> String {
    String::from_utf8(output.stderr.clone()).expect("stderr should be UTF-8")
}

fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&fs::read(path).expect("JSON file should exist"))
        .expect("file should contain JSON")
}

#[test]
fn scheduler_preserves_adapter_state_staging_cleanup_and_failure_contracts() {
    let fixture = SchedulerFixture::new(
        "scheduler-mixed",
        vec![
            item("Fixture", "One"),
            item("Fixture", "Two"),
            item("Fixture", "Fail"),
            item("MSM", "Asset"),
            item("STS", "Excluded"),
        ],
    );
    let output = run(&fixture.arguments());
    assert_eq!(output.status.code(), Some(2), "{}", stderr(&output));
    let report: Value = serde_json::from_slice(&output.stdout).expect("scheduler should emit JSON");
    assert_eq!(report["attempted"], 4);
    assert_eq!(report["succeeded"], 3);
    assert_eq!(report["failed"], 1);
    assert_eq!(report["concurrency"], 2);
    assert_eq!(report["catalogModules"], 4);
    assert_eq!(report["removedSourceRepositories"], 2);

    let state = read_json(&fixture.state);
    for key in ["Fixture/One", "Fixture/Two", "MSM/Asset"] {
        assert_eq!(state["modules"][key]["status"], "compiled");
    }
    assert_eq!(state["modules"]["Fixture/Fail"]["status"], "failed");
    assert_eq!(
        state["modules"]["Fixture/Fail"]["assessment"]["strategy"],
        "manual-browser-adapter"
    );
    assert!(state["modules"]["Fixture/Fail"]["error"]
        .as_str()
        .expect("failure should contain an error")
        .contains("fixture compiler rejected the module"));
    assert_eq!(state["modules"]["STS/Excluded"]["status"], "failed");
    assert_eq!(
        state["modules"]["STS/Excluded"]["assessment"]["strategy"],
        "excluded-source-license"
    );

    let catalog = read_json(&fixture.catalog);
    let keys = catalog
        .as_array()
        .expect("catalog should be an array")
        .iter()
        .map(|item| item["key"].as_str().expect("package should have a key"))
        .collect::<Vec<_>>();
    assert_eq!(
        keys,
        ["Fixture/Gain", "Fixture/One", "Fixture/Two", "MSM/Asset"]
    );
    let one = catalog
        .as_array()
        .expect("catalog should be an array")
        .iter()
        .find(|item| item["key"] == "Fixture/One")
        .expect("successful package should be cataloged");
    assert_eq!(one["runtime"]["strategy"], "fixture-source-adapter");
    assert_eq!(one["localBuild"]["batch"], true);
    assert_eq!(
        one["localBuild"]["sourceCommit"],
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );

    for (plugin, model) in [("Fixture", "One"), ("Fixture", "Two"), ("MSM", "Asset")] {
        assert!(fixture
            .dynamic_root
            .join(plugin)
            .join(model)
            .join("module.wasm")
            .exists());
    }
    assert!(!fixture
        .dynamic_root
        .join("Fixture/Fail/module.wasm")
        .exists());
    assert!(fixture
        .checkout
        .path()
        .join("public/rack-components/msm/Knobs/FixtureKnob.svg")
        .exists());
    assert!(!fixture
        .checkout
        .path()
        .join("public/rack-components/msm/Knobs/Ignored.png")
        .exists());
    assert!(!fixture.source_cache.join("Fixture").exists());
    assert!(!fixture.source_cache.join("MSM").exists());
    assert!(!fixture.output_root.join("Fixture").join("One").exists());
    assert!(!fixture.output_root.join("Fixture").join("Fail").exists());

    let resumed = run(&fixture.arguments());
    assert!(resumed.status.success(), "{}", stderr(&resumed));
    let resumed_report: Value =
        serde_json::from_slice(&resumed.stdout).expect("resume should emit JSON");
    assert_eq!(resumed_report["attempted"], 0);
    let mut retry = fixture.arguments();
    retry.extend([
        "--retry".to_owned(),
        "--plugin".to_owned(),
        "Fixture".to_owned(),
        "--model".to_owned(),
        "Fail".to_owned(),
    ]);
    let retried = run(&retry);
    assert_eq!(retried.status.code(), Some(2), "{}", stderr(&retried));
    let retry_report: Value =
        serde_json::from_slice(&retried.stdout).expect("retry should emit JSON");
    assert_eq!(retry_report["attempted"], 1);
    assert_eq!(retry_report["failed"], 1);
}

#[test]
fn scheduler_reuses_the_first_checkout_and_runs_the_plugin_remainder_in_parallel() {
    let fixture = SchedulerFixture::new(
        "scheduler-parallel",
        vec![
            item("Fixture", "Warmup"),
            item("Fixture", "ParallelA"),
            item("Fixture", "ParallelB"),
        ],
    );
    let mut arguments = fixture.arguments();
    arguments.extend(["--keep-source".to_owned(), "--keep-build".to_owned()]);
    let output = run(&arguments);
    assert!(output.status.success(), "{}", stderr(&output));
    let report: Value = serde_json::from_slice(&output.stdout).expect("scheduler should emit JSON");
    assert_eq!(report["attempted"], 3);
    assert_eq!(report["succeeded"], 3);
    assert!(fixture
        .source_cache
        .join("Fixture/parallel-observed")
        .exists());
    assert!(fixture
        .output_root
        .join("Fixture/ParallelA/runtime.json")
        .exists());
    assert_eq!(report["removedSourceRepositories"], 0);
}

#[test]
fn scheduler_kills_timed_out_adapters_and_persists_a_retryable_failure() {
    let fixture = SchedulerFixture::new("scheduler-timeout", vec![item("Fixture", "Slow")]);
    let mut arguments = fixture.arguments();
    arguments.extend(["--timeout-ms".to_owned(), "100".to_owned()]);
    let output = run(&arguments);
    assert_eq!(output.status.code(), Some(2), "{}", stderr(&output));
    let state = read_json(&fixture.state);
    assert_eq!(state["modules"]["Fixture/Slow"]["status"], "failed");
    assert!(state["modules"]["Fixture/Slow"]["error"]
        .as_str()
        .expect("failure should contain an error")
        .contains("timed out after 100 ms"));
    assert!(!fixture.output_root.join("Fixture/Slow").exists());
    assert!(!fixture.source_cache.join("Fixture").exists());
}

#[cfg(unix)]
#[test]
fn scheduler_timeout_kills_adapter_descendants_in_the_same_process_group() {
    let fixture = SchedulerFixture::new(
        "scheduler-timeout-child",
        vec![item("Fixture", "SlowChild")],
    );
    let marker = fixture
        .source_cache
        .parent()
        .expect("source cache should have a parent")
        .join("orphan-marker");
    let mut arguments = fixture.arguments();
    arguments.extend(["--timeout-ms".to_owned(), "100".to_owned()]);
    let output = run(&arguments);
    assert_eq!(output.status.code(), Some(2), "{}", stderr(&output));
    std::thread::sleep(std::time::Duration::from_millis(750));
    assert!(
        !marker.exists(),
        "a timed-out adapter left a live compiler descendant"
    );
}

#[test]
fn scheduler_rejects_untrusted_queue_urls_before_creating_build_state() {
    let mut unsafe_item = item("Fixture", "Unsafe");
    unsafe_item["libraryUrl"] = Value::String("https://evil.example/Fixture/Unsafe".to_owned());
    let fixture = SchedulerFixture::new("scheduler-unsafe", vec![unsafe_item]);
    let output = run(&fixture.arguments());
    assert_eq!(output.status.code(), Some(1));
    assert!(stderr(&output).contains("Invalid official Library URL for Fixture/Unsafe"));
    assert!(!fixture.state.exists());
    assert!(!fixture.catalog.exists());
}
