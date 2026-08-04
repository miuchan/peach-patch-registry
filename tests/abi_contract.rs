use peach_cli::compiler::RACK_WEB_EXPORTED_FUNCTIONS;
use regex::Regex;
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::process::{Command, Stdio};

fn run_abi_command(subcommand: &str, request: Value) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(["abi", subcommand, "--format", "json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("ABI command should start");
    child
        .stdin
        .take()
        .expect("ABI stdin should be piped")
        .write_all(request.to_string().as_bytes())
        .expect("ABI request should be written");
    child.wait_with_output().expect("ABI command should exit")
}

fn run_abi_request(request: Value) -> std::process::Output {
    run_abi_command("wrapper", request)
}

#[test]
fn rust_abi_wrapper_matches_the_stable_browser_tail_contract() {
    let output = run_abi_request(serde_json::json!({
        "moduleType": "fixture::TemplateRoute<std::pair<int, int>, 1, 4>",
        "paramCount": 3,
        "inputCount": 2,
        "outputCount": 5,
        "lightCount": 7
    }));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout).expect("ABI report should be JSON");
    assert_eq!(
        report["source"],
        "template <> struct RackWebModuleTraits<fixture::TemplateRoute<std::pair<int, int>, 1, 4>> { static constexpr int paramCount = 3; static constexpr int inputCount = 2; static constexpr int outputCount = 5; static constexpr int lightCount = 7; };\nRACK_WEB_EXPORTS(fixture::TemplateRoute<std::pair<int, int>, 1, 4>)"
    );
}

