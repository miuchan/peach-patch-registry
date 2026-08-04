use assert_cmd::Command;
use predicates::prelude::*;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

fn run(request: Value) -> std::process::Output {
    let mut command = Command::new("node");
    command
        .current_dir(root())
        .arg(root().join("scripts/registry-maintenance.mjs"))
        .write_stdin(serde_json::to_vec(&request).expect("request should serialize"));
    command.output().expect("maintenance command should run")
}

fn run_ok(request: Value) -> Value {
    let output = run(request);
    assert!(
        output.status.success(),
        "maintenance command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("maintenance output should be JSON")
}

#[test]
fn ui_geometry_refresh_preserves_artifacts_while_repairing_widget_positions() {
    let current = json!({
        "key": "Fixture/Panel",
        "width": 45,
        "wasmUrl": "packages/Fixture/Panel/1.0.0/module.wasm",
        "artifact": {"sha256": "a".repeat(64), "size": 8},
        "params": [
            {"id": 0, "name": "Visible", "min": 0, "max": 1, "default": 0},
            {"id": 1, "name": "Context", "min": 0, "max": 1, "default": 0, "contextOnly": true}
        ],
        "inputs": [{"id": 0, "name": "In", "kind": "cv"}],
        "outputs": [{"id": 0, "name": "Out", "kind": "cv"}]
    });
    let refreshed = json!({
        "width": 60,
        "params": [
            {"id": 0, "position": {"x": 15, "y": 40, "centered": true, "widget": "RoundBlackKnob"}},
            {"id": 1}
        ],
        "inputs": [{"id": 0, "position": {"x": 15, "y": 330, "centered": true}}],
        "outputs": [{"id": 0, "position": {"x": 45, "y": 330, "centered": true}}]
    });
    assert_eq!(
        run_ok(json!({"operation": "inspect-ui-geometry", "module": current})),
        json!({"complete": false, "issueCount": 0})
    );
    let merged = run_ok(json!({
        "operation": "merge-ui-geometry",
        "current": current,
        "refreshed": refreshed
    }));
    assert_eq!(
        run_ok(json!({"operation": "inspect-ui-geometry", "module": merged})),
        json!({"complete": true, "issueCount": 0})
    );
    assert_eq!(merged["width"], 60);
    assert_eq!(
        merged["params"][0]["position"],
        refreshed["params"][0]["position"]
    );
    assert!(merged["params"][1].get("position").is_none());
    assert_eq!(merged["wasmUrl"], current["wasmUrl"]);
    assert_eq!(merged["artifact"], current["artifact"]);
}

#[test]
fn ui_geometry_refresh_rejects_collapsed_coordinates_and_keeps_good_positions() {
    let current = json!({
        "width": 60,
        "params": [
            {"id": 0, "name": "A", "position": {"x": 15, "y": 40}},
            {"id": 1, "name": "B", "position": {"x": 45, "y": 40}}
        ],
        "inputs": [],
        "outputs": []
    });
    let collapsed = json!({
        "width": 60,
        "params": [
            {"id": 0, "position": {"x": 22, "y": 33}},
            {"id": 1, "position": {"x": 22, "y": 33}}
        ],
        "inputs": [],
        "outputs": []
    });
    assert_eq!(
        run_ok(json!({"operation": "inspect-ui-geometry", "module": current})),
        json!({"complete": true, "issueCount": 0})
    );
    assert_eq!(
        run_ok(json!({"operation": "inspect-ui-geometry", "module": collapsed})),
        json!({"complete": false, "issueCount": 1})
    );
    let merged = run_ok(json!({
        "operation": "merge-ui-geometry",
        "current": current,
        "refreshed": collapsed
    }));
    assert_eq!(merged["params"], current["params"]);
}

#[test]
fn screenshot_refresh_clears_only_confirmed_missing_assets() {
    let module = json!({
        "screenshotUrl": "https://library.vcvrack.com/screenshots/400/Fixture/Panel.webp"
    });
    assert_eq!(
        run_ok(json!({
            "operation": "clear-missing-screenshot",
            "module": module,
            "status": 404
        }))["screenshotUrl"],
        ""
    );
    assert_eq!(
        run_ok(json!({
            "operation": "clear-missing-screenshot",
            "module": module,
            "status": 500
        })),
        module
    );
}

#[test]
fn official_library_module_urls_are_canonicalized_narrowly() {
    assert_eq!(
        run_ok(json!({
            "operation": "parse-library-url",
            "url": "https://library.vcvrack.com/Bogaudio/Bogaudio-ADSR"
        })),
        json!({
            "plugin": "Bogaudio",
            "model": "Bogaudio-ADSR",
            "key": "Bogaudio/Bogaudio-ADSR",
            "url": "https://library.vcvrack.com/Bogaudio/Bogaudio-ADSR"
        })
    );
    for url in [
        "http://library.vcvrack.com/A/B",
        "https://evil.example/A/B",
        "https://user@library.vcvrack.com/A/B",
        "https://library.vcvrack.com:444/A/B",
        "https://library.vcvrack.com/A/B/C",
        "https://library.vcvrack.com/A/%2f",
        "https://library.vcvrack.com/A/B?x=1",
        "https://library.vcvrack.com/A/B#x",
    ] {
        let output = run(json!({"operation": "parse-library-url", "url": url}));
        assert!(!output.status.success(), "{url} should be rejected");
        assert!(
            predicate::str::contains("official VCV Library HTTPS module URLs")
                .eval(&String::from_utf8_lossy(&output.stderr))
                || predicate::str::contains("Expected a module URL")
                    .eval(&String::from_utf8_lossy(&output.stderr))
        );
    }
}

#[test]
fn library_html_exposes_only_safe_https_assets_and_source_links() {
    let html = concat!(
        "<meta property=\"og:title\" content=\"Bogaudio &amp; ADSR\">",
        "<meta name=\"description\" content=\"Envelope\">",
        "<meta property=\"og:image\" content=\"https://library.vcvrack.com/a.webp\">",
        "<span title=\"Current version distributed\">2.6.47</span>",
        "<a href=\"https://github.com/bogaudio/BogaudioModules\">Source code</a>",
        "License: <a>GPL-3.0-or-later</a>"
    );
    assert_eq!(
        run_ok(json!({
            "operation": "parse-library-html",
            "html": html,
            "plugin": "Bogaudio",
            "model": "Bogaudio-ADSR"
        })),
        json!({
            "title": "Bogaudio & ADSR",
            "description": "Envelope",
            "screenshotUrl": "https://library.vcvrack.com/a.webp",
            "sourceUrl": "https://github.com/bogaudio/BogaudioModules",
            "license": "GPL-3.0-or-later",
            "version": "2.6.47"
        })
    );
    let parsed = run_ok(json!({
        "operation": "parse-library-html",
        "html": concat!(
            "<meta property=\"og:image\" content=\"http://example.com/x\">",
            "<a href=\"https://user:secret@github.com/repo\">Source code</a>"
        ),
        "plugin": "A",
        "model": "B",
        "fallbackVersion": "2.0.0"
    }));
    assert_eq!(parsed["screenshotUrl"], "");
    assert!(parsed.get("sourceUrl").is_none());
    assert_eq!(parsed["version"], "2.0.0");
}
