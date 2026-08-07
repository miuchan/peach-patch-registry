use peach_cli::abi::{
    evaluate_rack_web_integers, evaluate_rack_web_layout, evaluate_rack_web_numbers,
    evaluate_rack_web_strings, expand_rack_web_config_calls, generate_rack_web_abi,
    RackWebAbiRequest, RackWebConfigExpansionRequest, RackWebIntegerRequest, RackWebLayoutRequest,
    RackWebNumberRequest, RackWebStringRequest,
};
use peach_cli::analysis::{
    cmake_analysis, dependency_closure, inventory, makefile_analysis_for, model_candidates,
    numeric_constants, preprocess_source, source_declarations, source_file_inventory,
    source_include_inventory, NumericConstantRequest, PreprocessRequest, SourceDeclarationRequest,
};
use peach_cli::compiler::{compile_wasm, WasmCompileRequest};
use peach_cli::discovery::{discover, DiscoveryOptions};
use peach_cli::publisher::{publish, PublishOptions};
use peach_cli::repository::verify_checkout;
use peach_cli::scheduler::{build, BuildOptions};
use peach_cli::source::{checkout_locked_dependency, prepare, PrepareOptions};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, TcpStream};
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, Instant};

const USAGE: &str =
    "peach-registry <verify|publish|discover|build|source prepare|source checkout|analyze inventory|analyze files|analyze includes|analyze makefile|analyze cmake|analyze model-candidates|analyze dependencies|analyze constants|analyze preprocess|analyze declarations|analyze declarations-server|analyze declarations-client|abi wrapper|abi layout|abi integers|abi numbers|abi strings|abi config-expansions|compile wasm> [options]";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeclarationServerRequest {
    token: String,
    request: SourceDeclarationRequest,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeclarationServerResponse {
    report: Option<Value>,
    error: Option<String>,
}

fn declaration_address(port: u16) -> SocketAddrV4 {
    SocketAddrV4::new(Ipv4Addr::LOCALHOST, port)
}

fn declaration_server(port: u16, token: &str) -> Result<(), String> {
    let listener = TcpListener::bind(declaration_address(port))
        .map_err(|error| format!("Cannot bind declaration-analysis server: {error}"))?;
    for connection in listener.incoming() {
        let mut stream = connection
            .map_err(|error| format!("Cannot accept declaration-analysis request: {error}"))?;
        let mut line = String::new();
        BufReader::new(
            stream
                .try_clone()
                .map_err(|error| format!("Cannot read declaration-analysis request: {error}"))?,
        )
        .take(128 * 1024 * 1024)
        .read_line(&mut line)
        .map_err(|error| format!("Cannot read declaration-analysis request: {error}"))?;
        let response = match serde_json::from_str::<DeclarationServerRequest>(&line) {
            Ok(envelope) if envelope.token == token => match source_declarations(&envelope.request)
            {
                Ok(report) => DeclarationServerResponse {
                    report: Some(serde_json::to_value(report).map_err(|error| error.to_string())?),
                    error: None,
                },
                Err(error) => DeclarationServerResponse {
                    report: None,
                    error: Some(error),
                },
            },
            Ok(_) => DeclarationServerResponse {
                report: None,
                error: Some("Declaration-analysis server token mismatch".to_owned()),
            },
            Err(error) => DeclarationServerResponse {
                report: None,
                error: Some(format!(
                    "Invalid declaration-analysis server request: {error}"
                )),
            },
        };
        serde_json::to_writer(&mut stream, &response).map_err(|error| error.to_string())?;
        stream
            .write_all(b"\n")
            .map_err(|error| format!("Cannot write declaration-analysis response: {error}"))?;
    }
    Ok(())
}

fn declaration_client(port: u16, token: &str) -> Result<Value, String> {
    let mut source = String::new();
    std::io::stdin()
        .read_to_string(&mut source)
        .map_err(|error| format!("Cannot read declaration-analysis request: {error}"))?;
    let request: SourceDeclarationRequest = serde_json::from_str(&source)
        .map_err(|error| format!("Cannot parse declaration-analysis request: {error}"))?;
    let deadline = Instant::now() + Duration::from_secs(10);
    let mut stream = loop {
        match TcpStream::connect(declaration_address(port)) {
            Ok(stream) => break stream,
            Err(error) if Instant::now() < deadline => {
                let _ = error;
                thread::sleep(Duration::from_millis(20));
            }
            Err(error) => {
                return Err(format!(
                    "Cannot connect to declaration-analysis server: {error}"
                ));
            }
        }
    };
    serde_json::to_writer(
        &mut stream,
        &serde_json::json!({"token": token, "request": request}),
    )
    .map_err(|error| error.to_string())?;
    stream
        .write_all(b"\n")
        .map_err(|error| format!("Cannot send declaration-analysis request: {error}"))?;
    let mut line = String::new();
    BufReader::new(stream)
        .take(128 * 1024 * 1024)
        .read_line(&mut line)
        .map_err(|error| format!("Cannot read declaration-analysis response: {error}"))?;
    let response: DeclarationServerResponse = serde_json::from_str(&line)
        .map_err(|error| format!("Invalid declaration-analysis response: {error}"))?;
    response.report.ok_or_else(|| {
        response
            .error
            .unwrap_or_else(|| "Declaration analysis failed".to_owned())
    })
}

fn run(args: &[String]) -> Result<i32, String> {
    let command = args.first().map(String::as_str).unwrap_or("help");
    let nested_command = matches!(command, "source" | "analyze" | "abi" | "compile")
        .then(|| args.get(1).map(String::as_str).unwrap_or("help"));
    let mut root = PathBuf::from(".");
    let mut format = "text";
    let mut catalog = None;
    let mut dynamic_root = None;
    let mut key = None;
    let mut library_index = None;
    let mut output = None;
    let mut queue = None;
    let mut state = None;
    let mut output_root = None;
    let mut source_cache = None;
    let mut adapter_script = None;
    let mut node = None;
    let mut source_dir = None;
    let mut source_url = None;
    let mut source_repository = None;
    let mut source_commit = None;
    let mut source_target = None;
    let mut makefile_path = None;
    let mut makefile_source_variables = Vec::new();
    let mut source_file_profile = None;
    let mut dependency_entries = Vec::new();
    let mut plugin = None;
    let mut model = None;
    let mut limit = None;
    let mut concurrency = None;
    let mut timeout = None;
    let mut declaration_port = None;
    let mut declaration_token = None;
    let mut retry = false;
    let mut force = false;
    let mut keep_source = false;
    let mut keep_build = false;
    let mut index = if matches!(command, "source" | "analyze" | "abi" | "compile") {
        2
    } else {
        1
    };
    while index < args.len() {
        let option = args[index].as_str();
        if command == "build" {
            let flag = match option {
                "--retry" => Some(&mut retry),
                "--force" => Some(&mut force),
                "--keep-source" => Some(&mut keep_source),
                "--keep-build" => Some(&mut keep_build),
                _ => None,
            };
            if let Some(flag) = flag {
                *flag = true;
                index += 1;
                continue;
            }
        }
        let value = args
            .get(index + 1)
            .ok_or_else(|| format!("{option} requires a value"))?;
        match option {
            "--root" => root = PathBuf::from(value),
            "--format" if value == "text" || value == "json" => format = value,
            "--format" => return Err(format!("Unsupported output format: {value}")),
            "--catalog" if command == "publish" || command == "build" => {
                catalog = Some(PathBuf::from(value))
            }
            "--dynamic-root" if command == "publish" || command == "build" => {
                dynamic_root = Some(PathBuf::from(value))
            }
            "--key" if command == "publish" => key = Some(value.clone()),
            "--library-index" if command == "discover" || command == "source" => {
                library_index = Some(PathBuf::from(value))
            }
            "--output" if command == "discover" => output = Some(PathBuf::from(value)),
            "--queue" if command == "build" => queue = Some(PathBuf::from(value)),
            "--state" if command == "build" => state = Some(PathBuf::from(value)),
            "--output-root" if command == "build" => output_root = Some(PathBuf::from(value)),
            "--source-cache" if command == "build" || command == "source" => {
                source_cache = Some(PathBuf::from(value))
            }
            "--adapter-script" if command == "build" => adapter_script = Some(PathBuf::from(value)),
            "--node" if command == "build" => node = Some(PathBuf::from(value)),
            "--source-dir" if command == "build" || command == "source" || command == "analyze" => {
                source_dir = Some(PathBuf::from(value))
            }
            "--url" if command == "source" => source_url = Some(value.clone()),
            "--repository" if command == "source" => source_repository = Some(value.clone()),
            "--commit" if command == "source" => source_commit = Some(value.clone()),
            "--target" if command == "source" => source_target = Some(PathBuf::from(value)),
            "--entry" if command == "analyze" => dependency_entries.push(PathBuf::from(value)),
            "--makefile" if command == "analyze" && nested_command == Some("makefile") => {
                makefile_path = Some(PathBuf::from(value))
            }
            "--source-variable" if command == "analyze" && nested_command == Some("makefile") => {
                makefile_source_variables.push(value.clone())
            }
            "--profile" if command == "analyze" && nested_command == Some("files") => {
                source_file_profile = Some(value.clone())
            }
            "--plugin" if command == "build" => plugin = Some(value.clone()),
            "--model" if command == "build" => model = Some(value.clone()),
            "--limit" if command == "build" => {
                limit = Some(
                    value
                        .parse::<usize>()
                        .map_err(|_| format!("Invalid --limit value: {value}"))?,
                )
            }
            "--concurrency" if command == "build" => {
                concurrency = Some(
                    value
                        .parse::<usize>()
                        .map_err(|_| format!("Invalid --concurrency value: {value}"))?,
                )
            }
            "--timeout-ms" if command == "build" => {
                timeout =
                    Some(Duration::from_millis(value.parse::<u64>().map_err(
                        |_| format!("Invalid --timeout-ms value: {value}"),
                    )?))
            }
            "--port"
                if command == "analyze"
                    && matches!(
                        nested_command,
                        Some("declarations-server" | "declarations-client")
                    ) =>
            {
                declaration_port = Some(
                    value
                        .parse::<u16>()
                        .map_err(|_| format!("Invalid --port value: {value}"))?,
                )
            }
            "--token"
                if command == "analyze"
                    && matches!(
                        nested_command,
                        Some("declarations-server" | "declarations-client")
                    ) =>
            {
                declaration_token = Some(value.clone())
            }
            _ => return Err(format!("Unknown option: {option}")),
        }
        index += 2;
    }
    match command {
        "verify" => {
            let report = verify_checkout(&root)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "verified {} packages ({} bytes)",
                    report.package_count, report.total_bytes
                );
            }
        }
        "publish" => {
            let report = publish(&PublishOptions {
                root,
                catalog,
                dynamic_root,
                key,
            })?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "published {} package(s); catalog contains {} package(s)",
                    report.updated, report.packages
                );
            }
        }
        "discover" => {
            let report = discover(&DiscoveryOptions {
                root,
                library_index,
                output,
            })?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "discovered {} package(s), {} module(s), {} compiled, {} pending",
                    report.packages, report.modules, report.compiled, report.pending
                );
            }
        }
        "build" => {
            let mut options = BuildOptions::new(root);
            options.queue = queue;
            options.state = state;
            options.catalog = catalog;
            options.output_root = output_root;
            options.source_cache = source_cache;
            options.dynamic_root = dynamic_root;
            options.adapter_script = adapter_script;
            options.node = node;
            options.source_dir = source_dir;
            options.source_tool = Some(
                std::env::current_exe()
                    .map_err(|error| format!("Cannot resolve maintenance binary: {error}"))?,
            );
            options.plugin = plugin;
            options.model = model;
            options.limit = limit;
            if let Some(concurrency) = concurrency {
                options.concurrency = concurrency;
            }
            if let Some(timeout) = timeout {
                options.timeout = timeout;
            }
            options.retry = retry;
            options.force = force;
            options.keep_source = keep_source;
            options.keep_build = keep_build;
            let report = build(&options)?;
            let exit_code = if report.failed == 0 { 0 } else { 2 };
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "built {}/{} module(s); {} failed",
                    report.succeeded, report.attempted, report.failed
                );
            }
            return Ok(exit_code);
        }
        "source" if nested_command == Some("prepare") => {
            let report = prepare(&PrepareOptions {
                library_url: source_url
                    .ok_or_else(|| "source prepare requires --url".to_owned())?,
                source_cache,
                source_dir,
                library_index,
            })?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "prepared {} at {} ({})",
                    report.target.key,
                    report.source.directory.display(),
                    report.source.commit
                );
            }
        }
        "source" if nested_command == Some("checkout") => {
            let repository = source_repository
                .ok_or_else(|| "source checkout requires --repository".to_owned())?;
            let commit =
                source_commit.ok_or_else(|| "source checkout requires --commit".to_owned())?;
            let target =
                source_target.ok_or_else(|| "source checkout requires --target".to_owned())?;
            checkout_locked_dependency(&repository, &commit, &target)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&serde_json::json!({
                        "repository": repository,
                        "commit": commit,
                        "directory": target,
                    }))
                    .map_err(|error| error.to_string())?
                );
            } else {
                println!("checked out {commit} at {}", target.display());
            }
        }
        "analyze" if nested_command == Some("inventory") => {
            let source_dir =
                source_dir.ok_or_else(|| "analyze inventory requires --source-dir".to_owned())?;
            let report = inventory(&source_dir)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "found {} source file(s) across {} repository root(s)",
                    report.source_files.len(),
                    report.repository_roots.len()
                );
            }
        }
        "analyze" if nested_command == Some("files") => {
            let source_dir =
                source_dir.ok_or_else(|| "analyze files requires --source-dir".to_owned())?;
            let profile = source_file_profile.as_deref().unwrap_or("dependency");
            let report = source_file_inventory(&source_dir, profile)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!("found {} source file(s)", report.source_files.len());
            }
        }
        "analyze" if nested_command == Some("includes") => {
            let source_dir =
                source_dir.ok_or_else(|| "analyze includes requires --source-dir".to_owned())?;
            let report = source_include_inventory(&source_dir)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!("found {} unique include(s)", report.includes.len());
            }
        }
        "analyze" if nested_command == Some("makefile") => {
            let source_dir =
                source_dir.ok_or_else(|| "analyze makefile requires --source-dir".to_owned())?;
            let makefile_path = makefile_path.unwrap_or_else(|| PathBuf::from("Makefile"));
            if makefile_source_variables.is_empty() {
                makefile_source_variables.push("SOURCES".to_owned());
            }
            let report =
                makefile_analysis_for(&source_dir, &makefile_path, &makefile_source_variables)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else if report.makefile.is_some() {
                println!(
                    "found {} compile definition(s), {} include directories, and {} implementation source(s)",
                    report.compile_definitions.len(),
                    report.include_directories.len(),
                    report.implementation_sources.len()
                );
            } else {
                println!("no Makefile found");
            }
        }
        "analyze" if nested_command == Some("cmake") => {
            let source_dir =
                source_dir.ok_or_else(|| "analyze cmake requires --source-dir".to_owned())?;
            let report = cmake_analysis(&source_dir)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else if report.cmake_lists.is_some() {
                println!(
                    "found {} CMake compile definition(s)",
                    report.compile_definitions.len()
                );
            } else {
                println!("no CMakeLists.txt found");
            }
        }
        "analyze" if nested_command == Some("model-candidates") => {
            let source_dir = source_dir
                .ok_or_else(|| "analyze model-candidates requires --source-dir".to_owned())?;
            let report = model_candidates(&source_dir)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "found {} model factory candidate(s)",
                    report.candidates.len()
                );
            }
        }
        "analyze" if nested_command == Some("dependencies") => {
            let source_dir = source_dir
                .ok_or_else(|| "analyze dependencies requires --source-dir".to_owned())?;
            let report = dependency_closure(&source_dir, &dependency_entries)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "resolved {} dependency file(s), pruned {} inactive file(s)",
                    report.files.len(),
                    report.pruned_files.len()
                );
            }
        }
        "analyze" if nested_command == Some("constants") => {
            let request: NumericConstantRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read numeric-constant request: {error}"))?;
            let report = numeric_constants(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                for (name, value) in report.constants {
                    println!("{name}={value}");
                }
            }
        }
        "analyze" if nested_command == Some("preprocess") => {
            let request: PreprocessRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read preprocessor request: {error}"))?;
            let report = preprocess_source(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!("{}", report.source);
            }
        }
        "analyze" if nested_command == Some("declarations") => {
            let request: SourceDeclarationRequest =
                serde_json::from_reader(std::io::stdin().lock()).map_err(|error| {
                    format!("Cannot read declaration-analysis request: {error}")
                })?;
            let report = source_declarations(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "found {} type declaration(s), {} enum declaration(s), and {} config call(s)",
                    report.type_declarations.len(),
                    report.enum_declarations.len(),
                    report.config_calls.len()
                );
            }
        }
        "analyze" if nested_command == Some("declarations-server") => {
            declaration_server(
                declaration_port.ok_or_else(|| "declarations-server requires --port".to_owned())?,
                declaration_token
                    .as_deref()
                    .ok_or_else(|| "declarations-server requires --token".to_owned())?,
            )?;
        }
        "analyze" if nested_command == Some("declarations-client") => {
            let report = declaration_client(
                declaration_port.ok_or_else(|| "declarations-client requires --port".to_owned())?,
                declaration_token
                    .as_deref()
                    .ok_or_else(|| "declarations-client requires --token".to_owned())?,
            )?;
            println!(
                "{}",
                serde_json::to_string(&report).map_err(|error| error.to_string())?
            );
        }
        "abi" if nested_command == Some("wrapper") => {
            let request: RackWebAbiRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read Rack Web ABI request: {error}"))?;
            let report = generate_rack_web_abi(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!("{}", report.source);
            }
        }
        "abi" if nested_command == Some("layout") => {
            let request: RackWebLayoutRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read Rack Web layout request: {error}"))?;
            let report = evaluate_rack_web_layout(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                for (kind, layout) in [
                    ("params", report.layouts.params),
                    ("inputs", report.layouts.inputs),
                    ("outputs", report.layouts.outputs),
                    ("lights", report.layouts.lights),
                ] {
                    if let Some(layout) = layout {
                        println!("{kind}: {}", layout.count);
                    }
                }
            }
        }
        "abi" if nested_command == Some("integers") => {
            let request: RackWebIntegerRequest =
                serde_json::from_reader(std::io::stdin().lock())
                    .map_err(|error| format!("Cannot read Rack Web integer request: {error}"))?;
            let report = evaluate_rack_web_integers(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                for value in report.values {
                    println!(
                        "{}",
                        value.map_or_else(|| "unsupported".to_owned(), |value| value.to_string())
                    );
                }
            }
        }
        "abi" if nested_command == Some("numbers") => {
            let request: RackWebNumberRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read Rack Web number request: {error}"))?;
            let report = evaluate_rack_web_numbers(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                for value in report.values {
                    println!(
                        "{}",
                        value.map_or_else(|| "unsupported".to_owned(), |value| value.to_string())
                    );
                }
            }
        }
        "abi" if nested_command == Some("strings") => {
            let request: RackWebStringRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read Rack Web string request: {error}"))?;
            let report = evaluate_rack_web_strings(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                for value in report.values {
                    println!("{}", value.unwrap_or_else(|| "unsupported".to_owned()));
                }
            }
        }
        "abi" if nested_command == Some("config-expansions") => {
            let request: RackWebConfigExpansionRequest =
                serde_json::from_reader(std::io::stdin().lock()).map_err(|error| {
                    format!("Cannot read Rack Web configuration expansion request: {error}")
                })?;
            let report = expand_rack_web_config_calls(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                for expansion in report.expansions {
                    println!("{}", expansion.join("\n"));
                }
            }
        }
        "compile" if nested_command == Some("wasm") => {
            let request: WasmCompileRequest = serde_json::from_reader(std::io::stdin().lock())
                .map_err(|error| format!("Cannot read WASM compile request: {error}"))?;
            let report = compile_wasm(&request)?;
            if format == "json" {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&report).map_err(|error| error.to_string())?
                );
            } else {
                println!(
                    "compiled {} C source(s) and linked {} C++ source(s) to {}",
                    report.compiled_c_sources,
                    report.linked_sources,
                    report.artifact.display()
                );
            }
        }
        _ => return Err(USAGE.to_owned()),
    }
    Ok(0)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(0) => {}
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("peach-registry: {error}");
            std::process::exit(1);
        }
    }
}
