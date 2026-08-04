use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

pub const RACK_WEB_EXPORTED_FUNCTIONS: &[&str] = &[
    "_rack_web_param_count",
    "_rack_web_input_count",
    "_rack_web_output_count",
    "_rack_web_light_count",
    "_rack_web_max_channels",
    "_rack_web_input_buffer",
    "_rack_web_output_buffer",
    "_rack_web_light_buffer",
    "_rack_web_visual_count",
    "_rack_web_visual_buffer",
    "_rack_web_set_param",
    "_rack_web_reset_param",
    "_rack_web_get_param",
    "_rack_web_get_param_min",
    "_rack_web_get_param_max",
    "_rack_web_set_input_connected",
    "_rack_web_set_output_connected",
    "_rack_web_set_input_channels",
    "_rack_web_get_output_channels",
    "_rack_web_set_polyphony",
    "_rack_web_set_state",
    "_rack_web_state_buffer",
    "_rack_web_commit_state_json",
    "_rack_web_snapshot_state_json",
    "_rack_web_snapshot_state_buffer",
    "_rack_web_trigger_action",
    "_rack_web_midi_push",
    "_rack_web_midi_output_available",
    "_rack_web_midi_output_buffer",
    "_rack_web_consume_midi_output",
    "_rack_web_midi_packet_output_available",
    "_rack_web_midi_packet_output_buffer",
    "_rack_web_consume_midi_packet_output",
    "_rack_web_asset_capacity",
    "_rack_web_asset_buffer",
    "_rack_web_commit_asset",
    "_rack_web_asset_slot_count",
    "_rack_web_asset_capacity_for_slot",
    "_rack_web_asset_buffer_for_slot",
    "_rack_web_commit_asset_for_slot",
    "_rack_web_capture_capacity",
    "_rack_web_capture_buffer",
    "_rack_web_capture_frames",
    "_rack_web_capture_channels",
    "_rack_web_capture_active",
    "_rack_web_consume_capture",
    "_rack_web_set_capture_enabled",
    "_rack_web_expander_capacity",
    "_rack_web_expander_input_buffer",
    "_rack_web_expander_output_buffer",
    "_rack_web_set_expander_count",
    "_rack_web_set_expander_type",
    "_rack_web_set_expander_bypassed",
    "_rack_web_set_expander_param",
    "_rack_web_set_expander_input_connected",
    "_rack_web_set_expander_input_channels",
    "_rack_web_get_expander_output_channels",
    "_rack_web_message_capacity",
    "_rack_web_set_message_neighbor",
    "_rack_web_set_message_chain_neighbor",
    "_rack_web_set_chain_neighbor_bypassed",
    "_rack_web_set_chain_neighbor_param",
    "_rack_web_get_chain_neighbor_param",
    "_rack_web_set_chain_neighbor_input",
    "_rack_web_get_chain_neighbor_input_channels",
    "_rack_web_get_chain_neighbor_input_voltage",
    "_rack_web_set_chain_neighbor_output_connected",
    "_rack_web_get_chain_neighbor_output_channels",
    "_rack_web_get_chain_neighbor_output_voltage",
    "_rack_web_get_chain_neighbor_light_brightness",
    "_rack_web_set_neighbor_bypassed",
    "_rack_web_set_neighbor_param",
    "_rack_web_set_neighbor_input",
    "_rack_web_set_neighbor_output_connected",
    "_rack_web_get_neighbor_output_channels",
    "_rack_web_get_neighbor_output_voltage",
    "_rack_web_get_neighbor_light_brightness",
    "_rack_web_message_buffer",
    "_rack_web_message_flip_requested",
    "_rack_web_finish_message_flip",
    "_rack_web_seed",
    "_rack_web_process_frame",
    "_rack_web_process",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WasmCompileRequest {
    pub c_compiler: String,
    pub cxx_compiler: String,
    pub artifact: PathBuf,
    pub c_sources: Vec<PathBuf>,
    pub linked_sources: Vec<PathBuf>,
    pub include_arguments: Vec<String>,
    pub c_standard: String,
    pub cxx_standard: String,
    pub optimization_arguments: Vec<String>,
    pub compile_definitions: Vec<String>,
    pub c_platform_definitions: Vec<String>,
    pub cxx_platform_definitions: Vec<String>,
    pub c_simd_arguments: Vec<String>,
    pub cxx_simd_arguments: Vec<String>,
    pub linker_arguments: Vec<String>,
    pub lto: bool,
    pub support_longjmp: bool,
    pub emulate_function_pointer_casts: bool,
    pub stack_size: Option<u64>,
    pub initial_memory: u64,
    pub allow_memory_growth: bool,
    pub maximum_memory: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WasmCompileReport {
    pub artifact: PathBuf,
    pub compiled_c_sources: usize,
    pub linked_sources: usize,
    pub exported_function_count: usize,
}

struct TemporaryObjects {
    path: PathBuf,
}

impl TemporaryObjects {
    fn create() -> Result<Self, String> {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("System clock cannot create a temporary directory: {error}"))?
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "peach-registry-wasm-objects-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir(&path).map_err(|error| {
            format!(
                "Cannot create compiler object directory {}: {error}",
                path.display()
            )
        })?;
        Ok(Self { path })
    }
}

