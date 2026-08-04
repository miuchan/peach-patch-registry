mod support;

use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use support::TemporaryDirectory;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[test]
fn node_adapter_delegates_every_wasm_compile_to_rust() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let adapter = fs::read_to_string(root.join("scripts/scaffold-library-module.mjs"))
        .expect("Node adapter should be readable");
    assert_eq!(
        adapter
            .matches("runRustSource([\"compile\",\"wasm\"")
            .count(),
        1
    );
    assert!(!adapter.contains("function execCompiler"));
    assert!(!adapter.contains("execFileSync(\"emcc\""));
    assert!(!adapter.contains("execFileSync(\"em++\""));
    assert!(!adapter.contains("temporaryObjects"));
}

#[test]
#[cfg(unix)]
fn rust_compiler_orchestrates_c_objects_before_the_wasm_link_and_cleans_them() {
    let temporary = TemporaryDirectory::new("compiler-contract");
    let c_source = temporary.path().join("helper.c");
    let cpp_source = temporary.path().join("adapter.cpp");
    let compiler = temporary.path().join("fake-compiler.sh");
    let log = temporary.path().join("compiler.log");
    let artifact = temporary.path().join("module.wasm");
    fs::write(&c_source, "int helper(void) { return 1; }\n").expect("C fixture should be written");
    fs::write(&cpp_source, "int adapter = 1;\n").expect("C++ fixture should be written");
    fs::write(
        &compiler,
        r#"#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_COMPILER_LOG"
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    output="$1"
    break
  fi
  shift
done
if [ -z "$output" ]; then
  echo "missing output" >&2
  exit 3
fi
: > "$output"
"#,
    )
    .expect("fake compiler should be written");
    let mut permissions = fs::metadata(&compiler)
        .expect("fake compiler metadata should exist")
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&compiler, permissions).expect("fake compiler should be executable");

    let request = serde_json::json!({
        "cCompiler": compiler,
        "cxxCompiler": compiler,
        "artifact": artifact,
        "cSources": [c_source],
        "linkedSources": [cpp_source],
        "includeArguments": ["-I/fixture/include"],
        "cStandard": "-std=gnu11",
        "cxxStandard": "-std=c++20",
        "optimizationArguments": ["-O3"],
        "compileDefinitions": ["-DFEATURE=1"],
        "cPlatformDefinitions": ["-DC_ONLY=1"],
        "cxxPlatformDefinitions": ["-DCXX_ONLY=1"],
        "cSimdArguments": ["-msimd128"],
        "cxxSimdArguments": ["-msse3", "-msimd128"],
        "linkerArguments": ["-Wl,--allow-multiple-definition"],
        "lto": true,
        "supportLongjmp": true,
        "emulateFunctionPointerCasts": true,
        "stackSize": 1048576,
        "initialMemory": 2097152,
        "allowMemoryGrowth": true,
        "maximumMemory": 268435456
    });
    let mut child = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(["compile", "wasm", "--format", "json"])
        .env("FAKE_COMPILER_LOG", &log)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("compiler command should start");
    child
        .stdin
        .take()
        .expect("compiler stdin should be piped")
        .write_all(request.to_string().as_bytes())
        .expect("compile request should be written");
    let output = child
        .wait_with_output()
        .expect("compiler command should exit");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("compiler report should be JSON");
    assert_eq!(report["compiledCSources"], 1);
    assert_eq!(report["linkedSources"], 1);
    assert_eq!(report["exportedFunctionCount"], 83);
    assert_eq!(
        PathBuf::from(
            report["artifact"]
                .as_str()
                .expect("artifact should be a path")
        ),
        artifact
    );
    assert!(artifact.is_file());

    let invocations = fs::read_to_string(&log)
        .expect("compiler log should exist")
        .lines()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    assert_eq!(invocations.len(), 2, "{invocations:#?}");
    assert!(invocations[0].starts_with(c_source.to_str().expect("C path should be UTF-8")));
    assert!(invocations[0].contains(
        "-I/fixture/include -std=gnu11 -O3 -DNDEBUG -DTEST -DFEATURE=1 \
         -DC_ONLY=1 -msimd128 -s SUPPORT_LONGJMP=wasm -s \
         EMULATE_FUNCTION_POINTER_CASTS=1 -flto -c -o"
    ));
    let object = invocations[0]
        .split_whitespace()
        .collect::<Vec<_>>()
        .windows(2)
        .find_map(|pair| (pair[0] == "-o").then(|| PathBuf::from(pair[1])))
        .expect("C invocation should name its object");
    assert!(invocations[1].starts_with(cpp_source.to_str().expect("C++ path should be UTF-8")));
    assert!(invocations[1].contains(object.to_str().expect("object path should be UTF-8")));
    assert!(invocations[1].contains(
        "-I/fixture/include -std=c++20 -O3 -DNDEBUG -DTEST -DFEATURE=1 \
         -DCXX_ONLY=1 -msse3 -msimd128 -flto -Wl,--allow-multiple-definition \
         -s SUPPORT_LONGJMP=wasm -s EMULATE_FUNCTION_POINTER_CASTS=1 \
         -s STACK_SIZE=1048576 -s STANDALONE_WASM=1 \
         -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=268435456"
    ));
    assert!(invocations[1].ends_with(
        format!(
            "\"_rack_web_process\"] --no-entry -o {}",
            artifact.display()
        )
        .as_str()
    ));
    assert!(invocations[1].contains(
        "-s INITIAL_MEMORY=2097152 -s \
         EXPORTED_FUNCTIONS=[\"_rack_web_param_count\",\"_rack_web_input_count\""
    ));
    assert!(!object
        .parent()
        .expect("object should have a parent")
        .exists());
}

