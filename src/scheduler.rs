use crate::registry::{package_layout, parse_registry};
use crate::storage::{now, read_json, write_atomic, write_json_atomic};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use url::Url;
use wait_timeout::ChildExt;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const MAX_PROCESS_OUTPUT: usize = 32 * 1024 * 1024;
const STS_EXCLUSION: &str = "The source owner stated that the repository was unintentionally public and that its code and ports must not be redistributed: https://community.vcvrack.com/t/sts-odyssey/18614/7";

#[derive(Clone, Debug)]
pub struct BuildOptions {
    pub root: PathBuf,
    pub queue: Option<PathBuf>,
    pub state: Option<PathBuf>,
    pub catalog: Option<PathBuf>,
    pub output_root: Option<PathBuf>,
    pub source_cache: Option<PathBuf>,
    pub dynamic_root: Option<PathBuf>,
    pub adapter_script: Option<PathBuf>,
    pub node: Option<PathBuf>,
    pub source_dir: Option<PathBuf>,
    pub source_tool: Option<PathBuf>,
    pub plugin: Option<String>,
    pub model: Option<String>,
    pub limit: Option<usize>,
    pub concurrency: usize,
    pub timeout: Duration,
    pub retry: bool,
    pub force: bool,
    pub keep_source: bool,
    pub keep_build: bool,
}

