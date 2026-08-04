mod support;

use assert_cmd::Command;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use support::TemporaryDirectory;

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

fn compile_fixture(label: &str, source: &str) {
    let temporary = TemporaryDirectory::new(label);
    let fixture = temporary.path().join("fixture.cpp");
    let object = temporary.path().join("fixture.o");
    fs::write(&fixture, source).expect("C++ fixture should be written");
    Command::new("em++")
        .args(["-std=c++20", "-c"])
        .arg(&fixture)
        .arg("-I")
        .arg(root().join("web-runtime/include"))
        .arg("-o")
        .arg(&object)
        .timeout(Duration::from_secs(60))
        .assert()
        .success();
    assert!(
        fs::metadata(object)
            .expect("compiler should create an object")
            .len()
            > 0
    );
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test web_runtime_header_contract -- --ignored"]
fn scalar_simd_fallbacks_do_not_make_ordinary_math_calls_ambiguous() {
    compile_fixture(
        "rack-web-math-overload",
        concat!(
            "#include \"rack_web.hpp\"\n",
            "using namespace rack;\nusing namespace rack::simd;\n",
            "float exercise(float value) { int32_4 lanes{1, 2, 3, 4}; ",
            "return sqrt(value) + tan(value) + abs(value) + floor(value) + ",
            "pow(value, 2.f) + fmod(value, 2) + lanes[3]; }\n"
        ),
    );
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test web_runtime_header_contract -- --ignored"]
fn protected_process_overrides_dispatch_through_the_public_module_interface() {
    compile_fixture(
        "rack-web-protected-process",
        concat!(
            "#include \"rack_web_export.hpp\"\n",
            "struct ProtectedProcessModule : Module { ",
            "enum { NUM_PARAMS }; enum { NUM_INPUTS }; ",
            "enum { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum { NUM_LIGHTS }; ",
            "ProtectedProcessModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } ",
            "protected: void process(const ProcessArgs&) override { ",
            "outputs[SIGNAL_OUTPUT].setVoltage(7.f); } };\n",
            "RACK_WEB_EXPORTS(ProtectedProcessModule)\n"
        ),
    );
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test web_runtime_header_contract -- --ignored"]
fn glfw_modifier_key_codes_match_exact_source_hotkey_modules() {
    compile_fixture(
        "rack-web-glfw-modifiers",
        concat!(
            "#include \"rack_web.hpp\"\n",
            "static_assert(GLFW_KEY_LEFT_SHIFT == 340 && GLFW_KEY_LEFT_CONTROL == 341 ",
            "&& GLFW_KEY_LEFT_ALT == 342 && GLFW_KEY_LEFT_SUPER == 343);\n",
            "static_assert(GLFW_KEY_RIGHT_SHIFT == 344 && GLFW_KEY_RIGHT_CONTROL == 345 ",
            "&& GLFW_KEY_RIGHT_ALT == 346 && GLFW_KEY_RIGHT_SUPER == 347);\n",
            "int modifierKey(int key) { return key == GLFW_KEY_LEFT_SUPER ",
            "|| key == GLFW_KEY_RIGHT_SUPER || key == GLFW_KEY_LEFT_SHIFT ",
            "|| key == GLFW_KEY_RIGHT_SHIFT || key == GLFW_KEY_LEFT_CONTROL ",
            "|| key == GLFW_KEY_RIGHT_CONTROL || key == GLFW_KEY_LEFT_ALT ",
            "|| key == GLFW_KEY_RIGHT_ALT; }\n"
        ),
    );
}