#[test]
#[cfg(unix)]
fn rust_compiler_preserves_the_backend_failure_and_stderr() {
    let temporary = TemporaryDirectory::new("compiler-failure");
    let cpp_source = temporary.path().join("adapter.cpp");
    let compiler = temporary.path().join("failing-compiler.sh");
    let artifact = temporary.path().join("module.wasm");
    fs::write(&cpp_source, "int adapter = 1;\n").expect("C++ fixture should be written");
    fs::write(
        &compiler,
        "#!/bin/sh\necho 'fixture compiler failure' >&2\nexit 9\n",
    )
    .expect("failing compiler should be written");
    let mut permissions = fs::metadata(&compiler)
        .expect("failing compiler metadata should exist")
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&compiler, permissions).expect("failing compiler should be executable");
    let request = serde_json::json!({
        "cCompiler": compiler,
        "cxxCompiler": compiler,
        "artifact": artifact,
        "cSources": [],
        "linkedSources": [cpp_source],
        "includeArguments": [],
        "cStandard": "-std=gnu11",
        "cxxStandard": "-std=c++20",
        "optimizationArguments": ["-O3"],
        "compileDefinitions": [],
        "cPlatformDefinitions": [],
        "cxxPlatformDefinitions": [],
        "cSimdArguments": [],
        "cxxSimdArguments": [],
        "linkerArguments": [],
        "lto": false,
        "supportLongjmp": false,
        "emulateFunctionPointerCasts": false,
        "stackSize": null,
        "initialMemory": 1048576,
        "allowMemoryGrowth": false,
        "maximumMemory": null
    });
    let mut child = Command::new(env!("CARGO_BIN_EXE_peach-registry"))
        .args(["compile", "wasm", "--format", "json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("compiler command should start");
    child
        .stdin
        .take()
        .expect("compiler stdin should be piped")
        .write_all(request.to_string().as_bytes())
        .expect("compile request should be written");
    let output = child
        .wait_with_output()
        .expect("compiler command should exit");
    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("failed with exit status: 9"), "{stderr}");
    assert!(stderr.contains("fixture compiler failure"), "{stderr}");
    assert!(!artifact.exists());
}
