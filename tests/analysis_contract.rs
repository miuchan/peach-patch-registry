mod support;

use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use support::TemporaryDirectory;

fn run(source: &Path) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "inventory",
            "--source-dir",
            source.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("inventory command should run")
}

fn run_files(source: &Path) -> std::process::Output {
    run_files_with_profile(source, "dependency")
}

fn run_files_with_profile(source: &Path, profile: &str) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "files",
            "--source-dir",
            source.to_str().expect("source path should be UTF-8"),
            "--profile",
            profile,
            "--format",
            "json",
        ])
        .output()
        .expect("dependency file inventory command should run")
}

fn run_makefile(source: &Path) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "makefile",
            "--source-dir",
            source.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("Makefile analysis command should run")
}

fn run_makefile_for(source: &Path, makefile: &str, variable: &str) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "makefile",
            "--source-dir",
            source.to_str().expect("source path should be UTF-8"),
            "--makefile",
            makefile,
            "--source-variable",
            variable,
            "--format",
            "json",
        ])
        .output()
        .expect("configured Makefile analysis command should run")
}

fn run_cmake(source: &Path) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "cmake",
            "--source-dir",
            source.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("CMake analysis command should run")
}

fn run_constants(request: Value) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(["analyze", "constants", "--format", "json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("constant analysis command should run");
    child
        .stdin
        .take()
        .expect("constant analysis stdin should be available")
        .write_all(request.to_string().as_bytes())
        .expect("constant analysis request should be written");
    child
        .wait_with_output()
        .expect("constant analysis should finish")
}

fn run_preprocess(request: Value) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(["analyze", "preprocess", "--format", "json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("preprocessor command should run");
    child
        .stdin
        .take()
        .expect("preprocessor stdin should be available")
        .write_all(request.to_string().as_bytes())
        .expect("preprocessor request should be written");
    child
        .wait_with_output()
        .expect("preprocessor should finish")
}

fn run_declarations(request: Value) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(["analyze", "declarations", "--format", "json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("declaration analysis command should run");
    child
        .stdin
        .take()
        .expect("declaration analysis stdin should be available")
        .write_all(request.to_string().as_bytes())
        .expect("declaration analysis request should be written");
    child
        .wait_with_output()
        .expect("declaration analysis should finish")
}

#[test]
fn declaration_analysis_reports_structured_types_and_enums_for_active_source() {
    let source = r#"#include "Dsp.hpp"
# include "Spaced.hpp"
#include <array>
#pragma once
#define ACTIVE_GAIN 2
# define MAKE_PAIR(left, right) \
    left, \
    right
// #define COMMENTED_GAIN 9
// #include "Comment.hpp"
const char* marker = "😀 #include <literal.hpp>";
namespace outer {
float declaredHelper(float value = 1.f);
bool comparisonNoexcept() noexcept(sizeof(int) < 8);
inline constexpr float GlobalScale = 2.f;
template <typename Engine, int Channels = 2>
struct Module final : Base<Engine>, Interface<Channels> {
static constexpr int MemberScale = 3;
enum class ParamIds : unsigned {
FIRST_PARAM = 2,
MULTIPLE(BAND_PARAM, Channels),
NUM_PARAMS
};
Module() {
const int LocalScale = 4;
config(NUM_PARAMS, Channels, 1, 0);
configParam<Quantity>(FIRST_PARAM, 0.f, 1.f, .5f, "Level");
for (int channel = 0; channel < Channels; channel++) {
auto label = string::f("Input %d", channel + 1);
configInput(channel, label);
getParamQuantity(channel)->snapEnabled = true;
}

}
void reset();
};
template <typename Engine, int Channels>
void Module<Engine, Channels>::reset() {}
using DefaultModule = Module<float, 2>;
enum OutputIds { LEFT_OUTPUT, RIGHT_OUTPUT = 1 << 2, NUM_OUTPUTS };
static float helperTail(float value) { return value; }
static float helperHead(float value) { return helperTail(value); }
}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let includes = report["includeDirectives"]
        .as_array()
        .expect("includeDirectives should be an array");
    assert_eq!(includes.len(), 3, "{includes:#?}");
    assert_eq!(includes[0]["include"], "Dsp.hpp");
    assert_eq!(includes[0]["angle"], false);
    assert_eq!(includes[1]["include"], "Spaced.hpp");
    assert_eq!(includes[1]["angle"], false);
    assert_eq!(includes[2]["include"], "array");
    assert_eq!(includes[2]["angle"], true);
    let include_start = source.find("Dsp.hpp").expect("quoted include should exist");
    assert_eq!(
        includes[0]["start"],
        source[..include_start].encode_utf16().count()
    );
    let directives = report["preprocessorDirectives"]
        .as_array()
        .expect("preprocessorDirectives should be an array");
    assert_eq!(directives.len(), 6, "{directives:#?}");
    assert_eq!(directives[0]["kind"], "include");
    assert_eq!(directives[0]["commented"], false);
    assert_eq!(directives[2]["kind"], "pragma");
    assert_eq!(directives[3]["kind"], "define");
    assert_eq!(directives[4]["kind"], "define");
    assert_eq!(directives[4]["commented"], true);
    assert_eq!(directives[5]["kind"], "include");
    assert_eq!(directives[5]["commented"], true);
    let pragma_start = source.find("#pragma").expect("pragma should exist");
    let pragma_end = pragma_start + "#pragma once".len();
    assert_eq!(
        directives[2]["start"],
        source[..pragma_start].encode_utf16().count()
    );
    assert_eq!(
        directives[2]["end"],
        source[..pragma_end].encode_utf16().count()
    );
    let macros = report["macroDefinitions"]
        .as_array()
        .expect("macroDefinitions should be an array");
    assert_eq!(macros.len(), 3, "{macros:#?}");
    assert_eq!(macros[0]["name"], "ACTIVE_GAIN");
    assert_eq!(macros[0]["functionLike"], false);
    assert_eq!(macros[0]["parameters"], serde_json::json!([]));
    assert_eq!(macros[0]["replacement"], "2");
    assert_eq!(macros[0]["commented"], false);
    assert_eq!(macros[1]["name"], "MAKE_PAIR");
    assert_eq!(macros[1]["functionLike"], true);
    assert_eq!(
        macros[1]["parameters"],
        serde_json::json!(["left", "right"])
    );
    assert_eq!(macros[1]["replacement"], "left, right");
    assert_eq!(macros[1]["commented"], false);
    assert_eq!(macros[2]["name"], "COMMENTED_GAIN");
    assert_eq!(macros[2]["commented"], true);
    let macro_start = source
        .find("# define MAKE_PAIR")
        .expect("macro should exist");
    let macro_end = source[macro_start..]
        .find("right\n")
        .map(|offset| macro_start + offset + "right".len())
        .expect("macro should end");
    assert_eq!(
        macros[1]["start"],
        source[..macro_start].encode_utf16().count()
    );
    assert_eq!(macros[1]["end"], source[..macro_end].encode_utf16().count());
    let declarations = report["typeDeclarations"]
        .as_array()
        .expect("typeDeclarations should be an array");
    assert_eq!(declarations.len(), 1);
    assert_eq!(declarations[0]["name"], "Module");
    assert_eq!(declarations[0]["namespace"], serde_json::json!(["outer"]));
    assert_eq!(declarations[0]["namespaceScope"], true);
    assert_eq!(
        declarations[0]["templateParameters"],
        serde_json::json!(["Engine", "Channels"])
    );
    assert_eq!(
        declarations[0]["bases"],
        serde_json::json!(["Base<Engine>", "Interface<Channels>"])
    );
    let module_start = source.find("Module final").expect("module should exist");
    assert_eq!(
        declarations[0]["start"],
        source[..module_start].encode_utf16().count()
    );
    let enumerations = report["enumDeclarations"]
        .as_array()
        .expect("enumDeclarations should be an array");
    assert_eq!(enumerations.len(), 2);
    assert_eq!(enumerations[0]["name"], "ParamIds");
    assert_eq!(enumerations[0]["namespaceScope"], false);
    assert_eq!(
        enumerations[0]["owners"],
        serde_json::json!([{"name": "Module", "templateParameters": ["Engine", "Channels"]}])
    );
    assert_eq!(
        enumerations[0]["identifiers"],
        serde_json::json!([
            "FIRST_PARAM",
            {"base": "BAND_PARAM", "count": "Channels"},
            "NUM_PARAMS"
        ])
    );
    assert_eq!(
        enumerations[0]["assignments"],
        serde_json::json!({"FIRST_PARAM": "2"})
    );
    assert_eq!(enumerations[0]["complete"], true);
    assert_eq!(enumerations[1]["name"], "OutputIds");
    assert_eq!(enumerations[1]["namespace"], serde_json::json!(["outer"]));
    assert_eq!(enumerations[1]["namespaceScope"], true);
    assert_eq!(enumerations[1]["owners"], serde_json::json!([]));
    let namespace_constants = report["namespaceConstantDeclarations"]
        .as_array()
        .expect("namespaceConstantDeclarations should be an array");
    assert_eq!(namespace_constants.len(), 2, "{namespace_constants:#?}");
    assert_eq!(namespace_constants[0]["name"], "marker");
    assert_eq!(namespace_constants[0]["namespace"], serde_json::json!([]));
    assert_eq!(namespace_constants[1]["name"], "GlobalScale");
    assert_eq!(
        namespace_constants[1]["namespace"],
        serde_json::json!(["outer"])
    );
    let global_scale_start = source
        .find("inline constexpr float GlobalScale")
        .expect("namespace constant should exist");
    let global_scale_end = source[global_scale_start..]
        .find(';')
        .map(|offset| global_scale_start + offset + 1)
        .expect("namespace constant should end");
    assert_eq!(
        namespace_constants[1]["start"],
        source[..global_scale_start].encode_utf16().count()
    );
    assert_eq!(
        namespace_constants[1]["end"],
        source[..global_scale_end].encode_utf16().count()
    );
    let config_calls = report["configCalls"]
        .as_array()
        .expect("configCalls should be an array");
    assert_eq!(config_calls.len(), 4);
    assert_eq!(config_calls[0]["name"], "config");
    assert_eq!(
        config_calls[0]["arguments"],
        serde_json::json!(["NUM_PARAMS", "Channels", "1", "0"])
    );
    assert_eq!(config_calls[1]["name"], "configParam");
    assert_eq!(config_calls[1]["templateSource"], "Quantity");
    assert_eq!(config_calls[2]["name"], "configInput");
    assert_eq!(
        config_calls[2]["owners"],
        serde_json::json!([{"name": "Module", "templateParameters": ["Engine", "Channels"]}])
    );
    assert_eq!(config_calls[2]["loops"].as_array().map(Vec::len), Some(1));
    assert_eq!(config_calls[2]["loops"][0]["variable"], "channel");
    assert_eq!(config_calls[2]["loops"][0]["startExpression"], "0");
    assert_eq!(config_calls[2]["loops"][0]["endExpression"], "Channels");
    assert_eq!(
        config_calls[2]["stringBindings"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(config_calls[2]["stringBindings"][0]["name"], "label");
    assert_eq!(config_calls[3]["name"], "rackWebSnapParam");
    assert_eq!(config_calls[3]["arguments"], serde_json::json!(["channel"]));
    assert_eq!(config_calls[3]["synthetic"], true);
    assert_eq!(config_calls[3]["loops"].as_array().map(Vec::len), Some(1));
    assert_eq!(
        config_calls[2]["stringBindings"][0]["expression"],
        "string::f(\"Input %d\", channel + 1)"
    );
    let free_functions = report["freeFunctionDefinitions"]
        .as_array()
        .expect("freeFunctionDefinitions should be an array");
    assert_eq!(free_functions.len(), 2);
    assert_eq!(free_functions[0]["name"], "helperTail");
    assert_eq!(free_functions[1]["name"], "helperHead");
    assert_eq!(
        free_functions[0]["signature"],
        "static float helperTail(float value)"
    );
    assert_eq!(
        free_functions[0]["declarationSignature"],
        "static float helperTail(float value)"
    );
    assert_eq!(
        free_functions[1]["signature"],
        "static float helperHead(float value)"
    );
    assert_eq!(free_functions[1]["namespace"], serde_json::json!(["outer"]));
    assert!(free_functions[1]["references"]
        .as_array()
        .is_some_and(|references| references.iter().any(|value| value == "helperTail")));
    let helper_start = source
        .find("static float helperHead")
        .expect("helper should exist");
    assert_eq!(
        free_functions[1]["start"],
        source[..helper_start].encode_utf16().count()
    );
    let free_function_declarations = report["freeFunctionDeclarations"]
        .as_array()
        .expect("freeFunctionDeclarations should be an array");
    assert_eq!(free_function_declarations.len(), 2);
    assert_eq!(free_function_declarations[0]["name"], "declaredHelper");
    assert_eq!(free_function_declarations[1]["name"], "comparisonNoexcept");
    assert_eq!(
        free_function_declarations[0]["namespace"],
        serde_json::json!(["outer"])
    );
    let declaration_start = source
        .find("float declaredHelper")
        .expect("free-function declaration should exist");
    let declaration_end = source[declaration_start..]
        .find(';')
        .map(|offset| declaration_start + offset + 1)
        .expect("free-function declaration should end");
    assert_eq!(
        free_function_declarations[0]["start"],
        source[..declaration_start].encode_utf16().count()
    );
    assert_eq!(
        free_function_declarations[0]["end"],
        source[..declaration_end].encode_utf16().count()
    );
    let out_of_line = report["outOfLineDefinitions"]
        .as_array()
        .expect("outOfLineDefinitions should be an array");
    assert_eq!(out_of_line.len(), 1);
    assert_eq!(out_of_line[0]["owner"], "Module");
    assert_eq!(out_of_line[0]["ownerChain"], serde_json::json!(["Module"]));
    assert_eq!(out_of_line[0]["kind"], "function");
    assert_eq!(out_of_line[0]["member"], "reset");
    assert_eq!(out_of_line[0]["callableKind"], "function");
    assert_eq!(out_of_line[0]["namespace"], serde_json::json!(["outer"]));
    assert_eq!(
        out_of_line[0]["signature"],
        "template <typename Engine, int Channels> void Module<Engine, Channels>::reset()"
    );
    let reset_start = source
        .find("template <typename Engine, int Channels>\nvoid Module")
        .expect("out-of-line reset should exist");
    assert_eq!(
        out_of_line[0]["start"],
        source[..reset_start].encode_utf16().count()
    );
    let reset_open = source[reset_start..]
        .find('{')
        .map(|offset| reset_start + offset)
        .expect("out-of-line reset body should open");
    assert_eq!(
        out_of_line[0]["bodyStart"],
        source[..reset_open + 1].encode_utf16().count()
    );
    assert_eq!(
        out_of_line[0]["bodyEnd"],
        source[..reset_open + 1].encode_utf16().count()
    );
    let aliases = report["typeAliases"]
        .as_array()
        .expect("typeAliases should be an array");
    assert_eq!(aliases.len(), 1);
    assert_eq!(aliases[0]["name"], "DefaultModule");
    assert_eq!(aliases[0]["target"], "Module<float, 2>");
    assert_eq!(aliases[0]["kind"], "using");
    assert_eq!(aliases[0]["namespace"], serde_json::json!(["outer"]));
    assert_eq!(aliases[0]["namespaceScope"], true);
    assert!(aliases[0]["declarationStart"].as_u64().is_some());
    assert!(aliases[0]["declarationEnd"].as_u64().is_some());
}

#[test]
fn include_inventory_reports_unique_raw_names_without_comment_or_literal_false_positives() {
    let temporary = TemporaryDirectory::new("analysis-include-inventory");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(root.join("src")).expect("source directory should be created");
    fs::write(
        root.join("src/Module.cpp"),
        r##"#include "Quoted.hpp"
# include <vendor/Spaced.hpp>
// #include "Comment.hpp"
const char* literal = "#include <Literal.hpp>";
"##,
    )
    .expect("module source should be written");
    fs::write(
        root.join("src/Quoted.hpp"),
        "#pragma once\n#include <vendor/Spaced.hpp>\n",
    )
    .expect("header source should be written");
    let output = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "includes",
            "--source-dir",
            root.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("include inventory command should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("include inventory should be JSON");
    assert_eq!(
        Path::new(
            report["sourceRoot"]
                .as_str()
                .expect("sourceRoot should exist")
        ),
        fs::canonicalize(&root).expect("source root should resolve")
    );
    assert_eq!(
        report["includes"],
        serde_json::json!(["Quoted.hpp", "vendor/Spaced.hpp"])
    );
}

#[test]
fn makefile_analysis_reports_safe_compile_inputs_and_conditional_definitions() {
    let temporary = TemporaryDirectory::new("analysis-makefile");
    let root = temporary.path().join("plugin");
    let source = root.join("src");
    let include = root.join("include");
    let spaced_include = root.join("vendor include");
    let outside = temporary.path().join("outside.cpp");
    let outside_include = temporary.path().join("outside-include");
    fs::create_dir_all(&source).expect("source directory should be created");
    fs::create_dir_all(&include).expect("include directory should be created");
    fs::create_dir_all(&spaced_include).expect("spaced include directory should be created");
    fs::create_dir_all(&outside_include).expect("outside include directory should be created");
    for file in ["base.cpp", "extra.c", "more.cc"] {
        fs::write(source.join(file), "int fixture;\n").expect("source file should be written");
    }
    fs::write(&outside, "int outside;\n").expect("outside source should be written");
    fs::write(
        root.join("Makefile"),
        "FLAGS += -DROOT_FLAG=2 -Iinclude -I\"vendor include\" -I../outside-include\\\n\
         -DROOT_CONTINUED\n\
ifndef DISABLED\n\
FLAGS += -DCONDITIONAL_FLAG=1\n\
endif\n\
COMMON = src/base.cpp\n\
SOURCES = $(COMMON) src/extra.c ../outside.cpp missing.cpp\n\
SOURCES += src/more.cc\n",
    )
    .expect("Makefile should be written");
    let output = run_makefile(&root);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("Makefile analysis report should be JSON");
    assert_eq!(
        Path::new(
            report["sourceRoot"]
                .as_str()
                .expect("sourceRoot should exist")
        ),
        fs::canonicalize(&root).expect("source root should resolve")
    );
    assert_eq!(
        Path::new(report["makefile"].as_str().expect("Makefile should exist")),
        fs::canonicalize(root.join("Makefile")).expect("Makefile should resolve")
    );
    assert_eq!(report["sourceVariables"], serde_json::json!(["SOURCES"]));
    assert_eq!(
        report["compileDefinitions"],
        serde_json::json!(["-DROOT_FLAG=2", "-DROOT_CONTINUED"])
    );
    assert_eq!(
        report["allCompileDefinitions"],
        serde_json::json!(["-DROOT_FLAG=2", "-DROOT_CONTINUED", "-DCONDITIONAL_FLAG=1"])
    );
    assert_eq!(
        report["includeDirectories"],
        serde_json::json!([
            fs::canonicalize(include).expect("include directory should resolve"),
            fs::canonicalize(spaced_include).expect("spaced include directory should resolve")
        ])
    );
    assert_eq!(
        report["implementationSources"],
        serde_json::json!([
            fs::canonicalize(source.join("base.cpp")).expect("base source should resolve"),
            fs::canonicalize(source.join("extra.c")).expect("C source should resolve"),
            fs::canonicalize(source.join("more.cc")).expect("C++ source should resolve")
        ])
    );
}

#[test]
fn makefile_analysis_supports_checkout_confined_nested_source_variables() {
    let temporary = TemporaryDirectory::new("analysis-nested-makefile");
    let root = temporary.path().join("plugin");
    let chuck = root.join("chuck/src");
    let core = chuck.join("core");
    fs::create_dir_all(&core).expect("nested source directory should be created");
    for file in ["runtime.cpp", "helper.cc"] {
        fs::write(core.join(file), "int fixture;\n").expect("nested source should be written");
    }
    fs::write(temporary.path().join("outside.cpp"), "int outside;\n")
        .expect("outside source should be written");
    fs::write(
        chuck.join("makefile"),
        "CORE = core/runtime.cpp\n\
EMSCRIPTENSRCS = $(CORE) core/helper.cc ../../../outside.cpp\n",
    )
    .expect("nested Makefile should be written");
    let output = run_makefile_for(&root, "chuck/src/makefile", "EMSCRIPTENSRCS");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout)
        .expect("configured Makefile analysis report should be JSON");
    assert_eq!(
        report["sourceVariables"],
        serde_json::json!(["EMSCRIPTENSRCS"])
    );
    assert_eq!(
        report["implementationSources"],
        serde_json::json!([
            fs::canonicalize(core.join("runtime.cpp")).expect("runtime source should resolve"),
            fs::canonicalize(core.join("helper.cc")).expect("helper source should resolve")
        ])
    );
    let escaping = run_makefile_for(&root, "../outside-makefile", "EMSCRIPTENSRCS");
    assert!(!escaping.status.success());
    assert!(String::from_utf8_lossy(&escaping.stderr).contains("Unsafe Makefile path"));
}

#[test]
fn cmake_analysis_reports_bounded_cache_definitions() {
    let temporary = TemporaryDirectory::new("analysis-cmake");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(&root).expect("source directory should be created");
    fs::write(
        root.join("CMakeLists.txt"),
        "set(ENABLE_ENGINE TRUE CACHE BOOL \"engine\")\n\
set(VOICE_COUNT 16 CACHE STRING \"voices\")\n\
set(DISABLE_UI FALSE CACHE BOOL \"UI\")\n\
set(IGNORED text CACHE STRING \"not bounded\")\n\
# set(COMMENTED 1 CACHE BOOL \"comment remains conservative\")\n",
    )
    .expect("CMake metadata should be written");
    let output = run_cmake(&root);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("CMake analysis report should be JSON");
    assert_eq!(
        Path::new(
            report["sourceRoot"]
                .as_str()
                .expect("sourceRoot should exist")
        ),
        fs::canonicalize(&root).expect("source root should resolve")
    );
    assert_eq!(
        Path::new(
            report["cmakeLists"]
                .as_str()
                .expect("CMakeLists should exist")
        ),
        fs::canonicalize(root.join("CMakeLists.txt")).expect("CMake metadata should resolve")
    );
    assert_eq!(
        report["compileDefinitions"],
        serde_json::json!([
            "-DENABLE_ENGINE=1",
            "-DVOICE_COUNT=16",
            "-DDISABLE_UI=0",
            "-DCOMMENTED=1"
        ])
    );
}

#[test]
fn declaration_macro_analysis_ignores_block_comments_and_raw_string_literals() {
    let source = r####"#define ACTIVE_VALUE 2
// #define COMMENTED_VALUE 3
/*
#define BLOCK_COMMENT_VALUE 4
*/
const char* text = R"fixture(
#define RAW_STRING_VALUE 5
)fixture";
"####;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let macros = report["macroDefinitions"]
        .as_array()
        .expect("macroDefinitions should be an array");
    assert_eq!(macros.len(), 2, "{macros:#?}");
    assert_eq!(macros[0]["name"], "ACTIVE_VALUE");
    assert_eq!(macros[0]["commented"], false);
    assert_eq!(macros[1]["name"], "COMMENTED_VALUE");
    assert_eq!(macros[1]["commented"], true);
}

#[test]
fn declaration_analysis_reports_conditional_directives_and_header_guard_ranges() {
    let source = "const char* marker = \"😀\";\r\n\
#ifndef CLASSIC_GUARD\r\n\
#define CLASSIC_GUARD 1\r\n\
#if ACTIVE_BRANCH\r\n\
#elif ! FALLBACK_BRANCH\r\n\
#endif\r\n\
#endif\r\n\
# if ! defined (SPACED_GUARD) // include guard\r\n\
# define SPACED_GUARD\r\n\
#endif\r\n\
/*\r\n\
#if BLOCK_COMMENT_BRANCH\r\n\
#endif\r\n\
*/\r\n\
const char* raw = R\"fixture(\r\n\
#ifndef RAW_STRING_GUARD\r\n\
#define RAW_STRING_GUARD\r\n\
#endif\r\n\
)fixture\";\r\n\
#ifndef OPEN_GUARD\r\n\
#define OPEN_GUARD\r\n";
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let conditionals = report["conditionalDirectives"]
        .as_array()
        .expect("conditionalDirectives should be an array");
    assert_eq!(conditionals.len(), 8, "{conditionals:#?}");
    assert_eq!(conditionals[0]["kind"], "ifndef");
    assert_eq!(conditionals[0]["expression"], "CLASSIC_GUARD");
    assert_eq!(conditionals[0]["simpleMacro"], "CLASSIC_GUARD");
    assert_eq!(conditionals[0]["negated"], true);
    assert_eq!(conditionals[1]["kind"], "if");
    assert_eq!(conditionals[1]["simpleMacro"], "ACTIVE_BRANCH");
    assert_eq!(conditionals[1]["negated"], false);
    assert_eq!(conditionals[2]["kind"], "elif");
    assert_eq!(conditionals[2]["simpleMacro"], "FALLBACK_BRANCH");
    assert_eq!(conditionals[2]["negated"], true);
    assert_eq!(
        conditionals[5]["expression"],
        "! defined (SPACED_GUARD) // include guard"
    );
    assert_eq!(conditionals[5]["simpleMacro"], Value::Null);
    assert_eq!(conditionals[5]["negated"], true);
    assert!(conditionals
        .iter()
        .all(|candidate| candidate["expression"] != "BLOCK_COMMENT_BRANCH"));
    let blocks = report["conditionalBlocks"]
        .as_array()
        .expect("conditionalBlocks should be an array");
    assert_eq!(blocks.len(), 4, "{blocks:#?}");
    assert_eq!(blocks[0]["openStart"], conditionals[0]["start"]);
    assert_eq!(blocks[0]["closeStart"], conditionals[4]["start"]);
    assert_eq!(blocks[1]["openStart"], conditionals[1]["start"]);
    assert_eq!(blocks[1]["closeStart"], conditionals[3]["start"]);
    assert_eq!(blocks[2]["openStart"], conditionals[5]["start"]);
    assert_eq!(blocks[2]["closeStart"], conditionals[6]["start"]);
    assert_eq!(blocks[3]["openStart"], conditionals[7]["start"]);
    assert_eq!(blocks[3]["closeStart"], Value::Null);
    assert_eq!(blocks[3]["closeEnd"], Value::Null);
    let guards = report["headerGuards"]
        .as_array()
        .expect("headerGuards should be an array");
    assert_eq!(guards.len(), 3, "{guards:#?}");
    assert_eq!(guards[0]["name"], "CLASSIC_GUARD");
    assert_eq!(guards[1]["name"], "SPACED_GUARD");
    assert_eq!(guards[2]["name"], "OPEN_GUARD");
    assert_eq!(guards[2]["closeStart"], Value::Null);
    assert_eq!(guards[2]["closeEnd"], Value::Null);
    let spaced_start = source
        .find("# if ! defined")
        .expect("spaced include guard should exist");
    assert_eq!(
        guards[1]["openStart"],
        source[..spaced_start].encode_utf16().count()
    );
    let spaced_close = source[spaced_start..]
        .find("#endif")
        .map(|offset| spaced_start + offset)
        .expect("spaced include guard close should exist");
    assert_eq!(
        guards[1]["closeStart"],
        source[..spaced_close].encode_utf16().count()
    );
}

#[test]
fn declaration_analysis_reports_repeated_default_argument_removal_ranges() {
    let source = r#"const char* marker = "😀";
namespace left {
void configure(
    std::array<int, 2> value = std::array<int, 2>{1, 2},
    bool enabled = (1 == 1),
    const char* label = "left,right"
);
void configure(
    std::array<int, 2> value = std::array<int, 2>{1, 2},
    bool enabled = (1 == 1),
    const char* label = "left,right"
) {}
void overload(int value = 1);
void overload(float value = 1) {}
}
namespace right {
void configure(
    std::array<int, 2> value = std::array<int, 2>{1, 2},
    bool enabled = (1 == 1),
    const char* label = "left,right"
) {}
}
void standalone(int value = 3) {}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let ranges = report["repeatedDefaultArgumentRanges"]
        .as_array()
        .expect("repeatedDefaultArgumentRanges should be an array");
    assert_eq!(ranges.len(), 3, "{ranges:#?}");
    let definitions = report["freeFunctionDefinitions"]
        .as_array()
        .expect("freeFunctionDefinitions should be an array");
    assert_eq!(
        definitions[0]["declarationSignature"],
        "void configure(\n    std::array<int, 2> value,\n    bool enabled,\n    const char* label\n)"
    );
    assert_eq!(
        definitions[1]["declarationSignature"],
        "void overload(float value)"
    );
    let utf16 = source.encode_utf16().collect::<Vec<_>>();
    let mut parsed_ranges = ranges
        .iter()
        .map(|range| {
            let start = range["start"]
                .as_u64()
                .expect("range start should be an integer") as usize;
            let end = range["end"]
                .as_u64()
                .expect("range end should be an integer") as usize;
            let removed = String::from_utf16(&utf16[start..end])
                .expect("default-argument range should be valid UTF-16");
            assert!(removed.contains('='), "{removed:?}");
            (start, end)
        })
        .collect::<Vec<_>>();
    let mut normalized = utf16;
    for (start, end) in parsed_ranges.drain(..).rev() {
        normalized.drain(start..end);
    }
    let normalized =
        String::from_utf16(&normalized).expect("normalized source should remain valid UTF-16");
    assert!(normalized.contains(
        "void configure(\n    std::array<int, 2> value,\n    bool enabled,\n    const char* label\n) {}"
    ));
    assert_eq!(
        normalized
            .matches("value = std::array<int, 2>{1, 2}")
            .count(),
        2
    );
    assert_eq!(normalized.matches("bool enabled = (1 == 1)").count(), 2);
    assert_eq!(
        normalized
            .matches("const char* label = \"left,right\"")
            .count(),
        2
    );
    assert!(normalized.contains("void overload(float value = 1) {}"));
    assert!(normalized.contains("void standalone(int value = 3) {}"));
}

#[test]
fn declaration_analysis_distinguishes_namespace_scope_types() {
    let source = r#"namespace fixture {
using GlobalAlias = float;
enum GlobalMode { GLOBAL_OFF, GLOBAL_ON };
struct GlobalQuantity : rack::engine::ParamQuantity {};
struct Owner {
using NestedAlias = int;
enum NestedMode { NESTED_OFF, NESTED_ON };
struct NestedQuantity : ParamQuantity {};
};
void build() {
using LocalAlias = double;
enum LocalMode { LOCAL_OFF, LOCAL_ON };
struct LocalQuantity : ParamQuantity {};
}
}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let declarations = report["typeDeclarations"]
        .as_array()
        .expect("typeDeclarations should be an array");
    let namespace_scope = declarations
        .iter()
        .map(|declaration| {
            (
                declaration["name"]
                    .as_str()
                    .expect("declaration should have a name"),
                declaration["namespaceScope"]
                    .as_bool()
                    .expect("declaration should report namespace scope"),
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    assert_eq!(namespace_scope.get("GlobalQuantity"), Some(&true));
    assert_eq!(namespace_scope.get("Owner"), Some(&true));
    assert_eq!(namespace_scope.get("NestedQuantity"), Some(&false));
    assert_eq!(namespace_scope.get("LocalQuantity"), Some(&false));
    let alias_scope = report["typeAliases"]
        .as_array()
        .expect("typeAliases should be an array")
        .iter()
        .map(|alias| {
            (
                alias["name"].as_str().expect("alias should have a name"),
                alias["namespaceScope"]
                    .as_bool()
                    .expect("alias should report namespace scope"),
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    assert_eq!(alias_scope.get("GlobalAlias"), Some(&true));
    assert_eq!(alias_scope.get("NestedAlias"), Some(&false));
    assert_eq!(alias_scope.get("LocalAlias"), Some(&false));
    let enum_scope = report["enumDeclarations"]
        .as_array()
        .expect("enumDeclarations should be an array")
        .iter()
        .map(|enumeration| {
            (
                enumeration["name"]
                    .as_str()
                    .expect("enum should have a name"),
                enumeration["namespaceScope"]
                    .as_bool()
                    .expect("enum should report namespace scope"),
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    assert_eq!(enum_scope.get("GlobalMode"), Some(&true));
    assert_eq!(enum_scope.get("NestedMode"), Some(&false));
    assert_eq!(enum_scope.get("LocalMode"), Some(&false));
}

#[test]
fn declaration_analysis_excludes_inline_namespace_wrappers_from_member_definitions() {
    let source = "namespace fixture { float Message::sum() const { return 1.f; } }";
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let definitions = report["outOfLineDefinitions"]
        .as_array()
        .expect("outOfLineDefinitions should be an array");
    assert_eq!(definitions.len(), 1);
    let start = source
        .find("float Message")
        .expect("definition should exist");
    assert_eq!(
        definitions[0]["start"],
        source[..start].encode_utf16().count()
    );
    assert_eq!(definitions[0]["namespace"], serde_json::json!(["fixture"]));
    assert_eq!(definitions[0]["signature"], "float Message::sum() const");
}

#[test]
fn declaration_analysis_reports_inline_member_definition_body_ranges() {
    let source = r#"const char* decoy = "void Host::fake() { ignored; }";
namespace fixture {
struct Host {
    Host() { ready = true; }
    ~Host() { ready = false; }
    void guaranteeRackUserWavetablesDir() override {
        if (ready) { desktopOnly(); }
    }
    int declarationOnly(int value);
    struct Nested {
        inline int scale(int value) const noexcept { return value * 2; }
    };
};
}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let definitions = report["inlineMemberDefinitions"]
        .as_array()
        .expect("inlineMemberDefinitions should be an array");
    assert_eq!(definitions.len(), 4, "{definitions:#?}");
    assert_eq!(definitions[0]["member"], "Host");
    assert_eq!(definitions[0]["callableKind"], "constructor");
    assert_eq!(definitions[1]["member"], "~Host");
    assert_eq!(definitions[1]["callableKind"], "destructor");
    assert_eq!(definitions[2]["owner"], "Host");
    assert_eq!(definitions[2]["ownerChain"], serde_json::json!(["Host"]));
    assert_eq!(
        definitions[2]["signature"],
        "void guaranteeRackUserWavetablesDir() override"
    );
    assert_eq!(definitions[2]["callableKind"], "function");
    assert_eq!(definitions[3]["owner"], "Nested");
    assert_eq!(
        definitions[3]["ownerChain"],
        serde_json::json!(["Host", "Nested"])
    );
    assert_eq!(
        definitions[3]["signature"],
        "inline int scale(int value) const noexcept"
    );
    for definition in definitions {
        let body_start = definition["bodyStart"]
            .as_u64()
            .expect("inline body start should be an integer") as usize;
        let body_end = definition["bodyEnd"]
            .as_u64()
            .expect("inline body end should be an integer") as usize;
        let utf16 = source.encode_utf16().collect::<Vec<_>>();
        assert_eq!(utf16[body_start - 1], b'{' as u16);
        assert_eq!(utf16[body_end], b'}' as u16);
    }
}

#[test]
fn declaration_analysis_reports_namespace_variables_and_using_declarations() {
    let source = r#"const char* marker = "😀 extern const float fake;";
namespace outer {
extern const float declaredOnly;
extern const float initializedExtern { 2.f };
static unsigned int bitMasks[2] = {3u, 5u}; static unsigned int selectedMask = bitMasks[1];
using shared::Thing;
using namespace shared::dsp;
struct Holder { static int member; int value = 0; };
void configure() { using namespace local_support; static int local = 1; }
}
extern "C" {
extern unsigned char browserBlob[4];
void configureBrowserBlob() { extern int localBlob; }
}
namespace compact { using namespace compact_support; extern short compactValue; float compactHelper(float value) { return value; } }
namespace {
constexpr float VOLTAGE_SCALE = 5.f;
}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let variables = report["namespaceVariableDeclarations"]
        .as_array()
        .expect("namespaceVariableDeclarations should be an array");
    assert_eq!(
        variables
            .iter()
            .map(|candidate| candidate["name"].as_str().unwrap_or_default())
            .collect::<Vec<_>>(),
        [
            "marker",
            "declaredOnly",
            "initializedExtern",
            "bitMasks",
            "selectedMask",
            "browserBlob",
            "compactValue",
            "VOLTAGE_SCALE"
        ]
    );
    assert_eq!(variables[1]["namespace"], serde_json::json!(["outer"]));
    assert_eq!(variables[1]["typeSource"], "const float");
    assert_eq!(variables[1]["arrayExtent"], "");
    assert_eq!(variables[1]["cLinkage"], false);
    assert_eq!(variables[1]["initialized"], false);
    assert_eq!(variables[1]["externDeclaration"], true);
    assert_eq!(variables[2]["initialized"], true);
    assert_eq!(variables[2]["externDeclaration"], false);
    assert_eq!(variables[5]["typeSource"], "unsigned char");
    assert_eq!(variables[5]["arrayExtent"], "[4]");
    assert_eq!(variables[5]["cLinkage"], true);
    assert_eq!(variables[5]["externDeclaration"], true);
    assert_eq!(variables[6]["namespace"], serde_json::json!(["compact"]));
    assert_eq!(variables[6]["typeSource"], "short");
    assert_eq!(variables[7]["namespace"], serde_json::json!([]));
    for variable in variables {
        let start = variable["start"]
            .as_u64()
            .expect("start should be an integer") as usize;
        let end = variable["end"].as_u64().expect("end should be an integer") as usize;
        let name_start = variable["nameStart"]
            .as_u64()
            .expect("nameStart should be an integer") as usize;
        let declarator_end = variable["declaratorEnd"]
            .as_u64()
            .expect("declaratorEnd should be an integer") as usize;
        let utf16 = source.encode_utf16().collect::<Vec<_>>();
        assert_eq!(utf16[end - 1], b';' as u16);
        assert_ne!(utf16[start], b'/' as u16);
        assert!(start < name_start && name_start < declarator_end && declarator_end <= end);
    }
    let using = report["namespaceUsingDeclarations"]
        .as_array()
        .expect("namespaceUsingDeclarations should be an array");
    assert_eq!(using.len(), 1, "{using:#?}");
    assert_eq!(using[0]["target"], "shared::Thing");
    assert_eq!(using[0]["namespace"], serde_json::json!(["outer"]));
    let directives = report["namespaceUsingDirectives"]
        .as_array()
        .expect("namespaceUsingDirectives should be an array");
    assert_eq!(directives.len(), 2, "{directives:#?}");
    assert_eq!(directives[0]["target"], "shared::dsp");
    assert_eq!(directives[0]["namespace"], serde_json::json!(["outer"]));
    assert_eq!(directives[1]["target"], "compact_support");
    assert_eq!(directives[1]["namespace"], serde_json::json!(["compact"]));
    let utf16 = source.encode_utf16().collect::<Vec<_>>();
    for directive in directives {
        let start = directive["start"]
            .as_u64()
            .expect("start should be an integer") as usize;
        let end = directive["end"].as_u64().expect("end should be an integer") as usize;
        let raw = String::from_utf16(&utf16[start..end]).expect("directive range should be UTF-16");
        assert!(raw.starts_with("using namespace "), "{raw:?}");
        assert!(raw.ends_with(';'), "{raw:?}");
    }
    let compact_helper = report["freeFunctionDefinitions"]
        .as_array()
        .and_then(|definitions| {
            definitions
                .iter()
                .find(|candidate| candidate["name"] == "compactHelper")
        })
        .expect("same-line namespace helper should be reported");
    assert_eq!(compact_helper["namespace"], serde_json::json!(["compact"]));
    assert_eq!(
        compact_helper["declarationSignature"],
        "float compactHelper(float value)"
    );
}

#[test]
fn declaration_analysis_reports_normalized_free_function_signatures() {
    let source = r#"namespace fixture {
template <typename T>
static T clampValue(T value, /* compatibility comment */ T low, T high) noexcept(sizeof(T) > 0) {
return value < low ? low : (value > high ? high : value);
}
}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let definitions = report["freeFunctionDefinitions"]
        .as_array()
        .expect("freeFunctionDefinitions should be an array");
    assert_eq!(definitions.len(), 1, "{definitions:#?}");
    assert_eq!(definitions[0]["name"], "clampValue");
    assert_eq!(definitions[0]["namespace"], serde_json::json!(["fixture"]));
    assert_eq!(
        definitions[0]["signature"],
        "template <typename T> static T clampValue(T value, T low, T high) noexcept(sizeof(T) > 0)"
    );
    assert_eq!(
        definitions[0]["start"],
        source[..source.find("template").expect("template should exist")]
            .encode_utf16()
            .count()
    );
}

#[test]
fn declaration_analysis_reports_qualified_callable_terminals_and_kinds() {
    let source = r#"namespace fixture { template <typename T> T render(T value); }
template <>
double fixture::render<double>(double value) { return value * 2.; }
struct Engine { Engine(); ~Engine(); float render(float value); };
inline Engine::Engine() {}
Engine::~Engine() {}
float Engine::render(float value) { return value; }
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let definitions = report["outOfLineDefinitions"]
        .as_array()
        .expect("outOfLineDefinitions should be an array");
    assert_eq!(definitions.len(), 4, "{definitions:#?}");
    assert_eq!(definitions[0]["owner"], "fixture");
    assert_eq!(definitions[0]["member"], "render<double>");
    assert_eq!(definitions[0]["callableKind"], "function");
    assert_eq!(definitions[1]["member"], "Engine");
    assert_eq!(definitions[1]["callableKind"], "constructor");
    assert_eq!(definitions[2]["member"], "~Engine");
    assert_eq!(definitions[2]["callableKind"], "destructor");
    assert_eq!(definitions[3]["member"], "render");
    assert_eq!(definitions[3]["callableKind"], "function");
}

#[test]
fn declaration_analysis_reports_anonymous_c_typedef_ranges() {
    let source = r#"const char* marker = "😀";
namespace outer {
typedef struct /* interface */ {
int version;
} FixtureCInterface;
typedef union {
float value;
int bits;
} FixtureCValue;
typedef enum {
FIXTURE_OFF,
FIXTURE_ON
} FixtureCMode;
typedef struct NamedTag { int value; } NamedAlias;
}

void localFactory() {
typedef struct { int value; } LocalInterface;
}
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let declarations = report["anonymousTypedefDeclarations"]
        .as_array()
        .expect("anonymousTypedefDeclarations should be an array");
    assert_eq!(declarations.len(), 4, "{declarations:#?}");
    assert_eq!(declarations[0]["name"], "FixtureCInterface");
    assert_eq!(declarations[0]["kind"], "struct");
    assert_eq!(declarations[1]["name"], "FixtureCValue");
    assert_eq!(declarations[1]["kind"], "union");
    assert_eq!(declarations[2]["name"], "FixtureCMode");
    assert_eq!(declarations[2]["kind"], "enum");
    for declaration in &declarations[..3] {
        assert_eq!(declaration["namespace"], serde_json::json!(["outer"]));
        assert_eq!(declaration["namespaceScope"], true);
        assert_eq!(declaration["owners"], serde_json::json!([]));
    }
    assert_eq!(declarations[3]["name"], "LocalInterface");
    assert_eq!(declarations[3]["namespaceScope"], false);
    let declaration_start = source
        .find("typedef struct /* interface */")
        .expect("anonymous typedef should exist");
    let body_start = source[declaration_start..]
        .find('{')
        .map(|offset| declaration_start + offset + 1)
        .expect("anonymous typedef body should open");
    let body_end = source
        .find("} FixtureCInterface")
        .expect("anonymous typedef body should close");
    let name_start = body_end + 2;
    let declaration_end = source[name_start..]
        .find(';')
        .map(|offset| name_start + offset + 1)
        .expect("anonymous typedef should end");
    assert_eq!(
        declarations[0]["start"],
        source[..declaration_start].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["bodyStart"],
        source[..body_start].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["bodyEnd"],
        source[..body_end].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["nameStart"],
        source[..name_start].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["end"],
        source[..declaration_end].encode_utf16().count()
    );
}

#[test]
fn declaration_analysis_ignores_comment_delimiters_before_empty_types() {
    let source = r#"/* struct CommentedType {}; inline int decoy() { return 1; } */
struct RealType {};
inline int realHelper() { return 2; }
"#;
    let output = run_declarations(serde_json::json!({"source": source}));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("declaration analysis report should be JSON");
    let declarations = report["typeDeclarations"]
        .as_array()
        .expect("typeDeclarations should be an array");
    assert_eq!(declarations.len(), 1, "{declarations:#?}");
    assert_eq!(declarations[0]["name"], "RealType");
    assert_eq!(declarations[0]["namespaceScope"], true);
}

#[test]
fn preprocessing_selects_known_conditions_and_preserves_unknown_conditions() {
    let output = run_preprocess(serde_json::json!({
        "source": "#define BASE 3\n#define WIDTH BASE\n#if FLAG\nint enabled = WIDTH;\n#else\nint disabled = WIDTH;\n#endif\n#if COMPLEX + 1\nint maybe_one = WIDTH;\n#else\nint maybe_two = WIDTH;\n#endif\nconst char* text = \"WIDTH\";\n// WIDTH\n/* WIDTH */\n#define CALL(value) WIDTH + value\nint result = WIDTH;\n#define REMOVED 9\n#undef REMOVED",
        "initialDefinitions": {"FLAG": "1"}
    }));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("preprocessor report should be JSON");
    assert_eq!(
        report["source"],
        "#define BASE 3\n#define WIDTH BASE\nint enabled = 3;\n#if COMPLEX + 1\nint maybe_one = 3;\n#else\nint maybe_two = 3;\n#endif\nconst char* text = \"WIDTH\";\n// WIDTH\n/* WIDTH */\n#define CALL(value) WIDTH + value\nint result = 3;\n#define REMOVED 9"
    );
    assert_eq!(
        report["definitions"],
        serde_json::json!({"BASE": "3", "FLAG": "1", "WIDTH": "BASE"})
    );
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    assert!(!adapter.contains("legacyPreprocessMacroSource"));
    assert!(!adapter.contains("replaceObjectMacros"));
}

#[test]
fn preprocessing_reports_active_include_directives_with_js_offsets() {
    let source = r##"const char* marker = "😀";
#if WINDOWS
#include <winsock2.h>
#include "inactive.hpp"
#else
#include <sys/socket.h>
#include "active.hpp"
#endif
#if UNKNOWN + 1
#include <maybe.hpp>
#endif
// #include <comment.hpp>
const char* text = "#include <literal.hpp>";
"##;
    let output = run_preprocess(serde_json::json!({
        "source": source,
        "initialDefinitions": {"WINDOWS": "0"},
        "expandObjectMacros": false
    }));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("preprocessor report should be JSON");
    let active = report["source"]
        .as_str()
        .expect("preprocessed source should be a string");
    let directives = report["includeDirectives"]
        .as_array()
        .expect("includeDirectives should be an array");
    assert_eq!(directives.len(), 3, "{directives:#?}");
    assert_eq!(directives[0]["include"], "sys/socket.h");
    assert_eq!(directives[0]["angle"], true);
    assert_eq!(directives[1]["include"], "active.hpp");
    assert_eq!(directives[1]["angle"], false);
    assert_eq!(directives[2]["include"], "maybe.hpp");
    assert_eq!(directives[2]["angle"], true);
    for directive in directives {
        let include = directive["include"]
            .as_str()
            .expect("include should be a string");
        let byte_start = active
            .find(include)
            .expect("active include should exist in preprocessed source");
        assert_eq!(
            directive["start"],
            active[..byte_start].encode_utf16().count()
        );
    }
    assert!(!active.contains("winsock2.h"));
    assert!(!active.contains("inactive.hpp"));
}

#[test]
fn active_declarations_and_config_calls_have_no_node_shadow() {
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    for removed in [
        "function legacyCalls(",
        "legacyConfigCalls",
        "activeConfigCallsByFile",
        "comparableEnumInfo",
        "sourceEnumShadowDepth",
        "enum analysis differs from the compatible Node contract",
        "string constant differs from the compatible Node contract",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
    assert!(adapter.contains(
        "directConfigCalls=name=>rustDirectConfigCalls(configuredSource,name,constants)"
    ));
    assert!(adapter.contains(
        "const fxConfigCalls=name=>rustSourceConfigCalls(fxPortConfigSource,name,constants)"
    ));
}

#[test]
fn source_inventory_and_dependency_analysis_are_rust_by_default() {
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    assert!(adapter.contains("let activeSourceTool=null"));
    assert!(adapter.contains(
        "function filesOutsideNestedRepositories(root){return rustSourceInventory(root).sourceFiles}"
    ));
    assert!(adapter
        .contains("function files(root){return rustDependencyFileInventory(root).sourceFiles}"));
    assert!(adapter.contains(
        "runRustSource([\"analyze\",\"files\",\"--source-dir\",canonical,\"--profile\",selected,\"--format\",\"json\"])"
    ));
    assert!(adapter.contains(
        "hydrateWrongPeopleLuaRuntime(sourceDir,target);dependencyFileInventoryCache.clear()"
    ));
    assert!(adapter.contains(
        "vendorFiles.push(...rustDependencyFileInventory(directory,\"vendor\").sourceFiles)"
    ));
    assert!(adapter.contains(
        "const directlyIncludedHeaderFiles=new Set(rustSourceDeclarations(prelude).includeDirectives.flatMap"
    ));
    assert!(adapter.contains(
        ".filter(file=>/\\.(?:h|hh|hpp)$/.test(file)&&!directlyIncludedHeaderFiles.has(file))"
    ));
    assert!(!adapter.contains("fs.readdirSync(root,{withFileTypes:true})"));
    assert!(!adapter.contains(
        "const vendorFiles=[];function visit(directory){if(!fs.existsSync(directory))return;for(const entry of fs.readdirSync"
    ));
    assert!(adapter.contains(
        "function includedDependencyFiles(sourceDir,roots){return rustDependencyFiles(sourceDir,roots)}"
    ));
    assert!(adapter.contains(
        "function standardDependencyIncludes(source){return standardDependencyIncludesFromDirectives(preprocessMacroSource(source,new Map,false).includeDirectives)}"
    ));
    assert!(adapter
        .contains("directives=preprocessMacroSource(source,new Map,false).includeDirectives"));
    assert!(adapter.contains(
        "activeTargetsForFile=new Set(active.includeDirectives.map(candidate=>resolve(file,candidate.include))"
    ));
    assert!(adapter
        .contains("rawTargets=new Set(rawIncludes(file,raw).map(include=>resolve(file,include))"));
    assert!(adapter.contains(
        "includeDirectives.filter(candidate=>candidate.angle).map(candidate=>candidate.include)"
    ));
    assert!(adapter.contains(
        "const source=fs.readFileSync(importer,\"utf8\"),directives=preprocessMacroSource(source,new Map,false).includeDirectives;"
    ));
    assert!(adapter
        .contains("activeDirectives.filter(candidate=>!candidate.angle).flatMap(candidate=>"));
    assert!(adapter.contains("report.customModelCandidates"));
    assert!(adapter.contains("report.metaModuleCandidates"));
    assert!(adapter.contains("customModelCandidatesByFile"));
    assert!(adapter.contains("metaModuleCandidatesByFile"));
    assert!(adapter.contains("let activeIncludeDirectivesByFile=null"));
    assert!(adapter.contains("const includeDirectivesByFile=new Map(inventoryFiles.map"));
    assert!(adapter.contains(
        "directive=normalizedIncludeDirective(candidate,source,\"model analysis\",canonical)"
    ));
    assert!(adapter.contains(
        "function rawIncludeDirectives(file,source){return rustIncludeDirectives(file,source)??rustSourceDeclarations(source).includeDirectives}"
    ));
    assert!(adapter.contains(
        "function rustSourceIncludeNames(root){const canonical=fs.realpathSync(root),report=runRustSource([\"analyze\",\"includes\""
    ));
    assert!(adapter.contains(
        "function rustMakefileAnalysis(root,makefilePath=\"Makefile\",sourceVariables=[\"SOURCES\"]){"
    ));
    assert!(adapter.contains(
        "const command=[\"analyze\",\"makefile\",\"--source-dir\",canonical,\"--makefile\",relative,...variables.flatMap(name=>[\"--source-variable\",name]),\"--format\",\"json\"]"
    ));
    assert!(adapter.contains(
        "function makefileCompileDefinitions(sourceDir){return rustMakefileAnalysis(sourceDir).compileDefinitions}"
    ));
    assert!(adapter.contains(
        "function makefileIncludeDirectories(sourceDir){return rustMakefileAnalysis(sourceDir).includeDirectories}"
    ));
    assert!(adapter.contains(
        "function makefileImplementationSources(sourceDir){return rustMakefileAnalysis(sourceDir).implementationSources}"
    ));
    assert!(adapter.contains(
        "rustMakefileAnalysis(sourceDir).allCompileDefinitions.some(definition=>definition===\"-DRACK_SIMD\"||definition===\"-DRACK_SIMD=1\")"
    ));
    assert!(adapter.contains(
        "return rustMakefileAnalysis(sourceDir,\"chuck/src/makefile\",[\"EMSCRIPTENSRCS\"]).implementationSources"
    ));
    assert!(adapter.contains("function rustCmakeAnalysis(root){"));
    assert!(adapter.contains(
        "runRustSource([\"analyze\",\"cmake\",\"--source-dir\",canonical,\"--format\",\"json\"])"
    ));
    assert!(adapter.contains(
        "function cmakeCompileDefinitions(sourceDir){const definitions=[...rustCmakeAnalysis(sourceDir).compileDefinitions]"
    ));
    assert!(adapter.contains(
        "referencedIncludes=new Set(rustSourceIncludeNames(sourceDir)),availableFiles=files(sourceDir)"
    ));
    assert!(adapter.contains(
        "referenced=new Set(rustSourceDeclarations(source).includeDirectives.map(candidate=>candidate.include))"
    ));
    assert!(adapter.contains(
        "function rawIncludes(file,source){return rawIncludeDirectives(file,source).map(candidate=>candidate.include)}"
    ));
    assert!(adapter.contains(
        "activeIncludeDirectivesByFile=rustModelAnalysis?.includeDirectivesByFile??null"
    ));
    assert!(adapter.contains("rawIncludes(registration.file,registrationSource)"));
    assert!(adapter.contains("rawIncludes(header.file,fs.readFileSync(header.file,\"utf8\"))"));
    assert!(adapter.contains("rawIncludes(definitionFile,source)"));
    assert!(adapter
        .contains("sourceFiles.flatMap(file=>rawIncludes(file,fs.readFileSync(file,\"utf8\")))"));
    assert!(adapter.contains(
        "rawIncludeDirectives(file,fs.readFileSync(file,\"utf8\")).filter(candidate=>!candidate.angle)"
    ));
    assert!(adapter.contains(
        "angleTokens=[...new Set(sourceFiles.flatMap(file=>rawIncludeDirectives(file,fs.readFileSync(file,\"utf8\")).filter(candidate=>candidate.angle).map(candidate=>candidate.include)))"
    ));
    assert!(adapter.contains(
        "includes:[...new Set([...rustSourceDeclarations(definition.source).includeDirectives.map(candidate=>candidate.include),...rawIncludes(registration.file,definition.registrationSource)])]"
    ));
    assert!(adapter.contains(
        "function resolvedRawIncludeTarget(sourceDir,importer,directive){if(directive.target)return directive.target"
    ));
    assert!(adapter.contains(
        "registrationDirectives=rawIncludeDirectives(registration.file,registrationSource).filter(candidate=>!candidate.angle)"
    ));
    assert!(adapter.contains(
        "resolvedIncludes=registrationDirectives.map(candidate=>resolvedRawIncludeTarget(sourceDir,registration.file,candidate))"
    ));
    assert!(adapter.contains(
        "includeDirectives=report.includeDirectives.map(candidate=>normalizedIncludeDirective(candidate,source,\"declaration analysis\"))"
    ));
    assert!(adapter.contains(
        "result.preprocessorDirectives=normalizedPreprocessorDirectives(report.preprocessorDirectives,source,\"declaration analysis\")"
    ));
    assert!(adapter.contains(
        "result.macroDefinitions=normalizedMacroDefinitions(report.macroDefinitions,source,\"declaration analysis\")"
    ));
    assert!(adapter.contains(
        "result.conditionalDirectives=normalizedConditionalDirectives(report.conditionalDirectives,source,\"declaration analysis\")"
    ));
    assert!(adapter.contains(
        "result.conditionalBlocks=normalizedConditionalBlocks(report.conditionalBlocks,source,\"declaration analysis\",result.conditionalDirectives)"
    ));
    assert!(adapter.contains(
        "result.headerGuards=normalizedHeaderGuards(report.headerGuards,source,\"declaration analysis\",result.conditionalDirectives,result.macroDefinitions)"
    ));
    assert!(adapter.contains(
        "conditionNames=new Set([...sources.values()].flatMap(source=>rustSourceDeclarations(source).conditionalDirectives"
    ));
    assert!(adapter.contains(
        "function headerGuardNames(source){return new Set(rustSourceDeclarations(source).headerGuards.map(candidate=>candidate.name))}"
    ));
    assert!(adapter.contains(
        "function stripOrphanPreprocessorEnds(source){const declarations=rustSourceDeclarations(source),matched=new Set(declarations.conditionalBlocks"
    ));
    assert!(adapter.contains(
        "const guard=rustSourceDeclarations(source).headerGuards[0];if(!guard)return source;"
    ));
    assert!(adapter.contains(
        "rustSourceDeclarations(declaration).conditionalDirectives.some(directive=>directive.kind===\"ifdef\"&&directive.simpleMacro===\"RACK_SIMD\")"
    ));
    assert!(adapter.contains(
        "function flattenExternCWrappers(source){const removals=[];for(const block of rustSourceDeclarations(source).conditionalBlocks)"
    ));
    assert!(adapter.contains(
        "function singleGuardedIncludeMacro(source){const declarations=rustSourceDeclarations(source);for(const block of declarations.conditionalBlocks)"
    ));
    assert!(adapter.contains(
        "function rustObjectMacroDefinitions(source){const definitions=new Map;for(const candidate of rustSourceDeclarations(source).macroDefinitions"
    ));
    assert!(adapter.contains(
        "const definitions=rustSourceDeclarations(source).macroDefinitions.filter(candidate=>!candidate.commented&&candidate.functionLike"
    ));
    assert!(adapter
        .contains("for(const candidate of rustSourceDeclarations(source).macroDefinitions){"));
    assert!(adapter.contains(
        "implementationDefines=rustSourceDeclarations(raw).macroDefinitions.filter(candidate=>!candidate.commented&&candidate.name.endsWith(\"_IMPLEMENTATION\"))"
    ));
    assert!(adapter.contains(
        "for(const candidate of rustSourceDeclarations(coordinateText).macroDefinitions)"
    ));
    assert!(adapter.contains(
        "const macros=rustSourceDeclarations(source).macroDefinitions.filter(candidate=>!candidate.commented&&!candidate.functionLike"
    ));
    assert!(adapter.contains(
        "rustSourceDeclarations(source).preprocessorDirectives.filter(candidate=>candidate.commented||candidate.kind!==\"define\")"
    ));
    assert!(adapter.contains(
        "withoutNonDefinePreprocessorDirectives(source.slice(0,declaration.declarationStart)).trim()"
    ));
    assert!(adapter.contains(
        "stripUiHeaderIncludes(source,sourceFiles=[],sourceDir=\"\"){const removals=[];for(const directive of rustSourceDeclarations(source).includeDirectives"
    ));
    assert!(adapter.contains(
        "browserAssetDependencyPrelude(source,contract){const sourceIncludes=rustSourceDeclarations(source).includeDirectives"
    ));
    assert!(adapter.contains(
        "effectivePrelude=withoutMatchingIncludeDirectiveLines(effectivePrelude,directive=>"
    ));
    assert!(adapter.contains(
        "moduleAddSource=fs.readFileSync(moduleAdd,\"utf8\"),includes=rustSourceDeclarations(moduleAddSource).includeDirectives"
    ));
    assert!(adapter.contains(
        "rustSourceDeclarations(currentSource).includeDirectives.filter(candidate=>!candidate.angle)"
    ));
    assert!(adapter.contains(
        "(directives??rustSourceDeclarations(body).includeDirectives).filter(candidate=>!candidate.angle)"
    ));
    assert!(
        adapter.contains("const target=resolvedClassBodyIncludeTarget(sourceDir,file,directive)")
    );
    assert!(adapter.contains("registeredModuleType=candidate.registeredModuleType"));
    assert!(adapter.contains("widgetNamespace=candidate.widgetNamespace"));
    assert!(adapter.contains("rawContextFiles=candidate.contextFiles"));
    assert!(adapter.contains(
        "start.rust?(typeof start.registeredModuleType===\"string\"?qualifyScopedAlias(start.registeredModuleType,start.widgetNamespace):null):registeredWidgetModuleType"
    ));
    assert!(adapter
        .contains("aliasCandidates=start.rust&&rustAliasesByFile?start.contextFiles.flatMap"));
    assert!(adapter.contains(
        "modelRegistrations(combinedSource,file,stringConstants,candidateStarts,rustAliasesByFile,directCustomModelCandidates)"
    ));
    assert!(adapter.contains("metaModuleRegistrations(source,file,directMetaModuleCandidates)"));
    for removed in [
        "activeSourceTool!==undefined",
        "activeCompanionImplementationsByFile",
        "duplicatesHeaderGlobals",
        "developmentDirectories=new Set",
        "active.matchAll(/^\\s*#include",
        "preprocessMacroSource(fs.readFileSync(file,\"utf8\"),new Map,false).source.matchAll(/^\\s*#include",
        "quoted=[...source.matchAll(/^\\s*#include",
        "source.matchAll(/^\\s*#include\\s+\"([^\"]+\\.(?:cpp|cc|cxx))",
        "fs.readFileSync(file,\"utf8\").matchAll(/^\\s*#include\\s+\"",
        "registrationSource.matchAll(/^\\s*#include",
        "return body.replace(/^([ \\t]*)#include",
        "fs.readFileSync(file,\"utf8\").matchAll(/^\\s*#include\\s+<",
        "source.replace(/^\\s*(?:\\/\\/\\s*)?#(?:include|pragma|define)",
        "source.matchAll(/^\\s*#include\\s+[\"<]",
        "effectivePrelude.replace(/^\\s*#include",
        "source.slice(0,declaration.declarationStart).replace(/^\\s*(?:\\/\\/\\s*)?#",
        "fs.readFileSync(moduleAdd,\"utf8\").matchAll(/^\\s*#include",
        "currentSource.matchAll(/^\\s*#\\s*include",
        "function fallbackRawIncludeDirectives",
        "function includes(source)",
        "function objectMacroDefinitions",
        "function macroDefinitionBlocks",
        "const lines=source.split(\"\\n\"),definitions=[]",
        "for(const match of source.matchAll(/^[ \\t]*#[ \\t]*define[ \\t]+([A-Za-z_]\\w*)[ \\t]+",
        "source.matchAll(/^[ \\t]*#\\s*define",
        "raw.matchAll(/^[ \\t]*#[ \\t]*define",
        "coordinateText.matchAll(/^\\s*#define",
        "fs.readFileSync(file,\"utf8\").matchAll(/^\\s*#\\s*(?:if|elif)",
        "function headerGuardNames(source){const guards=new Set;for(const match",
        "if(/^\\s*#\\s*(?:if|ifdef|ifndef)\\b/.test(line))",
        "const guard=/^\\s*#(?:ifndef",
        "declaration&&/#\\s*ifdef\\s+RACK_SIMD",
        "const guardClose=/^\\s*#endif",
        "function flattenExternCWrappers(source){return source.replace(/^\\s*#\\s*ifdef",
        "guard=/^\\s*#ifndef\\s+([A-Za-z_]\\w*)",
        "const source=fs.readFileSync(file,\"utf8\").replace(/\\\\\\r?\\n/g,\" \"),definitions=[];let conditionalDepth=0",
        "source.matchAll(/(?:^|\\s)-I(?:\"([^\"]+)\"|'([^']+)'|([^\\s#]+))/g)",
        "const assignment=/^\\s*SOURCES\\s*\\+?=\\s*([^#]*)/.exec(line)",
        "makefilePath=path.join(sourceDir,\"Makefile\")",
        "source.matchAll(/\\bset\\s*\\(\\s*([A-Z][A-Z0-9_]+)\\s+([0-9]+|TRUE|FALSE)\\s+CACHE",
        "assignment=/^\\s*EMSCRIPTENSRCS\\s*=\\s*([^#]*)/m.exec(source)",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
}

#[test]
fn immutable_raw_structure_uses_rust_ranges_without_node_shadowing() {
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    assert!(adapter.contains(
        "if(!activeTypeDeclarationsByFile?.has(resolved))return plainStructBody(source,type)"
    ));
    assert!(adapter.contains("Raw implementation source differs from the Rust inventory"));
    assert!(adapter.contains("Raw free-function source differs from the Rust inventory"));
    assert!(adapter.contains(
        "referencedLocalFreeFunctionDefinitions(rawDefinitionSource,[body,...inheritedSource].join(\"\\n\"),definition.file)"
    ));
    assert!(adapter.contains(
        "rustAliases=activeTypeAliasesByFile?.get(path.resolve(file))??rustSourceTypeAliases(source)"
    ));
    for removed in [
        "rustTypeBody(rawSource,initialTypeDeclaration)??structBody",
        "rustOutOfLineDefinitions(file,raw,name)??outOfLineDefinitions",
        "rustOutOfLineStaticDefinitions(file,source,className)??outOfLineStaticDefinitions",
        "rustOutOfLineDefinitions(file,source,className)??outOfLineDefinitions",
        "typedef=rustAlias?null",
        "if(!value&&aliasCandidates!==null)break",
        "return structBody(source,type)",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
}

#[test]
fn transformed_free_function_discovery_uses_rust_ranges_and_reference_edges() {
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    assert!(adapter.contains(
        "rustCandidates=file?rustFreeFunctionDefinitions(file,source):rustSourceFreeFunctionDefinitions(source)"
    ));
    assert!(adapter.contains("freeFunctions=rustSourceFreeFunctionDefinitions(source)"));
    assert!(adapter.contains("aliases=rustSourceTypeAliases(source).filter"));
    assert!(adapter.contains(
        "function qualifiedTypeDefinitionRecords(source){\n  const declarations=rustSourceDeclarations(source),records=[];"
    ));
    assert!(adapter.contains(
        "function namespaceFunctionForwardDeclarations(source,macroSource=source){const declarations=[];for(const candidate of rustSourceFreeFunctionDefinitions(source))"
    ));
    assert!(adapter.contains(
        "const signature=normalizeFunctionDecorationMacros(candidate.declarationSignature,macroSource)"
    ));
    assert!(adapter.contains(
        "declarationSignature=candidate.declarationSignature,references=candidate.references"
    ));
    assert!(adapter.contains(
        "function freeFunctionForwardDeclaration(candidate,signature=candidate?.signature)"
    ));
    assert!(adapter.contains(
        "function referencedLocalFreeFunctionDefinitionFacts(source,reference,file=null)"
    ));
    assert!(adapter.contains("supportFunctions.push(candidate)"));
    assert!(adapter
        .contains("crossFileSupport.map(candidate=>freeFunctionForwardDeclaration(candidate))"));
    assert!(adapter.contains("support.map(candidate=>freeFunctionForwardDeclaration(candidate))"));
    assert!(adapter.contains(
        "directive=normalizedNamespaceUsingDirective(candidate,source,\"model analysis\")"
    ));
    assert!(adapter.contains(
        "function namespaceUsingPrelude(source){\n  const directives=rustSourceNamespaceUsingDirectives(source)"
    ));
    assert!(adapter.contains(
        "rustSourceNamespaceUsingDirectives(source).map(candidate=>candidate.namespace.length?"
    ));
    assert!(adapter.contains(
        "return[...new Set([...functionDeclarations,...usingDeclarations,...found].filter(Boolean))]"
    ));
    assert!(adapter.contains(
        "crossFileSupport.flatMap(({source})=>namespaceUsingDirectiveDeclarations(source))"
    ));
    assert!(adapter.contains(
        "rustNamespaceUsingDirectives(file,source).some(candidate=>candidate.target===\"std\")"
    ));
    assert!(adapter.contains(
        "rustNamespaceUsingDirectives(file,source).some(candidate=>candidate.target===\"rack::dsp\")"
    ));
    assert!(!adapter.contains("function freeFunctionDeclaration(definition){"));
    assert!(!adapter.contains("source.matchAll(/^\\s*using\\s+namespace"));
    assert!(!adapter.contains("if(/^\\s*using\\s+namespace\\s+std\\s*;/m.test(source))"));
    assert!(!adapter.contains(
        "const pattern=/^[ \\t]*(?:template\\s*<[^>]*>\\s*)?(?:(?:inline|static|constexpr"
    ));
    assert!(!adapter.contains("function stripTopLevelDefaultArgument("));
    assert!(!adapter.contains("function stripFunctionDefaultArguments("));
    assert!(adapter.contains(
        "function classDefinitionSource(source,className){const declaration=rustSourceTypeDeclaration(source,className)"
    ));
    assert!(adapter.contains(
        "function plainStructBody(source,className){const declaration=rustSourceTypeDeclaration(source,className)"
    ));
    assert!(adapter.contains(
        "for(const {source} of sources)for(const declaration of rustSourceDeclarations(source).typeDeclarations)"
    ));
    assert!(adapter.contains(
        "function paramQuantityHelpers(source,targetBody){const found=[];for(const declaration of rustSourceDeclarations(source).typeDeclarations)"
    ));
    assert!(adapter.contains("!declaration.namespaceScope"));
    assert!(adapter.contains(
        "function declaredBases(source,className){return rustSourceTypeDeclaration(source,className)?.bases??[]}"
    ));
    assert!(adapter.contains(
        "function enclosingNamespaces(source,className){return rustSourceTypeDeclaration(source,className)?.namespace??[]}"
    ));
    assert!(adapter.contains(
        "function removeClassDefinition(source,className){const declaration=rustSourceTypeDeclaration(source,className)"
    ));
    assert!(adapter.contains(
        "function templateContract(source,moduleClass,typeDeclaration=null){const open=moduleClass.indexOf(\"<\"),close=moduleClass.lastIndexOf(\">\");if(open<0||close<open)return null;const declaration=typeDeclaration??rustSourceTypeDeclaration(source,moduleClass)"
    ));
    assert!(adapter.contains(
        "const source=fs.readFileSync(file,\"utf8\"),declaration=rustSourceTypeDeclaration(source,current.type),body=rustTypeBody(source,declaration)"
    ));
    assert!(adapter.contains(
        "function modulePrelude(source,className,typeDeclaration=null){const name=baseTypeName(className),declaration=rustTypeBody(source,typeDeclaration)!==null?typeDeclaration:rustSourceTypeDeclaration(source,className)"
    ));
    assert!(adapter.contains(
        "function namespacedModulePrelude(source,className){\n  const declaration=rustSourceTypeDeclaration(source,className);"
    ));
    assert!(adapter.contains(
        "function typeAlias(sourceFiles,type){if(String(type).includes(\"<\"))return null;const name=baseTypeName(type);for(const file of sourceFiles){const source=fs.readFileSync(file,\"utf8\"),rustAliases=activeTypeAliasesByFile?.get(path.resolve(file))??rustSourceTypeAliases(source)"
    ));
    assert!(adapter.contains(
        "function resolveRegisteredModuleType(source,type,aliasCandidates=null,registrationNamespace=[]){\n  const aliases=aliasCandidates??rustSourceTypeAliases(source)"
    ));
    assert!(adapter.contains(
        "function rawTypeBody(file,source,declaration,type){const resolved=path.resolve(file);if(!activeTypeDeclarationsByFile?.has(resolved))return plainStructBody(source,type)"
    ));
    for removed in [
        "source.matchAll(/\\b(?:struct|class)\\s+([A-Za-z_]\\w*)\\s*:\\s*([^\\{]+)\\{/g)",
        "source.matchAll(/\\bstruct\\s+([A-Za-z_]\\w*)\\s*:\\s*(?:(?:public|protected|private)\\s+)?(?:[A-Za-z_]\\w*::)*ParamQuantity",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
    assert!(adapter.contains(
        "candidateSource===rawCandidateSource?rawTypeDeclaration:rustSourceTypeDeclaration(candidateSource,resolvedType)"
    ));
    assert!(
        adapter.contains("const moduleDeclaration=rustSourceTypeDeclaration(source,\"Undertow\")")
    );
    assert!(adapter.contains(
        "function declaredTypeNames(source){const declarations=rustSourceDeclarations(source)"
    ));
    assert!(
        adapter.contains("function normalizedAnonymousTypedefDeclaration(candidate,source,label)")
    );
    assert!(adapter.contains("typeDeclarations.push(...anonymousTypedefDeclarations)"));
    assert!(adapter
        .contains("header.names.filter(name=>Boolean(typeDeclarationSource(header.source,name)))"));
    assert!(adapter.contains(
        "function enumDeclarationSource(source,name){const declaration=rustSourceDeclarations(source).enumDeclarations.find"
    ));
    assert!(adapter.contains(
        "function preferNearestTargetEnums(source){\n  const declarations=rustSourceDeclarations(source)"
    ));
    assert!(adapter.contains(
        "function referencedGlobalEnumDeclarations(sourceFiles,reference){\n  const declarations=[];"
    ));
    assert!(adapter.contains(
        "candidates=activeEnumDeclarationsByFile?.get(path.resolve(file))??rustSourceDeclarations(source).enumDeclarations"
    ));
    assert!(adapter.contains(
        "function enumRecordInNamespace(source,names,targetNamespace=[]){\n  source=String(source??\"\");"
    ));
    assert!(adapter.contains(
        "export function enumInfoByTerminal(source,terminal){\n  if(!/^[A-Za-z_]\\w*$/.test(terminal??\"\"))return null;\n  for(const declaration of rustSourceDeclarations"
    ));
    assert!(adapter.contains(
        "function enumInfoByQualifiedAlias(source,qualified){const reference=/\\b([A-Za-z_]\\w*)::([A-Za-z_]\\w*)\\b/.exec(String(qualified??\"\"));if(!reference)return null;const [,alias,terminal]=reference,declarations=rustSourceDeclarations"
    ));
    assert!(adapter.contains(
        "function outOfLineDefinitions(source,className,preserveNamespace=false,fallbackNamespaces=[]){return rustSourceOutOfLineDefinitions"
    ));
    assert!(adapter.contains(
        "function outOfLineStaticDefinitions(source,className,preserveNamespace=false,fallbackNamespaces=[]){return rustSourceOutOfLineDefinitions"
    ));
    assert!(adapter.contains(
        "function outOfLineFreeFunctionDefinitions(source,functionName,preserveNamespace=false,fallbackNamespaces=[]){const name=baseTypeName(functionName).split(\"::\").at(-1),report=rustSourceDeclarations(source)"
    ));
    assert!(adapter.contains(
        "function outOfLineCallableKeys(source){\n  return rustSourceDeclarations(source).outOfLineDefinitions"
    ));
    assert!(adapter.contains(
        "adapterDefinitions=new Set(outOfLineCallableKeys(adaptedSource)),linkedDefinitionKeys=new Set([...headerDefinitions,...adapterDefinitions])"
    ));
    assert!(!adapter.contains("source.matchAll(/\\b([A-Za-z_]\\w*)::(~?[A-Za-z_]\\w*)\\s*\\(/g)"));
    assert!(adapter.contains(
        "function dedupeOutOfLineMethodDefinitions(source){\n  const declarations=rustSourceDeclarations(source)"
    ));
    assert!(adapter.contains("key=`${canonicalNamespace}:${candidate.signature}`"));
    assert!(adapter.contains(
        "function dedupeFreeFunctionDefinitions(source){const seen=new Set,ranges=[];for(const candidate of rustSourceFreeFunctionDefinitions(source))"
    ));
    assert!(adapter.contains(
        "function stripRepeatedDefaultArgumentsOnDefinitions(source){let result=source;for(const {start,end} of [...rustSourceDeclarations(source).repeatedDefaultArgumentRanges].reverse())"
    ));
    assert!(adapter.contains(
        "function deferFreeFunctionsReferencingTypes(source,typeNames){const ranges=[],definitions=[];for(const candidate of rustSourceFreeFunctionDefinitions(source))"
    ));
    assert!(adapter.contains(
        "function removeOutOfLineDefinitions(source,className){const name=baseTypeName(className).split(\"::\").at(-1),ranges=rustSourceDeclarations(source).outOfLineDefinitions.filter"
    ));
    assert!(adapter.contains(
        "function removeQualifiedFreeFunction(source,name){const candidate=rustSourceFreeFunctionDefinitions(source).find"
    ));
    assert!(adapter.contains(
        "function stripPluginInitFunctions(source){const ranges=rustSourceFreeFunctionDefinitions(source).filter"
    ));
    assert!(adapter.contains(
        "function referencedVecDspHelpers(source,reference){const helpers=[];for(const candidate of rustSourceFreeFunctionDefinitions(source))"
    ));
    assert!(adapter.contains("function removeFreeFunction(source,name){const escaped=name.replace"));
    assert!(adapter.contains("candidate=rustSourceFreeFunctionDefinitions(source).find"));
    assert!(adapter.contains("function stripRackUiResidue(source,knownUiClasses=new Set){"));
    assert!(adapter.contains("const sourceDeclarations=rustSourceDeclarations(result),ranges=[];"));
    assert!(adapter.contains("for(const candidate of sourceDeclarations.freeFunctionDefinitions)"));
    assert!(adapter.contains("for(const candidate of sourceDeclarations.outOfLineDefinitions)"));
    assert!(adapter.contains("for(const candidate of sourceDeclarations.freeFunctionDeclarations)"));
    assert!(adapter.contains(
        "function normalizeConditionalTemplateImplementations(source){\n  for(let pass=0;pass<32;pass++){\n    const records=[];\n    for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions)"
    ));
    assert!(adapter
        .contains("records.push({start:candidate.start,end:candidate.end,owner:candidate.owner"));
    assert!(adapter.contains(
        "function replaceOutOfLineMethod(source,className,method,replacement){const owner=baseTypeName(className),candidate=rustSourceDeclarations(source).outOfLineDefinitions.find"
    ));
    assert!(adapter
        .contains("function stripEmbeddedResourceDocumentation(source){\n  source=source.replace"));
    assert!(adapter
        .contains("for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions)"));
    assert!(adapter.contains("source.slice(candidate.bodyStart,candidate.bodyEnd)"));
    assert!(adapter.contains("result.inlineMemberDefinitions=report.inlineMemberDefinitions.map"));
    assert!(
        adapter.contains("function stubInlineVoidMethod(source,name){const escaped=name.replace")
    );
    assert!(
        adapter.contains("candidate=rustSourceDeclarations(source).inlineMemberDefinitions.find")
    );
    assert!(adapter.contains("function rustInlineMemberDefinitions(source){"));
    assert!(adapter.contains(
        "function inlineMemberDefinitionMatching(source,pattern){for(const candidate of rustInlineMemberDefinitions(source))"
    ));
    assert!(adapter.contains(
        "function replaceInlineMethodBody(source,pattern,body){const candidate=inlineMemberDefinitionMatching"
    ));
    assert!(adapter.contains(
        "function appendInlineMethodStatement(source,pattern,statement){const candidate=inlineMemberDefinitionMatching"
    ));
    assert!(adapter.contains(
        "function prependInlineMethodBody(source,pattern,prefix){const candidate=inlineMemberDefinitionMatching"
    ));
    assert!(adapter.contains(
        "function stubHostOnlyModuleMethods(body){\n  const browserBody=adaptClonotribeBrowserBody(adaptChrysalisBrowserBody(body));"
    ));
    assert!(adapter.contains("for(const candidate of rustInlineMemberDefinitions(body))"));
    assert!(adapter
        .contains("candidate.owner!==\"RackWebInlineFragment\"||candidate.ownerChain.length!==1"));
    assert!(adapter.contains(
        "function stripUiClassMembers(body){\n  const directInlineMembers=new Map(rustInlineMemberDefinitions(body)"
    ));
    assert!(adapter.contains("const inlineMember=directInlineMembers.get(index);"));
    assert!(
        adapter.contains("function surgeVcoSpecializations(sourceFiles,moduleClass){const type=")
    );
    assert!(adapter
        .contains("for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions)"));
    assert!(adapter
        .contains("function surgeFxConfigSpecializations(sourceFiles,moduleClass){const type="));
    assert!(adapter.contains(
        "function stripSurgeRackCustomEditor(source){const candidate=rustSourceDeclarations(source).outOfLineDefinitions.find"
    ));
    assert!(adapter.contains(
        "function dedupeRepeatedTopLevelTypes(source){const seen=new Set,removals=[];for(const candidate of rustSourceDeclarations(source).typeDeclarations)"
    ));
    assert!(adapter.contains(
        "function dedupeRepeatedTopLevelEnums(source){const seen=new Set,removals=[];for(const candidate of rustSourceDeclarations(source).enumDeclarations)"
    ));
    assert!(adapter.contains(
        "namespaceVariableDeclarations=report.namespaceVariableDeclarations.map(candidate=>normalizedNamespaceVariableDeclaration"
    ));
    assert!(adapter.contains("typeSource=String(candidate?.typeSource??\"\")"));
    assert!(adapter.contains(
        "activeNamespaceVariableDeclarationsByFile=rustModelAnalysis?.namespaceVariableDeclarationsByFile??null"
    ));
    assert!(adapter.contains(
        "function rustNamespaceVariableDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceVariableDeclarationsByFile?.has(resolved))return rustSourceDeclarations(source).namespaceVariableDeclarations"
    ));
    assert!(adapter.contains(
        "for(const externSource of externSources)for(const candidate of rustNamespaceVariableDeclarations(externSource.file,externSource.source))"
    ));
    assert!(adapter.contains("const {typeSource:type,name,arrayExtent:extent,cLinkage}=candidate"));
    assert!(adapter.contains(
        "for(const candidate of rustNamespaceVariableDeclarations(file,source))if(candidate.externDeclaration"
    ));
    assert!(adapter.contains(
        "namespaceUsingDeclarations=report.namespaceUsingDeclarations.map(candidate=>normalizedNamespaceUsingDeclaration"
    ));
    assert!(adapter.contains(
        "function dedupeRepeatedNamespaceVariables(source){const seen=new Set,removals=[];for(const candidate of rustSourceDeclarations(source).namespaceVariableDeclarations)"
    ));
    assert!(adapter.contains(
        "function dedupeRepeatedNamespaceConstants(source){const seen=new Set,removals=[],pattern="
    ));
    assert!(adapter.contains(
        "for(const candidate of rustSourceDeclarations(source).namespaceVariableDeclarations)"
    ));
    assert!(adapter.contains(
        "activeNamespaceUsingDeclarationsByFile=rustModelAnalysis?.namespaceUsingDeclarationsByFile??null"
    ));
    assert!(adapter.contains(
        "function rustNamespaceUsingDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceUsingDeclarationsByFile?.has(resolved))return rustSourceDeclarations(source).namespaceUsingDeclarations"
    ));
    assert!(adapter.contains(
        "function rustProjectedNamespaceUsingDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceUsingDeclarationsByFile?.has(resolved))return rustSourceDeclarations(source).namespaceUsingDeclarations"
    ));
    assert!(adapter.contains(
        "return declarations.filter(candidate=>retained.includes(candidate.rawDeclaration))"
    ));
    assert!(adapter.contains(
        "function namespaceSpecificUsingDeclarations(source,file=null){const declarations=[];for(const candidate of file?rustProjectedNamespaceUsingDeclarations(file,source):rustSourceDeclarations(source).namespaceUsingDeclarations)"
    ));
    assert!(adapter.contains("namespaceSpecificUsingDeclarations(header.source,header.file)"));
    assert!(adapter.contains(
        "function namespaceGlobalDefinitions(source,reference,relativeNamespace=[],existing=\"\",file=null){const candidates=[];for(const candidate of file?rustNamespaceVariableDeclarations(file,source):rustSourceDeclarations(source).namespaceVariableDeclarations)"
    ));
    assert!(adapter.contains("if(candidate.externDeclaration)continue"));
    assert!(adapter.contains(
        "names=[...new Set(rustSourceDeclarations(referenceSource).namespaceVariableDeclarations.filter(candidate=>candidate.externDeclaration)"
    ));
    assert!(adapter.contains(
        "function exactNamespaceGlobalDefinitions(source,reference,targetNamespace=[]){\n  const candidates=[];\n  for(const candidate of rustSourceDeclarations(source).namespaceVariableDeclarations)"
    ));
    assert!(adapter.contains("for(const dependency of referencesByName.get(name)??[])"));
    for removed in [
        "rustCandidates=file?rustFreeFunctionDefinitions(file,source):null",
        "rustCandidates===null?",
        "function outOfLineDefaultedDefinitions",
        "typeNamespaces=new Map,patterns=[",
        "for(const pattern of patterns)for(const match of code.matchAll(pattern))",
        "function dedupeFreeFunctionDefinitions(source){const pattern=",
        "function outOfLineFreeFunctionDefinitions(source,functionName,preserveNamespace=false,fallbackNamespaces=[]){const name=baseTypeName(functionName).split(\"::\").at(-1),escaped=",
        "function stripRepeatedDefaultArgumentsOnDefinitions(source){const code=sourceWithoutComments(source)",
        "canonical=signature=>stripFunctionDefaultArguments(signature)",
        "if(browserBody!==body)return adaptStbImagePointerBrowserBody(browserBody);\n  let result=\"\",start=0,index=0,quote=\"\",lineComment=false,blockComment=false;",
        "function deferFreeFunctionsReferencingTypes(source,typeNames){const ranges=[],definitions=[],pattern=",
        "function removeOutOfLineDefinitions(source,className){const name=baseTypeName(className).split(\"::\").at(-1),escaped=",
        "function removeQualifiedFreeFunction(source,name){const escaped=",
        "function stripPluginInitFunctions(source){let result=source;for(let pass=0;pass<16;pass++)",
        "function referencedVecDspHelpers(source,reference){const helpers=[];for(const match of source.matchAll",
        "function removeFreeFunction(source,name){const escaped=name.replace(/[.*+?^${}()|[\\]\\\\]/g,\"\\\\$&\"),match=",
        "for(const match of code.matchAll(pattern)){const owner=",
        "function normalizeConditionalTemplateImplementations(source){\n  const pattern=",
        "source.matchAll(/^\\s*extern\\s+(.+?)\\s+([*&]*)([A-Za-z_]\\w*)",
        "function replaceOutOfLineMethod(source,className,method,replacement){const escapedClass=",
        "const replacements=[],pattern=/\\bstd::string",
        "const source=fs.readFileSync(file,\"utf8\"),pattern=new RegExp(`template\\\\s*<>\\\\s*[^;{}]+\\\\bVCOConfig",
        "const source=fs.readFileSync(file,\"utf8\"),pattern=new RegExp(`template\\\\s*<>[\\\\s\\\\S]{0,240}?\\\\bFXConfig",
        "function stripSurgeRackCustomEditor(source){const match=",
        "function stubInlineVoidMethod(source,name){const escaped=name.replace(/[.*+?^${}()|[\\]\\\\]/g,\"\\\\$&\"),match=",
        "function replaceInlineMethodBody(source,pattern,body){const match=pattern.exec(source)",
        "function appendInlineMethodStatement(source,pattern,statement){const match=pattern.exec(source)",
        "function prependInlineMethodBody(source,pattern,prefix){const match=pattern.exec(source)",
        "function dedupeRepeatedTopLevelTypes(source){const seen=new Set,removals=[],pattern=",
        "function dedupeRepeatedTopLevelEnums(source){const seen=new Set,removals=[],pattern=",
        "function dedupeRepeatedNamespaceVariables(source){const code=sourceWithoutComments(source)",
        "function namespaceSpecificUsingDeclarations(source){const declarations=[];for(const match of source.matchAll",
        "function namespaceGlobalDefinitions(source,reference,relativeNamespace=[],existing=\"\"){const candidates=[],pattern=",
        "names=[...new Set([...referenceSource.matchAll(/^\\s*extern",
        "function exactNamespaceGlobalDefinitions(source,reference,targetNamespace=[]){\n  const candidates=[],pattern=",
        "externSource.matchAll(/^\\s*extern",
        "externSource.slice(0,match.index).matchAll(/\\bextern",
        "for(const match of code.matchAll(/^[ \\t]*[^;{}\\n]+\\([^;{}\\n]*\\)",
        "for(const pattern of [/^\\s*typedef",
        "function enumRecordInNamespace(source,names,targetNamespace=[]){\n  for(const name of Array.isArray(names)?names:[names])",
        "function anonymousTypedefDeclarationSource",
        "anonymousTypedefDeclarationSource(header.source,name)",
        "function declaredBases(source,className){const name=baseTypeName(className),match=new RegExp",
        "function enclosingNamespaces(source,className){const classIndex=classDeclarationMatch",
        "function removeClassDefinition(source,className){const match=classDeclarationMatch",
        "templateDeclaration=new RegExp(`\\\\btemplate\\\\s*<([^>]+)>\\\\s*(?:struct|class)",
        "rustStart=typeDeclaration&&source[typeDeclaration.bodyStart-1]",
        "const name=baseTypeName(className),match=new RegExp(`\\\\b(?:struct|class)\\\\s+${name}",
        "function classDeclarationMatch(",
        "function structBody(",
        "typedef=aliasCandidates===null?new RegExp",
        "const body=structBody(source,owner)",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
}

#[test]
fn plugin_header_type_closure_uses_rust_declaration_facts() {
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    let plugin_globals = adapter
        .split("function referencedPluginGlobalParts(sourceDir,analysis){")
        .nth(1)
        .and_then(|tail| tail.split("function referencedPluginGlobals").next())
        .expect("plugin global collector should be present");
    assert!(plugin_globals.contains(
        "sourceDeclarations=rustSourceDeclarations(source),analysisDeclarations=rustSourceDeclarations(analysis)"
    ));
    assert!(plugin_globals
        .contains("...sourceDeclarations.typeAliases.filter(candidate=>candidate.namespaceScope)"));
    assert!(plugin_globals.contains(
        "...sourceDeclarations.typeDeclarations.filter(candidate=>candidate.namespaceScope"
    ));
    assert!(plugin_globals.contains(
        "...sourceDeclarations.enumDeclarations.filter(candidate=>candidate.namespaceScope)"
    ));
    assert!(plugin_globals.contains("supportCandidates.length"));
    assert!(plugin_globals.contains("typeReference+=`\\n${candidate.wrapped}`"));
    assert!(plugin_globals.contains("rustSourceFreeFunctionDefinitions(source)"));
    assert!(plugin_globals.contains("rustFreeFunctionDeclarations(file,source)"));
    assert!(plugin_globals
        .contains("rustNamespaceConstantDeclarations(candidate.file,candidate.source)"));
    assert!(plugin_globals.contains("constantCandidates"));
    assert!(plugin_globals.contains("ordered.push(candidate)"));
    assert!(plugin_globals.contains("helperReferences.get(name)"));
    assert!(plugin_globals.contains("structuredReferences.add(reference)"));
    for removed in [
        "source.matchAll(/\\b(?:typedef",
        "source.matchAll(/\\b(?:struct|class)",
        "source.matchAll(/\\benum(?:\\s+class",
        "functionNames=[...new Set",
        "outOfLineFreeFunctionDefinitions(source,name,true)",
        "outOfLineFreeFunctionDefinitions(helperImplementationSource,name,true)",
        "for(const match of source.matchAll(/^[ \\t]*(?:(?:inline|static|constexpr|consteval",
        "for(const match of constantSource.matchAll(/^[ \\t]*(?:(?:inline|static)",
    ] {
        assert!(
            !plugin_globals.contains(removed),
            "{removed} should be removed from plugin header type discovery"
        );
    }
}

#[test]
fn dependency_header_discovery_uses_rust_declaration_facts() {
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    assert!(adapter.contains("function dependencyDeclarationFacts(source){"));
    assert!(adapter
        .contains("...declarations.typeDeclarations.filter(candidate=>candidate.namespaceScope)"));
    assert!(adapter.contains(
        "...declarations.freeFunctionDefinitions.map(candidate=>({start:candidate.start,name:candidate.name,namespace:candidate.namespace,kind:\"function\"}))"
    ));
    assert!(adapter.contains(
        "...declarations.namespaceVariableDeclarations.map(candidate=>({start:candidate.start,name:candidate.name,namespace:candidate.namespace,kind:\"variable\"}))"
    ));
    assert!(adapter.contains(
        "{functionNames,namespaceNames,qualifiedNames}=dependencyDeclarationFacts(source)"
    ));
    assert!(adapter
        .contains("qualified=(header.qualifiedNames.get(name)??[]).some(identity=>new RegExp"));
    assert!(adapter.contains(
        "function localPlainStructDefinitions(source,className,targetBody,excludedNames=new Set){\n  const declarations=rustSourceDeclarations(source),target=matchingTypeDeclaration"
    ));
    assert!(adapter.contains(
        "for(const candidate of declarations.typeDeclarations){\n    const name=candidate.name;"
    ));
    assert!(adapter
        .contains("for(const candidate of rustSourceDeclarations(analysis).enumDeclarations)"));
    assert!(adapter
        .contains("if(!candidate.namespaceScope||candidate.name===null||!candidate.complete"));
    for removed in [
        "const names=[],candidates=[],collect=pattern",
        "let cursor=0,depth=0,namespaceDepth=0,quote=\"\"",
        "for(const match of source.matchAll(/\\btypedef\\s+(?:struct|class|union|enum)\\s*\\{/g)",
        "functionNames=[...new Set([...source.matchAll(/^[ \\t]*(?:template",
        "qualified=[...header.source.matchAll(new RegExp",
        "const classMatch=new RegExp(`\\\\b(?:struct|class)\\\\s+${baseTypeName(className)}",
        "for(const match of prefix.matchAll(/\\b(?:struct|class)",
        "for(const match of analysis.matchAll(/\\benum",
    ] {
        assert!(!adapter.contains(removed), "{removed} should be removed");
    }
}

#[test]
fn preprocessing_can_select_branches_without_expanding_object_macros() {
    let output = run_preprocess(serde_json::json!({
        "source": "#define VALUE BASE\n#if FLAG\nint value = VALUE;\n#else\nint value = 0;\n#endif",
        "initialDefinitions": {"BASE": "4", "FLAG": "1"},
        "expandObjectMacros": false
    }));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("preprocessor report should be JSON");
    assert_eq!(report["source"], "#define VALUE BASE\nint value = VALUE;");
    assert_eq!(
        report["definitions"],
        serde_json::json!({"BASE": "4", "FLAG": "1", "VALUE": "BASE"})
    );
}

#[test]
fn numeric_constant_analysis_matches_macros_enums_declarations_and_string_arrays() {
    let output = run_constants(serde_json::json!({
        "source": r#"
#define CHANNELS 2
constexpr int STEPS = CHANNELS + 1;
const int A = 1, B = A + 2;
enum NamedIds { Zero, MULTIPLE(Input, CHANNELS), Count };
enum { UNIQUE = 5 };
namespace fixture { int GLOBAL_COUNT = STEPS + 1; }
struct Hidden { int MEMBER_COUNT = 9; };
static const char* labels[] = {"One", "Two"};
struct ArrayOwner { static constexpr auto values = std::array{Item{"Alpha"}, Item{"Beta"}}; };
static constexpr auto rootValues = std::array{Item{"Root"}, Item{"Leaf"}, Item{"Stem"}};
int n_osc_params = 0;
"#,
        "owner": "RootModule",
        "initial": {
            "PORT_MAX_CHANNELS": 12,
            "OFFSET": 4,
            "n_osc_params": 99
        }
    }));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("constant report should be JSON");
    for (name, value) in [
        ("PORT_MAX_CHANNELS", serde_json::json!(12)),
        ("OFFSET", serde_json::json!(4)),
        ("n_osc_params", serde_json::json!(7)),
        ("CHANNELS", serde_json::json!(2)),
        ("STEPS", serde_json::json!(3)),
        ("A", serde_json::json!(1)),
        ("B", serde_json::json!(3)),
        ("Zero", serde_json::json!(0)),
        ("Input", serde_json::json!(1)),
        ("Count", serde_json::json!(3)),
        ("UNIQUE", serde_json::json!(5)),
        ("GLOBAL_COUNT", serde_json::json!(4)),
        ("labels_0", serde_json::json!("One")),
        ("labels_1", serde_json::json!("Two")),
        ("ArrayOwner::values.size()", serde_json::json!(2)),
        ("ArrayOwner::values[0].name", serde_json::json!("Alpha")),
        ("ArrayOwner::values[1].name", serde_json::json!("Beta")),
        ("RootModule::rootValues.size()", serde_json::json!(3)),
        ("RootModule::rootValues[0].name", serde_json::json!("Root")),
        ("RootModule::rootValues[2].name", serde_json::json!("Stem")),
    ] {
        assert_eq!(report["constants"][name], value, "constant {name}");
    }
    assert!(report["constants"].get("MEMBER_COUNT").is_none());
    let adapter = fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts/scaffold-library-module.mjs"),
    )
    .expect("Node adapter should be readable");
    assert!(!adapter.contains("legacyNumericConstants"));
    assert!(!adapter.contains("legacyMemberArrayConstants"));
}

#[test]
fn inventory_excludes_development_trees_and_separates_nested_repositories() {
    let temporary = TemporaryDirectory::new("analysis-inventory");
    let root = temporary.path().join("plugin");
    for directory in [
        "src",
        "docs",
        "tests",
        "vendor/dependency/src",
        "vendor/dependency/child/src",
        "metamodule-plugin-sdk/src",
    ] {
        fs::create_dir_all(root.join(directory)).expect("fixture directory should be created");
    }
    for (relative, contents) in [
        ("src/Module.cpp", "// module\n"),
        ("src/Module.hpp", "#pragma once\n"),
        ("src/miniaudio.h", "// intentionally excluded\n"),
        ("docs/Example.cpp", "// docs\n"),
        ("tests/Test.cpp", "// tests\n"),
        ("vendor/dependency/src/Dependency.cpp", "// dependency\n"),
        ("vendor/dependency/child/src/Child.cpp", "// child\n"),
        ("metamodule-plugin-sdk/src/Firmware.cpp", "// firmware\n"),
    ] {
        fs::write(root.join(relative), contents).expect("fixture source should be written");
    }
    fs::write(root.join("vendor/dependency/.git"), "gitdir: fixture\n")
        .expect("nested repository marker should be written");
    fs::write(
        root.join("vendor/dependency/child/.git"),
        "gitdir: fixture\n",
    )
    .expect("child repository marker should be written");
    fs::write(root.join("metamodule-plugin-sdk/.git"), "gitdir: fixture\n")
        .expect("SDK repository marker should be written");
    fs::write(
        root.join(".gitmodules"),
        "[submodule \"dependency\"]\n\tpath = vendor/dependency\n\turl = https://github.com/example/Dependency.git\n[submodule \"sdk\"]\n\tpath = metamodule-plugin-sdk\n\turl = https://github.com/example/SDK.git\n",
    )
    .expect("root submodules should be written");
    fs::write(
        root.join("vendor/dependency/.gitmodules"),
        "[submodule \"child\"]\n\tpath = child\n\turl = https://github.com/example/Child.git\n",
    )
    .expect("nested submodules should be written");

    let output = run(&root);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("inventory report should be JSON");
    let canonical_root = fs::canonicalize(&root).expect("source root should resolve");
    let mut source_files = report["sourceFiles"]
        .as_array()
        .expect("sourceFiles should be an array")
        .iter()
        .map(|value| {
            Path::new(value.as_str().expect("source path should be a string"))
                .strip_prefix(&canonical_root)
                .expect("source path should stay under the root")
                .to_string_lossy()
                .into_owned()
        })
        .collect::<Vec<_>>();
    source_files.sort();
    assert_eq!(source_files, ["src/Module.cpp", "src/Module.hpp"]);
    let repository_roots = report["repositoryRoots"]
        .as_array()
        .expect("repositoryRoots should be an array")
        .iter()
        .map(|value| {
            let path = Path::new(value.as_str().expect("repository path should be a string"));
            if path == canonical_root {
                ".".to_owned()
            } else {
                path.strip_prefix(&canonical_root)
                    .expect("repository should stay under root")
                    .to_string_lossy()
                    .into_owned()
            }
        })
        .collect::<Vec<_>>();
    assert_eq!(
        repository_roots,
        [".", "vendor/dependency", "vendor/dependency/child"]
    );
}

#[test]
fn dependency_file_inventory_replaces_the_generic_recursive_node_scan() {
    let temporary = TemporaryDirectory::new("analysis-dependency-files");
    let root = temporary.path().join("plugin");
    for directory in [
        "src/nested",
        "docs",
        "build",
        "third_party/library",
        "tests",
        "generated.building-fixture",
        "STM32F4xx_StdPeriph_Driver/src",
    ] {
        fs::create_dir_all(root.join(directory)).expect("fixture directory should be created");
    }
    for relative in [
        "src/Module.cpp",
        "src/nested/State.hpp",
        "src/miniaudio.h",
        "src/Inline.inl",
        "docs/Example.cpp",
        "build/Excluded.cpp",
        "third_party/library/Hidden.cpp",
        "tests/Test.cpp",
        "generated.building-fixture/Partial.cpp",
        "STM32F4xx_StdPeriph_Driver/src/Firmware.c",
    ] {
        fs::write(root.join(relative), "// fixture\n").expect("fixture source should be written");
    }

    let output = run_files(&root);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("file inventory report should be JSON");
    let canonical_root = fs::canonicalize(&root).expect("source root should resolve");
    assert_eq!(
        Path::new(
            report["sourceRoot"]
                .as_str()
                .expect("sourceRoot should be a string")
        ),
        canonical_root
    );
    let source_files = report["sourceFiles"]
        .as_array()
        .expect("sourceFiles should be an array")
        .iter()
        .map(|value| {
            Path::new(value.as_str().expect("source path should be a string"))
                .strip_prefix(&canonical_root)
                .expect("source file should stay under the root")
                .to_string_lossy()
                .into_owned()
        })
        .collect::<Vec<_>>();
    assert_eq!(
        source_files,
        [
            "docs/Example.cpp",
            "src/Inline.inl",
            "src/Module.cpp",
            "src/miniaudio.h",
            "src/nested/State.hpp"
        ]
    );

    let vendor_output = run_files_with_profile(&root, "vendor");
    assert!(
        vendor_output.status.success(),
        "{}",
        String::from_utf8_lossy(&vendor_output.stderr)
    );
    let vendor_report: Value = serde_json::from_slice(&vendor_output.stdout)
        .expect("vendor file inventory report should be JSON");
    assert_eq!(vendor_report["profile"], "vendor");
    let vendor_files = vendor_report["sourceFiles"]
        .as_array()
        .expect("vendor sourceFiles should be an array")
        .iter()
        .map(|value| {
            Path::new(
                value
                    .as_str()
                    .expect("vendor source path should be a string"),
            )
            .strip_prefix(&canonical_root)
            .expect("vendor source file should stay under the root")
            .to_string_lossy()
            .into_owned()
        })
        .collect::<Vec<_>>();
    assert_eq!(
        vendor_files,
        [
            "STM32F4xx_StdPeriph_Driver/src/Firmware.c",
            "docs/Example.cpp",
            "generated.building-fixture/Partial.cpp",
            "src/Module.cpp",
            "src/miniaudio.h",
            "src/nested/State.hpp",
            "tests/Test.cpp",
            "third_party/library/Hidden.cpp"
        ]
    );
}

#[test]
fn inventory_rejects_an_escaping_submodule_declaration() {
    let temporary = TemporaryDirectory::new("analysis-escape");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(&root).expect("source root should be created");
    fs::write(
        root.join(".gitmodules"),
        "[submodule \"escape\"]\n\tpath = ../escape\n\turl = https://github.com/example/Escape.git\n",
    )
    .expect("unsafe submodule declaration should be written");
    let output = run(&root);
    assert!(!output.status.success());
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("Unsafe submodule path ../escape"),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn model_candidate_scan_ignores_comments_and_literals_and_reports_js_offsets() {
    let temporary = TemporaryDirectory::new("analysis-model-candidates");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(root.join("src")).expect("source directory should be created");
    let source = r#"// 😀 createModel<CommentModule, CommentWidget>("Comment")
const char* text = "createModel<StringModule, StringWidget>(\"String\")";
const char* aliasText = "using FakeAlias = FakeModule;";
auto typeText = "struct FakeType : WrongBase {";
auto enumText = "enum FakeIds { FAKE_ID, NUM_FAKE_IDS };";
// struct CommentType : WrongBase {
// enum CommentIds { COMMENT_ID, NUM_COMMENT_IDS };
/*
#include "Comment.hpp"
*/
const char* raw = R"fixture(
#include "Raw.hpp"
createModel<RawModule, RawWidget>("Raw"))fixture";
#include "plugin.hpp"
#include "support/Helper.hpp"
#include "Ambiguous.hpp"
#include <utility>
// constexpr auto CommentSlug {"Comment"};
constexpr auto RealSlug {"Real"};
static const std::string SecondSlug = "Second";
using RealAlias = RealModule;
typedef SecondModule SecondAlias;
typedef struct {
int value;
} AnonymousSupport;
// using CommentAlias = CommentModule;
/* createOtherModel<BlockModule, BlockWidget>("Block") */
Model* real = plugin::createFancyModel<RealModule, RealWidget>("Real");
Model* second = createModel<SecondModule, SecondWidget>("Second");
namespace outer::inner {
Model* nested = createModel<Wrapper<Pair<int, float>>, NestedWidget>("Nested (factory)");
template <typename Engine, int Channels = 2>
struct AliasOwner final : public Base<Engine>, virtual Interface<Channels> {
using Module = Processor<Engine, Channels>;
enum class ParamIds : unsigned {
FIRST_PARAM = 2,
MULTIPLE(BAND_PARAM, Channels),
NUM_PARAMS
};
void configure() {
auto ignoredCall = "configInput(FAKE_INPUT, \"Fake\")";
// configOutput(FAKE_OUTPUT, "Fake");
config(NUM_PARAMS, 0, 1, 0);
configParam<FixtureQuantity<std::pair<int, float>>>(FIRST_PARAM, 0.f, 1.f, .5f, "Level");
for (int index = 1; index < Channels; index++) {
auto label = string::f("Input %d", index + 1);
configInput(FIRST_INPUT + index, label);
paramQuantities[FIRST_INPUT + index]->snapEnabled = true;
}
}
};
enum OutputIds {
LEFT_OUTPUT,
RIGHT_OUTPUT = 1 << 2,
NUM_OUTPUTS
};
enum InputIds {
#if ENABLE_INPUT
ACTIVE_INPUT,
#endif
NUM_INPUTS
};
}
"#;
    let file = root.join("src/Models.cpp");
    fs::write(&file, source).expect("model source should be written");
    fs::create_dir_all(root.join("src/support")).expect("support directory should be created");
    fs::write(root.join("src/plugin.hpp"), "#pragma once\n")
        .expect("plugin header should be written");
    fs::write(
        root.join("src/support/Helper.hpp"),
        "#pragma once\nstatic int sharedValue = 1;\n",
    )
    .expect("support header should be written");
    fs::write(
        root.join("src/support/Helper.cpp"),
        "static int sharedValue = 2;\n",
    )
    .expect("duplicate implementation should be written");
    fs::write(root.join("src/Engine.hpp"), "#pragma once\n")
        .expect("engine header should be written");
    fs::write(root.join("src/Engine.cpp"), "// engine implementation\n")
        .expect("engine implementation should be written");
    for directory in ["one", "two"] {
        fs::create_dir_all(root.join("src").join(directory))
            .expect("ambiguous directory should be created");
        fs::write(
            root.join("src").join(directory).join("Ambiguous.hpp"),
            "#pragma once\n",
        )
        .expect("ambiguous header should be written");
    }
    let output = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "model-candidates",
            "--source-dir",
            root.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("model candidate command should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("candidate report should be JSON");
    let candidates = report["candidates"]
        .as_array()
        .expect("candidates should be an array");
    assert_eq!(candidates.len(), 3);
    assert_eq!(candidates[0]["factory"], "createFancyModel");
    assert_eq!(candidates[0]["templateSource"], "RealModule, RealWidget");
    assert_eq!(candidates[0]["callSource"], "\"Real\"");
    assert_eq!(
        candidates[0]["templateArguments"],
        serde_json::json!(["RealModule", "RealWidget"])
    );
    assert_eq!(
        candidates[0]["callArguments"],
        serde_json::json!(["\"Real\""])
    );
    assert_eq!(candidates[0]["namespace"], serde_json::json!([]));
    assert_eq!(
        candidates[0]["start"],
        source[..source
            .find("createFancyModel")
            .expect("factory should exist")]
            .encode_utf16()
            .count()
    );
    assert_eq!(candidates[1]["factory"], "createModel");
    assert_eq!(
        candidates[1]["templateSource"],
        "SecondModule, SecondWidget"
    );
    assert_eq!(candidates[1]["callSource"], "\"Second\"");
    assert_eq!(
        candidates[1]["start"],
        source[..source
            .find("createModel<SecondModule")
            .expect("factory should exist")]
            .encode_utf16()
            .count()
    );
    assert_eq!(
        candidates[2]["templateSource"],
        "Wrapper<Pair<int, float>>, NestedWidget"
    );
    assert_eq!(
        candidates[2]["templateArguments"],
        serde_json::json!(["Wrapper<Pair<int, float>>", "NestedWidget"])
    );
    assert_eq!(candidates[2]["callSource"], "\"Nested (factory)\"");
    assert_eq!(
        candidates[2]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    let constants = report["stringConstants"]
        .as_array()
        .expect("stringConstants should be an array");
    assert_eq!(constants.len(), 4);
    assert_eq!(constants[0]["name"], "text");
    assert_eq!(constants[1]["name"], "aliasText");
    assert_eq!(constants[2]["name"], "RealSlug");
    assert_eq!(constants[2]["expression"], "{\"Real\"}");
    assert_eq!(constants[2]["value"], "Real");
    assert_eq!(constants[3]["name"], "SecondSlug");
    assert_eq!(constants[3]["expression"], "\"Second\"");
    assert_eq!(constants[3]["value"], "Second");
    let aliases = report["typeAliases"]
        .as_array()
        .expect("typeAliases should be an array");
    assert_eq!(aliases.len(), 3);
    assert_eq!(aliases[0]["name"], "RealAlias");
    assert_eq!(aliases[0]["target"], "RealModule");
    assert_eq!(aliases[0]["kind"], "using");
    assert_eq!(aliases[0]["namespace"], serde_json::json!([]));
    assert_eq!(aliases[0]["owners"], serde_json::json!([]));
    assert_eq!(aliases[1]["name"], "SecondAlias");
    assert_eq!(aliases[1]["target"], "SecondModule");
    assert_eq!(aliases[1]["kind"], "typedef");
    assert_eq!(aliases[2]["name"], "Module");
    assert_eq!(aliases[2]["target"], "Processor<Engine, Channels>");
    assert_eq!(aliases[2]["kind"], "using");
    assert_eq!(
        aliases[2]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    assert_eq!(
        aliases[2]["owners"],
        serde_json::json!([{
            "name": "AliasOwner",
            "templateParameters": ["Engine", "Channels"]
        }])
    );
    let anonymous_typedefs = report["anonymousTypedefDeclarations"]
        .as_array()
        .expect("anonymousTypedefDeclarations should be an array");
    assert_eq!(anonymous_typedefs.len(), 1, "{anonymous_typedefs:#?}");
    assert_eq!(anonymous_typedefs[0]["name"], "AnonymousSupport");
    assert_eq!(anonymous_typedefs[0]["kind"], "struct");
    assert_eq!(anonymous_typedefs[0]["namespace"], serde_json::json!([]));
    assert_eq!(anonymous_typedefs[0]["namespaceScope"], true);
    assert_eq!(anonymous_typedefs[0]["owners"], serde_json::json!([]));
    let declarations = report["typeDeclarations"]
        .as_array()
        .expect("typeDeclarations should be an array");
    assert_eq!(declarations.len(), 1);
    assert_eq!(declarations[0]["name"], "AliasOwner");
    assert_eq!(declarations[0]["kind"], "struct");
    assert_eq!(
        declarations[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    assert_eq!(declarations[0]["owners"], serde_json::json!([]));
    let alias_declaration = source
        .find("struct AliasOwner")
        .expect("alias declaration should exist");
    let alias_template = source
        .find("template <typename Engine")
        .expect("alias template should exist");
    let alias_body_start = source[alias_declaration..]
        .find('{')
        .map(|offset| alias_declaration + offset + 1)
        .expect("alias body should open");
    let alias_body_end = source
        .find("};\nenum OutputIds")
        .expect("alias body should close");
    assert_eq!(
        declarations[0]["bodyStart"],
        source[..alias_body_start].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["bodyEnd"],
        source[..alias_body_end].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["declarationStart"],
        source[..alias_template].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["declarationEnd"],
        source[..alias_body_end + 2].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["templateSource"],
        "typename Engine, int Channels = 2"
    );
    assert_eq!(
        declarations[0]["templateParameters"],
        serde_json::json!(["Engine", "Channels"])
    );
    assert_eq!(
        declarations[0]["bases"],
        serde_json::json!(["Base<Engine>", "Interface<Channels>"])
    );
    let enum_declarations = report["enumDeclarations"]
        .as_array()
        .expect("enumDeclarations should be an array");
    assert_eq!(enum_declarations.len(), 3);
    assert_eq!(enum_declarations[0]["name"], "ParamIds");
    assert_eq!(enum_declarations[0]["scoped"], true);
    assert_eq!(
        enum_declarations[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    assert_eq!(
        enum_declarations[0]["owners"],
        serde_json::json!([{
            "name": "AliasOwner",
            "templateParameters": ["Engine", "Channels"]
        }])
    );
    assert_eq!(
        enum_declarations[0]["identifiers"],
        serde_json::json!([
            "FIRST_PARAM",
            {"base": "BAND_PARAM", "count": "Channels"},
            "NUM_PARAMS"
        ])
    );
    assert_eq!(
        enum_declarations[0]["assignments"],
        serde_json::json!({"FIRST_PARAM": "2"})
    );
    assert_eq!(enum_declarations[0]["complete"], true);
    let enum_start = source
        .find("enum class ParamIds")
        .expect("enum should exist");
    let enum_body_start = source[enum_start..]
        .find('{')
        .map(|offset| enum_start + offset + 1)
        .expect("enum body should open");
    let enum_body_end = source[enum_body_start..]
        .find('}')
        .map(|offset| enum_body_start + offset)
        .expect("enum body should close");
    assert_eq!(
        enum_declarations[0]["start"],
        source[..enum_start].encode_utf16().count()
    );
    assert_eq!(
        enum_declarations[0]["bodyStart"],
        source[..enum_body_start].encode_utf16().count()
    );
    assert_eq!(
        enum_declarations[0]["bodyEnd"],
        source[..enum_body_end].encode_utf16().count()
    );
    assert_eq!(enum_declarations[1]["name"], "OutputIds");
    assert_eq!(enum_declarations[1]["owners"], serde_json::json!([]));
    assert_eq!(enum_declarations[1]["complete"], true);
    assert_eq!(
        enum_declarations[1]["identifiers"],
        serde_json::json!(["LEFT_OUTPUT", "RIGHT_OUTPUT", "NUM_OUTPUTS"])
    );
    assert_eq!(
        enum_declarations[1]["assignments"],
        serde_json::json!({"RIGHT_OUTPUT": "1 << 2"})
    );
    assert_eq!(enum_declarations[2]["name"], "InputIds");
    assert_eq!(enum_declarations[2]["complete"], false);
    let config_calls = report["configCalls"]
        .as_array()
        .expect("configCalls should be an array");
    assert_eq!(config_calls.len(), 4);
    assert_eq!(config_calls[0]["name"], "config");
    assert_eq!(config_calls[0]["templateSource"], Value::Null);
    assert_eq!(
        config_calls[0]["arguments"],
        serde_json::json!(["NUM_PARAMS", "0", "1", "0"])
    );
    assert_eq!(
        config_calls[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    assert_eq!(
        config_calls[0]["owners"],
        serde_json::json!([{
            "name": "AliasOwner",
            "templateParameters": ["Engine", "Channels"]
        }])
    );
    assert_eq!(config_calls[1]["name"], "configParam");
    assert_eq!(
        config_calls[1]["templateSource"],
        "FixtureQuantity<std::pair<int, float>>"
    );
    assert_eq!(
        config_calls[1]["arguments"],
        serde_json::json!(["FIRST_PARAM", "0.f", "1.f", ".5f", "\"Level\""])
    );
    assert_eq!(config_calls[2]["name"], "configInput");
    assert_eq!(
        config_calls[2]["loops"],
        serde_json::json!([{
            "start": source[..source.find("for (int index").expect("loop should exist")].encode_utf16().count(),
            "end": source[..source.find("\n}\n}").expect("loop should close") + 2].encode_utf16().count(),
            "bodyStart": source[..source.find("{\nauto label").expect("loop body should open") + 1].encode_utf16().count(),
            "bodyEnd": source[..source.find("\n}\n}").expect("loop body should close") + 1].encode_utf16().count(),
            "variable": "index",
            "startExpression": "1",
            "endExpression": "Channels"
        }])
    );
    assert_eq!(
        config_calls[2]["stringBindings"],
        serde_json::json!([{
            "start": source[..source.find("auto label").expect("binding should exist")].encode_utf16().count(),
            "end": source[..source.find(";\nconfigInput").expect("binding should end") + 1].encode_utf16().count(),
            "name": "label",
            "expression": "string::f(\"Input %d\", index + 1)"
        }])
    );
    assert_eq!(config_calls[3]["name"], "rackWebSnapParam");
    assert_eq!(
        config_calls[3]["arguments"],
        serde_json::json!(["FIRST_INPUT + index"])
    );
    assert_eq!(config_calls[3]["synthetic"], true);
    assert_eq!(config_calls[3]["loops"], config_calls[2]["loops"]);
    let config_start = source
        .find("config(NUM_PARAMS")
        .expect("config call should exist");
    assert_eq!(
        config_calls[0]["start"],
        source[..config_start].encode_utf16().count()
    );
    let include_directives = report["includeDirectives"]
        .as_array()
        .expect("includeDirectives should be an array");
    assert_eq!(include_directives.len(), 4);
    assert_eq!(include_directives[0]["include"], "plugin.hpp");
    assert_eq!(include_directives[0]["angle"], false);
    assert_eq!(
        Path::new(
            include_directives[0]["target"]
                .as_str()
                .expect("plugin include should resolve")
        ),
        fs::canonicalize(root.join("src/plugin.hpp")).expect("plugin header should resolve")
    );
    assert_eq!(
        include_directives[0]["start"],
        source[..source
            .find("plugin.hpp")
            .expect("quoted include should exist")]
            .encode_utf16()
            .count()
    );
    assert_eq!(include_directives[1]["include"], "support/Helper.hpp");
    assert_eq!(
        Path::new(
            include_directives[1]["target"]
                .as_str()
                .expect("support include should resolve")
        ),
        fs::canonicalize(root.join("src/support/Helper.hpp"))
            .expect("support header should resolve")
    );
    assert_eq!(include_directives[2]["include"], "Ambiguous.hpp");
    assert!(include_directives[2]["target"].is_null());
    assert_eq!(include_directives[3]["include"], "utility");
    assert_eq!(include_directives[3]["angle"], true);
    assert!(include_directives[3]["target"].is_null());
    let companions = report["companionImplementations"]
        .as_array()
        .expect("companionImplementations should be an array");
    let engine = companions
        .iter()
        .find(|candidate| {
            candidate["header"]
                .as_str()
                .is_some_and(|header| header.ends_with("/Engine.hpp"))
        })
        .expect("engine companion report should exist");
    assert_eq!(engine["targets"].as_array().map(Vec::len), Some(1));
    assert!(engine["targets"][0]
        .as_str()
        .is_some_and(|target| target.ends_with("/Engine.cpp")));
    let helper = companions
        .iter()
        .find(|candidate| {
            candidate["header"]
                .as_str()
                .is_some_and(|header| header.ends_with("/support/Helper.hpp"))
        })
        .expect("helper companion report should exist");
    assert_eq!(helper["targets"], serde_json::json!([]));
}

#[test]
fn model_candidate_scan_reports_custom_and_metamodule_factories() {
    let temporary = TemporaryDirectory::new("analysis-model-registration-kinds");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(root.join("src")).expect("source directory should be created");
    let source = r#"const char* marker = "😀 Model* modelFake = []() { new FakeModel; }";
struct FluxModel : plugin::Model {
    engine::Module* createModule() override { return new fixture::FluxImpl; }
    app::ModuleWidget* createModuleWidget(engine::Module* module) override {
        return createFluxWidget(static_cast<Flux*>(module));
    }
};
Model* modelFlux = []() {
    plugin::Model* model = new FluxModel;
    model->slug = "Flux-Custom";
    return model;
}();
namespace MetaModule {
int* modelGenericKick = GenericModule<GenericKickInfo, GenericKickCore>::create();
int* modelInferred = GenericModule<InferredInfo>::create();
const char* decoy = "modelWrong = GenericModule<WrongInfo>::create()";
}
"#;
    let file = root.join("src/Models.cpp");
    fs::write(&file, source).expect("model source should be written");
    let output = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "model-candidates",
            "--source-dir",
            root.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("model candidate command should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("candidate report should be JSON");
    let custom = report["customModelCandidates"]
        .as_array()
        .expect("customModelCandidates should be an array");
    assert_eq!(custom.len(), 1, "{custom:#?}");
    assert_eq!(custom[0]["variableSlug"], "Flux");
    assert_eq!(custom[0]["slugSource"], "\"Flux-Custom\"");
    assert_eq!(custom[0]["modelType"], "FluxModel");
    assert_eq!(custom[0]["moduleType"], "fixture::FluxImpl");
    assert_eq!(custom[0]["widgetClass"], "FluxWidget");
    assert_eq!(custom[0]["namespace"], serde_json::json!([]));
    let custom_start = source
        .find("Model* modelFlux")
        .expect("custom model should exist");
    assert_eq!(
        custom[0]["start"],
        source[..custom_start].encode_utf16().count()
    );
    let meta = report["metaModuleCandidates"]
        .as_array()
        .expect("metaModuleCandidates should be an array");
    assert_eq!(meta.len(), 2, "{meta:#?}");
    assert_eq!(meta[0]["variableSlug"], "GenericKick");
    assert_eq!(
        meta[0]["templateArguments"],
        serde_json::json!(["GenericKickInfo", "GenericKickCore"])
    );
    assert_eq!(meta[1]["variableSlug"], "Inferred");
    assert_eq!(
        meta[1]["templateArguments"],
        serde_json::json!(["InferredInfo"])
    );
    assert_eq!(meta[0]["namespace"], serde_json::json!(["MetaModule"]));
    let meta_start = source
        .find("GenericModule<GenericKickInfo")
        .expect("MetaModule factory should exist");
    assert_eq!(
        meta[0]["start"],
        source[..meta_start].encode_utf16().count()
    );
}

#[test]
fn model_candidate_scan_resolves_single_widget_registration_context() {
    let temporary = TemporaryDirectory::new("analysis-single-widget-registration");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(root.join("src")).expect("source directory should be created");
    let header = root.join("src/Voice.hpp");
    fs::write(
        &header,
        r#"namespace fixture::voice {
struct VoiceModule : Module {};
template<class TModule> struct ModuleWidgetBase : ModuleWidget { using ModuleType = TModule; };
struct VoiceWidget : ModuleWidgetBase<VoiceModule> {};
}
"#,
    )
    .expect("widget header should be written");
    let source = r#"#include "Voice.hpp"
namespace fixture {
Model* modelVoice = createModel<voice::VoiceWidget>("Voice");
}
"#;
    let file = root.join("src/Voice.cpp");
    fs::write(&file, source).expect("model source should be written");
    let output = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "model-candidates",
            "--source-dir",
            root.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("model candidate command should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("candidate report should be JSON");
    let candidates = report["candidates"]
        .as_array()
        .expect("candidates should be an array");
    assert_eq!(candidates.len(), 1, "{candidates:#?}");
    assert_eq!(
        candidates[0]["templateArguments"],
        serde_json::json!(["voice::VoiceWidget"])
    );
    assert_eq!(candidates[0]["registeredModuleType"], "VoiceModule");
    assert_eq!(
        candidates[0]["widgetNamespace"],
        serde_json::json!(["fixture", "voice"])
    );
    let context = candidates[0]["contextFiles"]
        .as_array()
        .expect("contextFiles should be an array");
    assert_eq!(context.len(), 2, "{context:#?}");
    assert_eq!(
        Path::new(
            context[0]
                .as_str()
                .expect("source context should be a path")
        ),
        fs::canonicalize(&file).expect("source should resolve")
    );
    assert_eq!(
        Path::new(
            context[1]
                .as_str()
                .expect("header context should be a path")
        ),
        fs::canonicalize(&header).expect("header should resolve")
    );
}

#[test]
fn model_candidate_scan_reports_raw_out_of_line_member_ranges() {
    let temporary = TemporaryDirectory::new("analysis-out-of-line-definitions");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(root.join("src")).expect("source directory should be created");
    let source = r#"// 😀 Processor<int>::commented() { return; }
const char* fake = "Processor<int>::literal() { return; }";
namespace outer::inner {
inline constexpr int sharedScale = 3;
using namespace dsp_support;
// A declaration may follow comments before any statement delimiter.
/* The type scanner must ignore this block too. */
template <typename Engine>
struct Processor {
    Processor();
    ~Processor();
    void process(int value) const;
    bool operator==(const Processor&) const;
    static const int table[2];
};

template <typename Engine>
void Processor<Engine>::process(int value) const {
    if (value > 0) {
        value--;
    }
}

void Processor<int>::Nested::reset() {
}

Processor<int>::Processor() : first{1}, second{2} {
}

Processor<int>::~Processor() noexcept = default;

bool
Processor<int>::operator==(const Processor<int>&) const {
    return true;
}

template <typename Engine>
const int Processor<Engine>::table[2] = {1, 2};

int declaredOnly(int value = 1);

static int helper(int value) {
    return leaf(value);
}

static int leaf(int value) {
    return value + 1;
}
}
"#;
    let file = root.join("src/Processor.cpp");
    fs::write(&file, source).expect("out-of-line source should be written");
    let output = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "model-candidates",
            "--source-dir",
            root.to_str().expect("source path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("model candidate command should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("candidate report should be JSON");
    let types = report["typeDeclarations"]
        .as_array()
        .expect("typeDeclarations should be an array");
    assert_eq!(types.len(), 1, "{types:#?}");
    assert_eq!(types[0]["name"], "Processor");
    assert_eq!(
        types[0]["templateParameters"],
        serde_json::json!(["Engine"])
    );
    let constants = report["namespaceConstantDeclarations"]
        .as_array()
        .expect("namespaceConstantDeclarations should be an array");
    assert_eq!(constants.len(), 1, "{constants:#?}");
    assert_eq!(constants[0]["name"], "sharedScale");
    assert_eq!(
        constants[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    let using_directives = report["namespaceUsingDirectives"]
        .as_array()
        .expect("namespaceUsingDirectives should be an array");
    assert_eq!(using_directives.len(), 1, "{using_directives:#?}");
    assert_eq!(using_directives[0]["target"], "dsp_support");
    assert_eq!(
        using_directives[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    assert_eq!(
        Path::new(
            using_directives[0]["file"]
                .as_str()
                .expect("using directive should carry its source file")
        ),
        fs::canonicalize(&file).expect("source should resolve")
    );
    let definitions = report["outOfLineDefinitions"]
        .as_array()
        .expect("outOfLineDefinitions should be an array");
    assert_eq!(definitions.len(), 6, "{definitions:#?}");
    let expected = [
        (
            "function",
            source
                .find("template <typename Engine>\nvoid Processor<Engine>::process")
                .expect("templated method should exist"),
            "Processor",
            serde_json::json!(["Processor"]),
            Some("template <typename Engine> void Processor<Engine>::process(int value) const"),
        ),
        (
            "function",
            source
                .find("void Processor<int>::Nested::reset")
                .expect("nested method should exist"),
            "Nested",
            serde_json::json!(["Processor", "Nested"]),
            Some("void Processor<int>::Nested::reset()"),
        ),
        (
            "function",
            source
                .find("Processor<int>::Processor()")
                .expect("constructor should exist"),
            "Processor",
            serde_json::json!(["Processor"]),
            Some("Processor<int>::Processor() : first{1}, second{2}"),
        ),
        (
            "function",
            source
                .find("bool\nProcessor<int>::operator==")
                .expect("detached return should exist"),
            "Processor",
            serde_json::json!(["Processor"]),
            Some("bool Processor<int>::operator==(const Processor<int>&) const"),
        ),
        (
            "defaulted",
            source
                .find("Processor<int>::~Processor() noexcept = default;")
                .expect("defaulted destructor should exist"),
            "Processor",
            serde_json::json!(["Processor"]),
            None,
        ),
        (
            "static",
            source
                .find("template <typename Engine>\nconst int Processor<Engine>::table")
                .expect("static member should exist"),
            "Processor",
            serde_json::json!(["Processor"]),
            None,
        ),
    ];
    for (candidate, (kind, expected_start, owner, owner_chain, signature)) in
        definitions.iter().zip(expected)
    {
        assert_eq!(candidate["owner"], owner);
        assert_eq!(candidate["ownerChain"], owner_chain);
        assert_eq!(candidate["kind"], kind);
        assert_eq!(candidate["signature"], serde_json::json!(signature));
        assert_eq!(
            candidate["namespace"],
            serde_json::json!(["outer", "inner"])
        );
        assert_eq!(
            candidate["start"],
            source[..expected_start].encode_utf16().count()
        );
        let end = candidate["end"]
            .as_u64()
            .expect("definition end should be an integer") as usize;
        let start = candidate["start"]
            .as_u64()
            .expect("definition start should be an integer") as usize;
        let utf16 = source.encode_utf16().collect::<Vec<_>>();
        let definition = String::from_utf16(&utf16[start..end])
            .expect("definition range should be valid UTF-16");
        assert!(definition.ends_with('}') || definition.ends_with(';'));
        assert!(definition.contains("Processor"));
    }
    let functions = report["freeFunctionDefinitions"]
        .as_array()
        .expect("freeFunctionDefinitions should be an array");
    assert_eq!(functions.len(), 2, "{functions:#?}");
    let declarations = report["freeFunctionDeclarations"]
        .as_array()
        .expect("freeFunctionDeclarations should be an array");
    assert_eq!(declarations.len(), 1, "{declarations:#?}");
    assert_eq!(declarations[0]["name"], "declaredOnly");
    assert_eq!(
        declarations[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    let declaration_start = source
        .find("int declaredOnly")
        .expect("free helper declaration should exist");
    let declaration_end = source[declaration_start..]
        .find(';')
        .map(|offset| declaration_start + offset + 1)
        .expect("free helper declaration should close");
    assert_eq!(
        declarations[0]["start"],
        source[..declaration_start].encode_utf16().count()
    );
    assert_eq!(
        declarations[0]["end"],
        source[..declaration_end].encode_utf16().count()
    );
    let helper_start = source
        .find("static int helper")
        .expect("free helper should exist");
    let helper_end = source[helper_start..]
        .find("\n}")
        .map(|offset| helper_start + offset + 2)
        .expect("free helper should close");
    assert_eq!(functions[0]["name"], "helper");
    assert_eq!(functions[0]["signature"], "static int helper(int value)");
    assert_eq!(functions[1]["signature"], "static int leaf(int value)");
    assert!(functions[0]["references"]
        .as_array()
        .is_some_and(|references| references.iter().any(|reference| reference == "leaf")));
    assert_eq!(
        functions[0]["namespace"],
        serde_json::json!(["outer", "inner"])
    );
    assert_eq!(
        functions[0]["start"],
        source[..helper_start].encode_utf16().count()
    );
    assert_eq!(
        functions[0]["end"],
        source[..helper_end].encode_utf16().count()
    );
}

#[test]
fn dependency_closure_prunes_only_proven_inactive_includes_and_companions() {
    let temporary = TemporaryDirectory::new("analysis-dependencies");
    let root = temporary.path().join("plugin");
    fs::create_dir_all(root.join("src")).expect("source directory should be created");
    for (relative, source) in [
        ("Root.cpp", "#include \"Config.hpp\"\n"),
        (
            "Config.hpp",
            "#pragma once\n#define USE_ACTIVE 1\n#if USE_ACTIVE\n#include \"Active.hpp\"\n#else\n#include \"Inactive.hpp\"\n#endif\n#if COMPLEX + 1\n#include \"ConservativeA.hpp\"\n#else\n#include \"ConservativeB.hpp\"\n#endif\n",
        ),
        ("Active.hpp", "#pragma once\n"),
        ("Active.cpp", "// active implementation\n"),
        ("Inactive.hpp", "#pragma once\n"),
        ("Inactive.cpp", "// inactive implementation\n"),
        ("ConservativeA.hpp", "#pragma once\n"),
        ("ConservativeB.hpp", "#pragma once\n"),
    ] {
        fs::write(root.join("src").join(relative), source)
            .expect("dependency fixture should be written");
    }
    let entry = root.join("src/Root.cpp");
    let output = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args([
            "analyze",
            "dependencies",
            "--source-dir",
            root.to_str().expect("source path should be UTF-8"),
            "--entry",
            entry.to_str().expect("entry path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("dependency command should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("dependency report should be JSON");
    let canonical_root = fs::canonicalize(&root).expect("source root should resolve");
    let relative_files = |field: &str| {
        let mut files = report[field]
            .as_array()
            .expect("dependency paths should be an array")
            .iter()
            .map(|value| {
                Path::new(value.as_str().expect("dependency path should be a string"))
                    .strip_prefix(&canonical_root)
                    .expect("dependency should remain inside the checkout")
                    .to_string_lossy()
                    .into_owned()
            })
            .collect::<Vec<_>>();
        files.sort();
        files
    };
    assert_eq!(
        relative_files("files"),
        [
            "src/Active.cpp",
            "src/Active.hpp",
            "src/Config.hpp",
            "src/ConservativeA.hpp",
            "src/ConservativeB.hpp",
            "src/Root.cpp",
        ]
    );
    assert_eq!(
        relative_files("prunedFiles"),
        ["src/Inactive.cpp", "src/Inactive.hpp"]
    );
}
