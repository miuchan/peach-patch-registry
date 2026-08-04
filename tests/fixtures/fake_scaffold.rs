use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

fn option(arguments: &[String], name: &str) -> Option<String> {
    arguments
        .iter()
        .position(|argument| argument == name)
        .and_then(|index| arguments.get(index + 1))
        .cloned()
}

fn write(path: impl AsRef<Path>, contents: impl AsRef<[u8]>) {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("fixture parent directory should be created");
    }
    fs::write(path, contents).expect("fixture output should be written");
}

fn target(url: &str) -> (&str, &str) {
    let path = url
        .strip_prefix("https://library.vcvrack.com/")
        .expect("fixture URL should use the Library origin");
    path.split_once('/')
        .expect("fixture URL should contain plugin and model")
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    if arguments.get(1).is_some_and(|argument| argument == "--orphan-writer") {
        thread::sleep(Duration::from_millis(600));
        write(
            arguments.get(2).expect("orphan marker should be provided"),
            b"orphaned\n",
        );
        return;
    }

    let library_url = arguments.get(2).expect("Library URL should be provided");
    let (plugin, model) = target(library_url);
    let output = PathBuf::from(option(&arguments, "--output").expect("output should be provided"));
    let source_cache = PathBuf::from(
        option(&arguments, "--source-cache-dir").expect("source cache should be provided"),
    );
    let commit = if plugin == "MSM" {
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    } else {
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    };
    let source = source_cache.join(plugin).join(commit);
    fs::create_dir_all(&source).expect("fixture source should be created");
    fs::create_dir_all(&output).expect("fixture output should be created");

    if model == "Slow" {
        thread::sleep(Duration::from_secs(2));
    }
    if model == "SlowChild" {
        let marker = source_cache
            .parent()
            .expect("source cache should have a parent")
            .join("orphan-marker");
        Command::new(env::current_exe().expect("fixture executable should resolve"))
            .arg("--orphan-writer")
            .arg(marker)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("orphan fixture child should start");
        thread::sleep(Duration::from_secs(2));
    }
    if model.starts_with("Parallel") {
        let plugin_root = source_cache.join(plugin);
        let lock = plugin_root.join("parallel-lock");
        let owner = fs::create_dir(&lock).is_ok();
        if !owner {
            write(plugin_root.join("parallel-observed"), b"yes\n");
        }
        thread::sleep(Duration::from_millis(if owner { 400 } else { 50 }));
        if owner {
            fs::remove_dir_all(lock).expect("parallel fixture lock should be removed");
        }
    }
    if model == "Fail" {
        write(
            output.join("adapter.json"),
            b"{\n  \"assessment\": {\n    \"strategy\": \"manual-browser-adapter\",\n    \"compileEligible\": false,\n    \"requiresReview\": true,\n    \"blockers\": [\"fixture-failure\"]\n  }\n}\n",
        );
        eprintln!("fixture compiler rejected the module");
        std::process::exit(7);
    }

    if plugin == "MSM" {
        let knobs = source.join("res/Knobs");
        write(knobs.join("FixtureKnob.svg"), b"<svg/>\n");
        write(knobs.join("Ignored.png"), b"not-an-svg\n");
    }

    let artifact = output.join("module.wasm");
    write(&artifact, format!("{plugin}/{model} fixture wasm\n"));
    write(
        output.join("runtime.json"),
        format!(
            "{{\n  \"key\": \"{plugin}/{model}\",\n  \"plugin\": \"{plugin}\",\n  \"model\": \"{model}\",\n  \"name\": \"{plugin} {model}\",\n  \"version\": \"1.0.0\",\n  \"description\": \"Scheduler fixture\",\n  \"runtime\": {{ \"state\": \"fixture\" }}\n}}\n"
        ),
    );
    println!(
        "{{\"key\":\"{plugin}/{model}\",\"artifact\":{},\"source\":{{\"commit\":\"{commit}\"}},\"assessment\":{{\"strategy\":\"fixture-source-adapter\",\"compileEligible\":true}}}}",
        serde_json_string(&artifact.to_string_lossy())
    );
}

fn serde_json_string(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
            .replace('\t', "\\t")
    )
}