impl Drop for TemporaryObjects {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn validate_text(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() || value.contains('\0') {
        return Err(format!("Invalid {label}"));
    }
    Ok(())
}

fn validate_source(path: &Path, label: &str) -> Result<(), String> {
    if !path.is_absolute() || !path.is_file() {
        return Err(format!(
            "{label} must be an existing absolute file: {}",
            path.display()
        ));
    }
    Ok(())
}

fn quoted(argument: &OsStr) -> String {
    let value = argument.to_string_lossy();
    if value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || b"._/-=:,+".contains(&byte))
    {
        value.into_owned()
    } else {
        format!("{:?}", value.as_ref())
    }
}

fn run_compiler(command: &str, arguments: &[String]) -> Result<(), String> {
    if std::env::var_os("RACK_WEB_TRACE_COMPILER").is_some() {
        eprintln!(
            "{} {}",
            quoted(OsStr::new(command)),
            arguments
                .iter()
                .map(|argument| quoted(OsStr::new(argument)))
                .collect::<Vec<_>>()
                .join(" ")
        );
    }
    let output = Command::new(command)
        .args(arguments)
        .stdin(Stdio::inherit())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Cannot run compiler {command}: {error}"))?;
    if !output.stdout.is_empty() {
        std::io::stderr()
            .write_all(&output.stdout)
            .map_err(|error| format!("Cannot forward compiler output: {error}"))?;
    }
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "Compiler {command} failed with {}{}{}",
        output.status,
        if stderr.trim().is_empty() { "" } else { ":\n" },
        stderr.trim_end()
    ))
}

fn common_compile_arguments(request: &WasmCompileRequest) -> Vec<String> {
    let mut arguments = request.include_arguments.clone();
    arguments.extend(request.optimization_arguments.iter().cloned());
    arguments.extend(["-DNDEBUG".to_owned(), "-DTEST".to_owned()]);
    arguments.extend(request.compile_definitions.iter().cloned());
    arguments
}

fn c_arguments(request: &WasmCompileRequest) -> Vec<String> {
    let mut arguments = request.include_arguments.clone();
    arguments.push(request.c_standard.clone());
    arguments.extend(request.optimization_arguments.iter().cloned());
    arguments.extend(["-DNDEBUG".to_owned(), "-DTEST".to_owned()]);
    arguments.extend(request.compile_definitions.iter().cloned());
    arguments.extend(request.c_platform_definitions.iter().cloned());
    arguments.extend(request.c_simd_arguments.iter().cloned());
    if request.support_longjmp {
        arguments.extend(["-s".to_owned(), "SUPPORT_LONGJMP=wasm".to_owned()]);
    }
    if request.emulate_function_pointer_casts {
        arguments.extend([
            "-s".to_owned(),
            "EMULATE_FUNCTION_POINTER_CASTS=1".to_owned(),
        ]);
    }
    if request.lto {
        arguments.push("-flto".to_owned());
    }
    arguments
}

fn cxx_arguments(request: &WasmCompileRequest) -> Vec<String> {
    let mut arguments = common_compile_arguments(request);
    arguments.insert(
        request.include_arguments.len(),
        request.cxx_standard.clone(),
    );
    arguments.extend(request.cxx_platform_definitions.iter().cloned());
    arguments.extend(request.cxx_simd_arguments.iter().cloned());
    if request.lto {
        arguments.push("-flto".to_owned());
    }
    arguments.extend(request.linker_arguments.iter().cloned());
    if request.support_longjmp {
        arguments.extend(["-s".to_owned(), "SUPPORT_LONGJMP=wasm".to_owned()]);
    }
    if request.emulate_function_pointer_casts {
        arguments.extend([
            "-s".to_owned(),
            "EMULATE_FUNCTION_POINTER_CASTS=1".to_owned(),
        ]);
    }
    if let Some(stack_size) = request.stack_size {
        arguments.extend(["-s".to_owned(), format!("STACK_SIZE={stack_size}")]);
    }
    arguments.extend(["-s".to_owned(), "STANDALONE_WASM=1".to_owned()]);
    if request.allow_memory_growth {
        arguments.extend(["-s".to_owned(), "ALLOW_MEMORY_GROWTH=1".to_owned()]);
        if let Some(maximum_memory) = request.maximum_memory {
            arguments.extend(["-s".to_owned(), format!("MAXIMUM_MEMORY={maximum_memory}")]);
        }
    } else {
        arguments.extend(["-s".to_owned(), "ALLOW_MEMORY_GROWTH=0".to_owned()]);
    }
    let exported_functions = serde_json::to_string(RACK_WEB_EXPORTED_FUNCTIONS)
        .expect("static Rack Web exports should serialize");
    arguments.extend([
        "-s".to_owned(),
        format!("INITIAL_MEMORY={}", request.initial_memory),
        "-s".to_owned(),
        format!("EXPORTED_FUNCTIONS={exported_functions}"),
        "--no-entry".to_owned(),
    ]);
    arguments
}