#[test]
fn rust_abi_wrapper_rejects_source_injection() {
    let output = run_abi_request(serde_json::json!({
        "moduleType": "Fixture; extern int compromised",
        "paramCount": 0,
        "inputCount": 0,
        "outputCount": 0,
        "lightCount": 0
    }));
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("unsupported syntax"),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn header_and_rust_compiler_share_one_complete_linked_abi() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let header = fs::read_to_string(root.join("web-runtime/include/rack_web_export.hpp"))
        .expect("Rack Web export header should be readable");
    let function = Regex::new(r"__attribute__\(\(used\)\)[^{;]*\b(rack_web_[A-Za-z0-9_]+)\s*\(")
        .expect("ABI function pattern should compile");
    let defined = function
        .captures_iter(&header)
        .map(|capture| format!("_{}", &capture[1]))
        .collect::<Vec<_>>();
    assert_eq!(defined.len(), 83);
    assert_eq!(
        defined,
        RACK_WEB_EXPORTED_FUNCTIONS
            .iter()
            .map(|value| (*value).to_owned())
            .collect::<Vec<_>>()
    );

    let adapter = fs::read_to_string(root.join("scripts/scaffold-library-module.mjs"))
        .expect("Node adapter should be readable");
    assert!(!adapter.contains("legacyRackWebAbiSource"));
    for removed in [
        "legacyExpandConfigCall",
        "legacyRackWebPortLayouts",
        "legacyRackWebIntegers",
        "legacyRackWebNumbers",
        "legacyRackWebStrings",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
    assert_eq!(
        adapter
            .matches("runRustSource([\"abi\",\"wrapper\"")
            .count(),
        1
    );
    assert!(!adapter.contains("linkedExportedFunctions"));
}

#[test]
fn rust_layout_matches_enum_assignment_repeat_and_terminal_semantics() {
    let output = run_abi_command(
        "layout",
        serde_json::json!({
            "constants": {
                "BASE": 2,
                "CHANNELS": 4,
                "input_count": 3,
                "unusedString": "ignored"
            },
            "enums": {
                "params": {
                    "identifiers": [
                        "BYPASS_PARAM",
                        "LEVEL_PARAM",
                        {"base": "BAND_PARAM", "count": "CHANNELS > 2 ? CHANNELS : 2"},
                        "NUM_PARAMS"
                    ],
                    "assignments": {
                        "LEVEL_PARAM": "BASE + 1",
                        "NUM_PARAMS": "BAND_PARAM + CHANNELS"
                    }
                },
                "inputs": {
                    "identifiers": [
                        {"base": "VOICE_INPUT", "count": "input_count"},
                        "NUM_INPUTS"
                    ]
                },
                "outputs": {
                    "identifiers": ["LEFT_OUTPUT", "RIGHT_OUTPUT", "OUTPUT_COUNT"],
                    "assignments": {"LEFT_OUTPUT": "1 << 1"}
                },
                "lights": {
                    "identifiers": ["ACTIVE_LIGHT", "LIGHT_COUNT"],
                    "assignments": {
                        "LIGHT_COUNT": "static_cast<int>(1 < 2 ? 3 : 4)"
                    }
                }
            }
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout).expect("layout should be JSON");
    assert_eq!(report["layouts"]["params"]["count"], 8);
    assert_eq!(
        report["layouts"]["params"]["ids"],
        serde_json::json!([
            {"name": "BYPASS_PARAM", "id": 0},
            {"name": "LEVEL_PARAM", "id": 3},
            {"name": "BAND_PARAM_1", "id": 4},
            {"name": "BAND_PARAM_2", "id": 5},
            {"name": "BAND_PARAM_3", "id": 6},
            {"name": "BAND_PARAM_4", "id": 7},
            {"name": "BAND_PARAM", "id": 4}
        ])
    );
    assert_eq!(report["layouts"]["inputs"]["count"], 3);
    assert_eq!(
        report["layouts"]["inputs"]["ids"],
        serde_json::json!([
            {"name": "VOICE_1_INPUT", "id": 0},
            {"name": "VOICE_2_INPUT", "id": 1},
            {"name": "VOICE_3_INPUT", "id": 2},
            {"name": "VOICE_INPUT", "id": 0}
        ])
    );
    assert_eq!(report["layouts"]["outputs"]["count"], 4);
    assert_eq!(report["layouts"]["lights"]["count"], 3);
}

#[test]
fn rust_layout_preserves_sequential_fallback_for_unsupported_expressions() {
    let output = run_abi_command(
        "layout",
        serde_json::json!({
            "constants": {},
            "enums": {
                "params": {
                    "identifiers": ["FIRST_PARAM", "SECOND_PARAM", "NUM_PARAMS"],
                    "assignments": {"FIRST_PARAM": "UNKNOWN | 4"}
                },
                "inputs": null,
                "outputs": null,
                "lights": null
            }
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout).expect("layout should be JSON");
    assert_eq!(report["layouts"]["params"]["count"], 2);
    assert_eq!(
        report["layouts"]["params"]["ids"],
        serde_json::json!([
            {"name": "FIRST_PARAM", "id": 0},
            {"name": "SECOND_PARAM", "id": 1}
        ])
    );
    assert!(report["layouts"]["inputs"].is_null());
}

#[test]
fn rust_layout_normalizes_supported_source_specific_numeric_forms() {
    let output = run_abi_command(
        "layout",
        serde_json::json!({
            "constants": {
                "FXConfig.extra": 2,
                "Layout::values.size()": 3
            },
            "enums": {
                "params": {
                    "identifiers": [
                        "OSC_PARAM",
                        {
                            "base": "FX_PARAM",
                            "count": "FXConfig<Mode>::extra() + Layout::values.size()"
                        },
                        "AFTER_PARAM",
                        "NUM_PARAMS"
                    ],
                    "assignments": {
                        "OSC_PARAM": "std::log2(8.0f) - 1u + VCOConfig<Mode>::additionalVCOParameterCount()"
                    }
                },
                "inputs": null,
                "outputs": null,
                "lights": null
            }
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout).expect("layout should be JSON");
    assert_eq!(report["layouts"]["params"]["count"], 9);
    assert_eq!(report["layouts"]["params"]["ids"][0]["id"], 2);
    assert_eq!(report["layouts"]["params"]["ids"][1]["id"], 3);
    assert_eq!(report["layouts"]["params"]["ids"][6]["id"], 3);
    assert_eq!(report["layouts"]["params"]["ids"][7]["id"], 8);
}

#[test]
fn rust_integer_evaluation_matches_supported_config_and_loop_expressions() {
    let output = run_abi_command(
        "integers",
        serde_json::json!({
            "constants": {
                "INPUTS": 1,
                "OUTPUTS": 4,
                "FXConfig.extra": 2
            },
            "expressions": [
                "INPUTS",
                "OUTPUTS + 1",
                "std::log2(8.0f)",
                "FXConfig<Mode>::extra() + 3",
                "1 < 2 ? 7 : 9",
                "'A'",
                "UNKNOWN_VALUE"
            ]
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("integer report should be JSON");
    assert_eq!(
        report["values"],
        serde_json::json!([1, 5, 3, 5, 7, 65, null])
    );
}

#[test]
fn rust_number_evaluation_matches_supported_parameter_metadata() {
    let output = run_abi_command(
        "numbers",
        serde_json::json!({
            "constants": {
                "RANGE": 2.5,
                "OFFSET": -0.25
            },
            "expressions": [
                "0.25f",
                "RANGE + OFFSET",
                "std::log2(0.125f)",
                "5.0 / 2.0",
                "1 < 2 ? -0.5 : 0.5",
                "'A' / 2",
                "UNKNOWN_VALUE"
            ]
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("number report should be JSON");
    assert_eq!(
        report["values"],
        serde_json::json!([0.25, 2.25, -3.0, 2.5, -0.5, 32.5, null])
    );
}

#[test]
fn rust_string_evaluation_matches_supported_configuration_names() {
    let output = run_abi_command(
        "strings",
        serde_json::json!({
            "constants": {
                "LABEL": "Level",
                "index": 2,
                "labels_2": "Output"
            },
            "expressions": [
                "LABEL",
                "\"Input \" + \"A\"",
                "std::string{\"Wrapped\"}",
                "\"Port \" + std::to_string(index + 1)",
                "string::f(\"Input %d\", index + 1)",
                "rack::string::f(\"Letter %c\", 'A')",
                "labels[index]",
                "dynamicLabel()"
            ]
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("string report should be JSON");
    assert_eq!(
        report["values"],
        serde_json::json!([
            "Level", "Input A", "Wrapped", "Port 3", "Input 3", "Letter A", "Output", null
        ])
    );
}

#[test]
fn rust_configuration_expansion_matches_counted_loop_and_binding_semantics() {
    let output = run_abi_command(
        "config-expansions",
        serde_json::json!({
            "constants": {
                "OUTPUTS": 4
            },
            "calls": [
                {
                    "argumentsSource": "index, label, \"index remains literal\"",
                    "loops": [{
                        "variable": "index",
                        "startExpression": "0",
                        "endExpression": "OUTPUTS"
                    }],
                    "stringBindings": [{
                        "name": "label",
                        "expression": "string::f(\"Output %d\", index + 1)"
                    }]
                },
                {
                    "argumentsSource": "dynamic, label",
                    "loops": [{
                        "variable": "dynamic",
                        "startExpression": "UNKNOWN_START",
                        "endExpression": "UNKNOWN_END"
                    }],
                    "stringBindings": []
                }
            ]
        }),
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout)
        .expect("configuration expansion report should be JSON");
    assert_eq!(
        report["expansions"],
        serde_json::json!([
            [
                "0, \"Output 1\", \"index remains literal\"",
                "1, \"Output 2\", \"index remains literal\"",
                "2, \"Output 3\", \"index remains literal\"",
                "3, \"Output 4\", \"index remains literal\""
            ],
            ["dynamic, label"]
        ])
    );
}