impl BuildOptions {
    pub fn new(root: PathBuf) -> Self {
        let concurrency = thread::available_parallelism()
            .map(usize::from)
            .unwrap_or(1)
            .min(4);
        Self {
            root,
            queue: None,
            state: None,
            catalog: None,
            output_root: None,
            source_cache: None,
            dynamic_root: None,
            adapter_script: None,
            node: None,
            source_dir: None,
            source_tool: None,
            plugin: None,
            model: None,
            limit: None,
            concurrency,
            timeout: DEFAULT_TIMEOUT,
            retry: false,
            force: false,
            keep_source: false,
            keep_build: false,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildReport {
    pub attempted: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub concurrency: usize,
    pub catalog_modules: usize,
    pub removed_source_repositories: usize,
    pub state_path: PathBuf,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildItem {
    key: String,
    plugin: String,
    model: String,
    #[serde(default = "default_version")]
    version: String,
    source_url: String,
    library_url: String,
}

fn default_version() -> String {
    "0.0.0".to_owned()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildQueue {
    schema_version: u64,
    module_records: Vec<BuildItem>,
}

struct SchedulerPaths {
    root: PathBuf,
    queue: PathBuf,
    state: PathBuf,
    catalog: PathBuf,
    output_root: PathBuf,
    source_cache: PathBuf,
    dynamic_root: PathBuf,
    adapter_script: PathBuf,
    node: PathBuf,
    source_dir: Option<PathBuf>,
    source_tool: Option<PathBuf>,
}

struct BuildContext {
    state_root: Map<String, Value>,
    state_modules: Map<String, Value>,
    definitions: BTreeMap<String, Value>,
    started: usize,
    succeeded: usize,
    failed: usize,
    removed_sources: usize,
    attempted: usize,
}

impl BuildContext {
    fn persist(&self, paths: &SchedulerPaths) -> Result<(), String> {
        let mut state = self.state_root.clone();
        state.insert(
            "modules".to_owned(),
            Value::Object(self.state_modules.clone()),
        );
        write_json_atomic(&paths.state, &Value::Object(state))?;
        write_json_atomic(
            &paths.catalog,
            &Value::Array(self.definitions.values().cloned().collect()),
        )
    }
}

struct ProcessOutput {
    success: bool,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    status: String,
}

fn absolute(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_absolute() {
        Ok(path)
    } else {
        std::env::current_dir()
            .map(|directory| directory.join(path))
            .map_err(|error| format!("Cannot resolve current directory: {error}"))
    }
}

fn paths(options: &BuildOptions) -> Result<SchedulerPaths, String> {
    let root = fs::canonicalize(&options.root).map_err(|error| {
        format!(
            "Cannot resolve repository root {}: {error}",
            options.root.display()
        )
    })?;
    let build_root = root.join(".build");
    Ok(SchedulerPaths {
        queue: absolute(
            options
                .queue
                .clone()
                .unwrap_or_else(|| build_root.join("open-source-modules.json")),
        )?,
        state: absolute(
            options
                .state
                .clone()
                .unwrap_or_else(|| build_root.join("open-source-build-state.json")),
        )?,
        catalog: absolute(
            options
                .catalog
                .clone()
                .unwrap_or_else(|| build_root.join("catalog.json")),
        )?,
        output_root: absolute(
            options
                .output_root
                .clone()
                .unwrap_or_else(|| build_root.join("open-source-builds")),
        )?,
        source_cache: absolute(
            options
                .source_cache
                .clone()
                .unwrap_or_else(|| build_root.join("sources")),
        )?,
        dynamic_root: absolute(
            options
                .dynamic_root
                .clone()
                .unwrap_or_else(|| root.join("public/dynamic-plugins")),
        )?,
        adapter_script: absolute(
            options
                .adapter_script
                .clone()
                .unwrap_or_else(|| root.join("scripts/scaffold-library-module.mjs")),
        )?,
        node: options
            .node
            .clone()
            .unwrap_or_else(|| PathBuf::from("node")),
        source_dir: options.source_dir.clone().map(absolute).transpose()?,
        source_tool: options.source_tool.clone().map(absolute).transpose()?,
        root,
    })
}

fn object(value: Value, label: &str) -> Result<Map<String, Value>, String> {
    value
        .as_object()
        .cloned()
        .ok_or_else(|| format!("{label} must be a JSON object"))
}

fn validate_item(item: &BuildItem) -> Result<(), String> {
    let layout = package_layout(&item.plugin, &item.model, &item.version)?;
    if item.key != layout.key {
        return Err(format!("Build queue identity mismatch for {}", item.key));
    }
    let url = Url::parse(&item.library_url)
        .map_err(|error| format!("Invalid Library URL for {}: {error}", item.key))?;
    let segments = url
        .path_segments()
        .map(|segments| {
            segments
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if url.scheme() != "https"
        || url.host_str() != Some("library.vcvrack.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || segments != [item.plugin.as_str(), item.model.as_str()]
    {
        return Err(format!("Invalid official Library URL for {}", item.key));
    }
    Ok(())
}

fn read_pipe(mut pipe: impl Read + Send + 'static) -> thread::JoinHandle<Result<Vec<u8>, String>> {
    thread::spawn(move || {
        let mut output = Vec::new();
        let mut buffer = [0_u8; 16 * 1024];
        loop {
            let read = pipe
                .read(&mut buffer)
                .map_err(|error| format!("Cannot read child process output: {error}"))?;
            if read == 0 {
                break;
            }
            if output.len() <= MAX_PROCESS_OUTPUT {
                let remaining = MAX_PROCESS_OUTPUT + 1 - output.len();
                output.extend_from_slice(&buffer[..read.min(remaining)]);
            }
        }
        Ok(output)
    })
}

fn execute(
    command: &Path,
    arguments: &[String],
    cwd: &Path,
    timeout: Duration,
) -> Result<ProcessOutput, String> {
    let mut process = Command::new(command);
    process
        .args(arguments)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        process.process_group(0);
    }
    let mut child = process
        .spawn()
        .map_err(|error| format!("Cannot run {}: {error}", command.display()))?;
    let stdout = read_pipe(
        child
            .stdout
            .take()
            .ok_or_else(|| "Cannot capture adapter stdout".to_owned())?,
    );
    let stderr = read_pipe(
        child
            .stderr
            .take()
            .ok_or_else(|| "Cannot capture adapter stderr".to_owned())?,
    );
    let status = match child.wait_timeout(timeout) {
        Err(error) => {
            terminate(&mut child);
            let _ = stdout.join();
            let _ = stderr.join();
            return Err(format!("Cannot wait for adapter: {error}"));
        }
        Ok(Some(status)) => status,
        Ok(None) => {
            terminate(&mut child);
            let _ = stdout.join();
            let _ = stderr.join();
            return Err(format!(
                "Adapter timed out after {} ms",
                timeout.as_millis()
            ));
        }
    };
    let stdout = stdout
        .join()
        .map_err(|_| "Adapter stdout reader panicked".to_owned())??;
    let stderr = stderr
        .join()
        .map_err(|_| "Adapter stderr reader panicked".to_owned())??;
    if stdout.len() > MAX_PROCESS_OUTPUT || stderr.len() > MAX_PROCESS_OUTPUT {
        return Err(format!(
            "Adapter output exceeds {} bytes",
            MAX_PROCESS_OUTPUT
        ));
    }
    Ok(ProcessOutput {
        success: status.success(),
        stdout,
        stderr,
        status: status.to_string(),
    })
}

fn terminate(child: &mut Child) {
    #[cfg(unix)]
    {
        // Each adapter starts in its own process group so a timeout also stops
        // Emscripten/compiler descendants rather than orphaning them.
        let result = unsafe { libc::kill(-(child.id() as i32), libc::SIGKILL) };
        if result != 0 {
            let _ = child.kill();
        }
    }
    #[cfg(not(unix))]
    {
        let _ = child.kill();
    }
    let _ = child.wait();
}

fn nested<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    path.iter().try_fold(value, |current, key| current.get(key))
}

fn tail(value: &str, maximum: usize) -> String {
    if value.len() <= maximum {
        return value.to_owned();
    }
    let mut start = value.len() - maximum;
    while !value.is_char_boundary(start) {
        start += 1;
    }
    value[start..].to_owned()
}

fn command_error(output: &ProcessOutput) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    if stderr.is_empty() {
        format!("Adapter exited with {}", output.status)
    } else {
        format!("Adapter exited with {}\n{stderr}", output.status)
    }
}

fn source_failure_assessment(error: &str, item: &BuildItem) -> Option<Value> {
    let lowercase = error.to_ascii_lowercase();
    if lowercase.contains("repository not found")
        || lowercase.contains("repository does not exist")
        || lowercase.contains("could not read from remote repository")
    {
        Some(serde_json::json!({
            "strategy": "source-unavailable",
            "compileEligible": false,
            "requiresReview": true,
            "blockers": [{ "kind": "source-unavailable", "sourceUrl": item.source_url }],
        }))
    } else {
        None
    }
}

fn copy_if_exists(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    let content = fs::read(source)
        .map_err(|error| format!("Cannot read asset {}: {error}", source.display()))?;
    write_atomic(destination, &content)
}

fn copy_svg_tree(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(source)
        .map_err(|error| format!("Cannot read asset directory {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("Cannot read asset entry: {error}"))?;
        let target = destination.join(entry.file_name());
        if entry
            .file_type()
            .map_err(|error| format!("Cannot read asset type: {error}"))?
            .is_dir()
        {
            copy_svg_tree(&entry.path(), &target)?;
        } else if entry
            .path()
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("svg"))
        {
            copy_if_exists(&entry.path(), &target)?;
        }
    }
    Ok(())
}

fn copy_named_assets(source: &Path, destination: &Path, names: &[&str]) -> Result<(), String> {
    for name in names {
        copy_if_exists(&source.join(name), &destination.join(name))?;
    }
    Ok(())
}

fn stage_assets(paths: &SchedulerPaths, item: &BuildItem, commit: &str) -> Result<(), String> {
    let source = paths.source_cache.join(&item.plugin).join(commit);
    let components = paths.root.join("public/rack-components");
    match item.plugin.as_str() {
        "MSM" => {
            for directory in ["Knobs", "Switch", "Button", "Slider", "Port"] {
                copy_svg_tree(
                    &source.join("res").join(directory),
                    &components.join("msm").join(directory),
                )?;
            }
        }
        "ImpromptuModular" => {
            let destination = components.join("impromptu");
            copy_named_assets(
                &source.join("res/comp/complib"),
                &destination,
                &[
                    "Trimpot.svg",
                    "Trimpot_bg.svg",
                    "Rogan1PWhite_fg.svg",
                    "Rogan1S.svg",
                    "Rogan1PSWhite_fg.svg",
                ],
            )?;
            copy_if_exists(
                &source.join("res/fonts/Segment14.ttf"),
                &destination.join("Segment14.ttf"),
            )?;
        }
        "Leviathan" => copy_named_assets(
            &source.join("res/icon"),
            &components.join("leviathan"),
            &[
                "HaloKnob2Back.svg",
                "HaloKnobCenter.svg",
                "HaloKnobCenterLit.svg",
                "Eclipse2Knob.svg",
                "gear_knob_tiny.svg",
                "gold_button.svg",
                "PlasmaSwitchSmall.png",
            ],
        )?,
        "LifeFormModular" => copy_named_assets(
            &source.join("res"),
            &components.join("lifeform"),
            &[
                "LFMKnob.svg",
                "LFMNuKnob.svg",
                "LFMTinyKnob.svg",
                "LFMSlider.svg",
                "LFMSliderWhiteHandle.svg",
                "MS_0.svg",
                "MS_1.svg",
                "LFMSwitch_0.svg",
                "LFMSwitch_1.svg",
                "LFMSwitch_2.svg",
            ],
        )?,
        "LomasModules" => copy_named_assets(
            &source.join("res/Components"),
            &components.join("lomas"),
            &[
                "RubberButton.svg",
                "RubberButton1.svg",
                "RubberSmallButton.svg",
                "RubberSmallButton1.svg",
                "RoundGrayKnob.svg",
                "RoundSmallGrayKnob.svg",
                "RoundBigGrayKnob.svg",
            ],
        )?,
        "LyraeModules" => copy_named_assets(
            &source.join("res"),
            &components.join("lyrae"),
            &[
                "HexKnob.svg",
                "MedHexKnob.svg",
                "SmallHexKnob.svg",
                "SmallHexKnobInverted.svg",
                "Jack.svg",
            ],
        )?,
        _ => {}
    }
    if item.key == "ModularMooch/Wolfram" {
        let destination = components.join("modular-mooch");
        copy_if_exists(
            &source.join("res/fonts/wolfram.ttf"),
            &destination.join("wolfram.ttf"),
        )?;
        copy_named_assets(
            &source.join("res/components"),
            &destination,
            &[
                "M1900hBlackEncoder.svg",
                "M1900hBlackKnob.svg",
                "M1900hKnob_fg.svg",
                "RectangleLuckyLight.svg",
            ],
        )?;
    }
    if item.key == "Interrobang/ScribbleStrip" {
        copy_if_exists(
            &source.join("res/mad-midnight-marker-font/MadMidnightMarker-na91.ttf"),
            &components
                .join("interrobang")
                .join("MadMidnightMarker-na91.ttf"),
        )?;
    }
    Ok(())
}

fn build_arguments(paths: &SchedulerPaths, item: &BuildItem, build_dir: &Path) -> Vec<String> {
    let mut arguments = vec![
        paths.adapter_script.display().to_string(),
        item.library_url.clone(),
        "--source-cache-dir".to_owned(),
        paths.source_cache.display().to_string(),
        "--output".to_owned(),
        build_dir.display().to_string(),
        "--compile".to_owned(),
    ];
    if let Some(source_dir) = &paths.source_dir {
        arguments.push("--source-dir".to_owned());
        arguments.push(source_dir.display().to_string());
    }
    if let Some(source_tool) = &paths.source_tool {
        arguments.push("--source-tool".to_owned());
        arguments.push(source_tool.display().to_string());
    }
    arguments
}

fn previous_assessment(previous: Option<&Value>) -> Option<Value> {
    previous.and_then(|value| value.get("assessment")).cloned()
}

fn record_success(
    item: &BuildItem,
    build_dir: &Path,
    output: &ProcessOutput,
    paths: &SchedulerPaths,
    context: &Mutex<BuildContext>,
) -> Result<(), String> {
    let result: Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Invalid adapter JSON for {}: {error}", item.key))?;
    let source_commit = nested(&result, &["source", "commit"])
        .and_then(Value::as_str)
        .map(str::to_owned);
    if source_commit.as_deref().is_some_and(|commit| {
        commit.len() != 40 || !commit.bytes().all(|value| value.is_ascii_hexdigit())
    }) {
        return Err(format!(
            "Adapter returned an invalid source commit for {}",
            item.key
        ));
    }
    let artifact = result
        .get("artifact")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Adapter result for {} is missing artifact", item.key))?;
    let artifact = fs::canonicalize(artifact)
        .map_err(|error| format!("Cannot resolve adapter artifact {artifact}: {error}"))?;
    let canonical_build = fs::canonicalize(build_dir)
        .map_err(|error| format!("Cannot resolve {}: {error}", build_dir.display()))?;
    if !artifact.starts_with(&canonical_build) {
        return Err(format!(
            "Adapter artifact escapes build directory for {}",
            item.key
        ));
    }
    let content = fs::read(&artifact)
        .map_err(|error| format!("Cannot read {}: {error}", artifact.display()))?;
    let destination = paths
        .dynamic_root
        .join(&item.plugin)
        .join(&item.model)
        .join("module.wasm");
    let mut runtime = object(
        read_json(&build_dir.join("runtime.json"))?,
        "adapter runtime",
    )?;
    runtime.insert(
        "wasmUrl".to_owned(),
        Value::String(format!(
            "/dynamic-plugins/{}/{}/module.wasm",
            item.plugin, item.model
        )),
    );
    let strategy = nested(&result, &["assessment", "strategy"])
        .and_then(Value::as_str)
        .unwrap_or("direct-rack-source-adapter")
        .to_owned();
    let mut runtime_contract = runtime
        .remove("runtime")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    runtime_contract.insert("strategy".to_owned(), Value::String(strategy));
    runtime.insert("runtime".to_owned(), Value::Object(runtime_contract));
    runtime.insert(
        "localBuild".to_owned(),
        serde_json::json!({
            "builtAt": now()?,
            "sourceCommit": source_commit,
            "batch": true,
        }),
    );
    write_atomic(&destination, &content)?;
    let mut context = context
        .lock()
        .map_err(|_| "Build context lock is poisoned".to_owned())?;
    if let Some(commit) = source_commit.as_deref() {
        stage_assets(paths, item, commit)?;
    }
    let previous_definition = context
        .definitions
        .insert(item.key.clone(), Value::Object(runtime));
    let previous_state = context.state_modules.insert(
        item.key.clone(),
        serde_json::json!({
            "status": "compiled",
            "finishedAt": now()?,
            "sourceCommit": source_commit,
        }),
    );
    context.succeeded += 1;
    if let Err(error) = context.persist(paths) {
        context.succeeded -= 1;
        if let Some(previous) = previous_definition {
            context.definitions.insert(item.key.clone(), previous);
        } else {
            context.definitions.remove(&item.key);
        }
        if let Some(previous) = previous_state {
            context.state_modules.insert(item.key.clone(), previous);
        } else {
            context.state_modules.remove(&item.key);
        }
        return Err(error);
    }
    Ok(())
}

fn process_item(
    item: &BuildItem,
    options: &BuildOptions,
    paths: &SchedulerPaths,
    context: &Mutex<BuildContext>,
) -> Result<(), String> {
    let build_dir = paths.output_root.join(&item.plugin).join(&item.model);
    fs::create_dir_all(&build_dir)
        .map_err(|error| format!("Cannot create {}: {error}", build_dir.display()))?;
    let previous = {
        let mut context = context
            .lock()
            .map_err(|_| "Build context lock is poisoned".to_owned())?;
        let previous = context.state_modules.get(&item.key).cloned();
        context.state_modules.insert(
            item.key.clone(),
            serde_json::json!({ "status": "building", "startedAt": now()? }),
        );
        context.started += 1;
        eprintln!("[{}/{}] {}", context.started, context.attempted, item.key);
        context.persist(paths)?;
        previous
    };
    let result = execute(
        &paths.node,
        &build_arguments(paths, item, &build_dir),
        &paths.root,
        options.timeout,
    );
    let outcome = match result {
        Ok(output) if output.success => {
            match record_success(item, &build_dir, &output, paths, context) {
                Ok(()) => Ok(()),
                Err(error) => {
                    record_failure(item, &build_dir, &error, previous.as_ref(), paths, context)
                }
            }
        }
        Ok(output) => {
            let error = command_error(&output);
            record_failure(item, &build_dir, &error, previous.as_ref(), paths, context)
        }
        Err(error) => record_failure(item, &build_dir, &error, previous.as_ref(), paths, context),
    };
    if !options.keep_build && build_dir.exists() {
        fs::remove_dir_all(&build_dir)
            .map_err(|error| format!("Cannot remove {}: {error}", build_dir.display()))?;
    }
    outcome
}

fn record_failure(
    item: &BuildItem,
    build_dir: &Path,
    error: &str,
    previous: Option<&Value>,
    paths: &SchedulerPaths,
    context: &Mutex<BuildContext>,
) -> Result<(), String> {
    let mut assessment =
        source_failure_assessment(error, item).or_else(|| previous_assessment(previous));
    if let Ok(adapter) = read_json(&build_dir.join("adapter.json")) {
        if let Some(value) = adapter.get("assessment") {
            assessment = Some(value.clone());
        }
    }
    let mut failure = serde_json::json!({
        "status": "failed",
        "finishedAt": now()?,
        "error": tail(error, 16_000),
    });
    if let Some(assessment) = assessment {
        failure["assessment"] = assessment;
    }
    let mut context = context
        .lock()
        .map_err(|_| "Build context lock is poisoned".to_owned())?;
    context.state_modules.insert(item.key.clone(), failure);
    context.failed += 1;
    context.persist(paths)
}

fn remove_plugin_source(
    plugin: &str,
    options: &BuildOptions,
    paths: &SchedulerPaths,
    context: &Mutex<BuildContext>,
) -> Result<(), String> {
    if options.keep_source {
        return Ok(());
    }
    package_layout(plugin, "SafetyCheck", "0.0.0")?;
    let target = paths.source_cache.join(plugin);
    let existed = target.exists();
    if existed {
        fs::remove_dir_all(&target)
            .map_err(|error| format!("Cannot remove {}: {error}", target.display()))?;
    }
    if existed {
        context
            .lock()
            .map_err(|_| "Build context lock is poisoned".to_owned())?
            .removed_sources += 1;
    }
    Ok(())
}

fn process_group(
    plugin: &str,
    items: &[BuildItem],
    options: &BuildOptions,
    paths: &SchedulerPaths,
    context: &Mutex<BuildContext>,
) -> Result<(), String> {
    let result = (|| {
        let Some((first, rest)) = items.split_first() else {
            return Ok(());
        };
        process_item(first, options, paths, context)?;
        if rest.is_empty() {
            return Ok(());
        }
        let checkout_ready = paths.source_cache.join(plugin).exists();
        if !checkout_ready || options.concurrency == 1 {
            for item in rest {
                process_item(item, options, paths, context)?;
            }
            return Ok(());
        }
        let cursor = AtomicUsize::new(0);
        let infrastructure_error = Mutex::new(None::<String>);
        thread::scope(|scope| {
            for _ in 0..options.concurrency.min(rest.len()) {
                scope.spawn(|| loop {
                    if infrastructure_error
                        .lock()
                        .expect("infrastructure error lock should not be poisoned")
                        .is_some()
                    {
                        return;
                    }
                    let index = cursor.fetch_add(1, Ordering::Relaxed);
                    let Some(item) = rest.get(index) else {
                        return;
                    };
                    if let Err(error) = process_item(item, options, paths, context) {
                        *infrastructure_error
                            .lock()
                            .expect("infrastructure error lock should not be poisoned") =
                            Some(error);
                        return;
                    }
                });
            }
        });
        if let Some(error) = infrastructure_error
            .into_inner()
            .map_err(|_| "Infrastructure error lock is poisoned".to_owned())?
        {
            Err(error)
        } else {
            Ok(())
        }
    })();
    let cleanup = remove_plugin_source(plugin, options, paths, context);
    result.and(cleanup)
}

fn load_context(paths: &SchedulerPaths) -> Result<BuildContext, String> {
    if !paths.catalog.exists() {
        let registry = parse_registry(read_json(&paths.root.join("index.json"))?)?;
        write_json_atomic(&paths.catalog, &Value::Array(registry.packages))?;
    }
    let catalog = read_json(&paths.catalog)?;
    let catalog = catalog
        .as_array()
        .ok_or_else(|| "Build catalog must be a JSON array".to_owned())?;
    let mut definitions = BTreeMap::new();
    for item in catalog {
        let key = item
            .get("key")
            .and_then(Value::as_str)
            .ok_or_else(|| "Build catalog entry is missing key".to_owned())?;
        definitions.insert(key.to_owned(), item.clone());
    }
    let state = if paths.state.exists() {
        object(read_json(&paths.state)?, "build state")?
    } else {
        object(
            serde_json::json!({ "schemaVersion": 1, "modules": {} }),
            "build state",
        )?
    };
    if state.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported build state schema".to_owned());
    }
    let state_modules = state
        .get("modules")
        .and_then(Value::as_object)
        .cloned()
        .ok_or_else(|| "Build state modules must be an object".to_owned())?;
    Ok(BuildContext {
        state_root: state,
        state_modules,
        definitions,
        started: 0,
        succeeded: 0,
        failed: 0,
        removed_sources: 0,
        attempted: 0,
    })
}

pub fn build(options: &BuildOptions) -> Result<BuildReport, String> {
    if options.source_dir.is_some() && (options.plugin.is_none() || options.model.is_none()) {
        return Err("--source-dir requires one explicit --plugin and --model target".to_owned());
    }
    if !(1..=8).contains(&options.concurrency) {
        return Err("Build concurrency must be between 1 and 8".to_owned());
    }
    if let Some(plugin) = &options.plugin {
        package_layout(plugin, "FilterCheck", "0.0.0")?;
    }
    if let Some(model) = &options.model {
        package_layout("FilterCheck", model, "0.0.0")?;
    }
    let paths = paths(options)?;
    if !paths.queue.exists() {
        return Err("Run npm run source:discover first".to_owned());
    }
    let queue: BuildQueue = serde_json::from_value(read_json(&paths.queue)?)
        .map_err(|error| format!("Invalid build queue: {error}"))?;
    if queue.schema_version != 1 {
        return Err("Unsupported build queue schema".to_owned());
    }
    let mut queue_keys = std::collections::HashSet::new();
    for item in &queue.module_records {
        validate_item(item)?;
        if !queue_keys.insert(&item.key) {
            return Err(format!("Duplicate build queue key {}", item.key));
        }
    }
    let context = Mutex::new(load_context(&paths)?);
    {
        let mut context = context
            .lock()
            .map_err(|_| "Build context lock is poisoned".to_owned())?;
        for item in &queue.module_records {
            if item.plugin != "STS" || context.definitions.contains_key(&item.key) {
                continue;
            }
            context.state_modules.insert(
                item.key.clone(),
                serde_json::json!({
                    "status": "failed",
                    "finishedAt": now()?,
                    "error": format!("Excluded from the open-source registry. {STS_EXCLUSION}"),
                    "assessment": {
                        "strategy": "excluded-source-license",
                        "compileEligible": false,
                        "requiresReview": false,
                        "blockers": ["source-license"],
                    },
                }),
            );
        }
        context.persist(&paths)?;
    }
    let candidates = {
        let context = context
            .lock()
            .map_err(|_| "Build context lock is poisoned".to_owned())?;
        queue
            .module_records
            .iter()
            .filter(|item| item.plugin != "STS")
            .filter(|item| {
                options
                    .plugin
                    .as_ref()
                    .is_none_or(|plugin| &item.plugin == plugin)
            })
            .filter(|item| {
                options
                    .model
                    .as_ref()
                    .is_none_or(|model| &item.model == model)
            })
            .filter(|item| options.force || !context.definitions.contains_key(&item.key))
            .filter(|item| {
                options.retry
                    || context
                        .state_modules
                        .get(&item.key)
                        .and_then(|value| value.get("status"))
                        .and_then(Value::as_str)
                        != Some("failed")
            })
            .take(options.limit.unwrap_or(usize::MAX))
            .cloned()
            .collect::<Vec<_>>()
    };
    context
        .lock()
        .map_err(|_| "Build context lock is poisoned".to_owned())?
        .attempted = candidates.len();
    let mut groups = Vec::<(String, Vec<BuildItem>)>::new();
    let mut group_indexes = HashMap::new();
    for item in candidates {
        let index = if let Some(index) = group_indexes.get(&item.plugin) {
            *index
        } else {
            let index = groups.len();
            groups.push((item.plugin.clone(), Vec::new()));
            group_indexes.insert(item.plugin.clone(), index);
            index
        };
        groups[index].1.push(item);
    }
    for (plugin, items) in &groups {
        process_group(plugin, items, options, &paths, &context)?;
    }
    let context = context
        .into_inner()
        .map_err(|_| "Build context lock is poisoned".to_owned())?;
    Ok(BuildReport {
        attempted: context.attempted,
        succeeded: context.succeeded,
        failed: context.failed,
        concurrency: options.concurrency,
        catalog_modules: context.definitions.len(),
        removed_source_repositories: context.removed_sources,
        state_path: paths.state,
    })
}