pub fn compile_wasm(request: &WasmCompileRequest) -> Result<WasmCompileReport, String> {
    validate_text(&request.c_compiler, "C compiler")?;
    validate_text(&request.cxx_compiler, "C++ compiler")?;
    if !request.artifact.is_absolute() {
        return Err("WASM artifact path must be absolute".to_owned());
    }
    let artifact_parent = request
        .artifact
        .parent()
        .ok_or_else(|| "WASM artifact path has no parent".to_owned())?;
    if !artifact_parent.is_dir() {
        return Err(format!(
            "WASM artifact directory does not exist: {}",
            artifact_parent.display()
        ));
    }
    if request.linked_sources.is_empty() {
        return Err("WASM link plan requires at least one C++ source".to_owned());
    }
    for source in &request.c_sources {
        validate_source(source, "C source")?;
    }
    for source in &request.linked_sources {
        validate_source(source, "C++ source")?;
    }
    if request.c_standard != "-std=gnu11"
        || !matches!(request.cxx_standard.as_str(), "-std=c++17" | "-std=c++20")
    {
        return Err("Unsupported C or C++ language standard".to_owned());
    }
    if request.initial_memory < 1_048_576 || !request.initial_memory.is_multiple_of(65_536) {
        return Err("Initial WASM memory must be whole 64 KiB pages".to_owned());
    }
    if request
        .maximum_memory
        .is_some_and(|maximum| maximum < request.initial_memory || !maximum.is_multiple_of(65_536))
    {
        return Err("Maximum WASM memory is inconsistent with initial memory".to_owned());
    }
    if request.allow_memory_growth && request.maximum_memory.is_none() {
        return Err("Growing WASM memory requires a maximum memory".to_owned());
    }
    for argument in request
        .include_arguments
        .iter()
        .chain(request.optimization_arguments.iter())
        .chain(request.compile_definitions.iter())
        .chain(request.c_platform_definitions.iter())
        .chain(request.cxx_platform_definitions.iter())
        .chain(request.c_simd_arguments.iter())
        .chain(request.cxx_simd_arguments.iter())
        .chain(request.linker_arguments.iter())
    {
        validate_text(argument, "compiler argument")?;
    }

    let temporary = TemporaryObjects::create()?;
    let c_arguments = c_arguments(request);
    let cxx_arguments = cxx_arguments(request);
    let mut objects = Vec::with_capacity(request.c_sources.len());
    for (index, source) in request.c_sources.iter().enumerate() {
        let stem = source
            .file_stem()
            .and_then(OsStr::to_str)
            .unwrap_or("source");
        let object = temporary.path.join(format!("{index}-{stem}.o"));
        let mut arguments = Vec::new();
        arguments.push(source.to_string_lossy().into_owned());
        arguments.extend(c_arguments.iter().cloned());
        arguments.extend([
            "-c".to_owned(),
            "-o".to_owned(),
            object.to_string_lossy().into_owned(),
        ]);
        run_compiler(&request.c_compiler, &arguments)?;
        if !object.is_file() {
            return Err(format!(
                "C compiler did not create expected object {}",
                object.display()
            ));
        }
        objects.push(object);
    }

    let mut arguments = request
        .linked_sources
        .iter()
        .chain(objects.iter())
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    arguments.extend(cxx_arguments);
    arguments.extend([
        "-o".to_owned(),
        request.artifact.to_string_lossy().into_owned(),
    ]);
    run_compiler(&request.cxx_compiler, &arguments)?;
    if !request.artifact.is_file() {
        return Err(format!(
            "C++ compiler did not create expected WASM artifact {}",
            request.artifact.display()
        ));
    }
    Ok(WasmCompileReport {
        artifact: request.artifact.clone(),
        compiled_c_sources: request.c_sources.len(),
        linked_sources: request.linked_sources.len(),
        exported_function_count: RACK_WEB_EXPORTED_FUNCTIONS.len(),
    })
}
