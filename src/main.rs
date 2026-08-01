use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use url::Url;

const DEFAULT_REGISTRY: &str =
    "https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/index.json";
const USAGE: &str = "peach <search QUERY|list|info KEY|install KEY|verify KEY> [--registry URL|FILE] [--prefix DIR]";

#[derive(Debug, Deserialize)]
struct Registry {
    #[serde(rename = "schemaVersion")]
    schema_version: u64,
    packages: Vec<Value>,
}

#[derive(Debug, Deserialize)]
struct Artifact {
    sha256: String,
    size: u64,
}

#[derive(Debug, Deserialize)]
struct PackageFields {
    key: String,
    plugin: String,
    model: String,
    name: String,
    version: String,
    #[serde(default)]
    brand: String,
    #[serde(default)]
    description: String,
    #[serde(rename = "wasmUrl")]
    wasm_url: String,
    #[serde(rename = "manifestUrl")]
    manifest_url: Option<String>,
    artifact: Artifact,
}

struct LoadedJson {
    data: Value,
    base: Url,
}

fn field<T: for<'de> Deserialize<'de>>(item: &Value) -> Result<T, String> {
    serde_json::from_value(item.clone()).map_err(|error| format!("Invalid package record: {error}"))
}

fn parse_options(args: &[String]) -> Result<(Vec<String>, String, PathBuf), String> {
    let mut positional = Vec::new();
    let mut registry =
        env::var("PEACH_PATCH_REGISTRY").unwrap_or_else(|_| DEFAULT_REGISTRY.to_owned());
    let mut prefix = env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".peach-patch");
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--registry" | "--prefix" => {
                let name = args[index].clone();
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| format!("{name} requires a value"))?;
                if name == "--registry" {
                    registry = value.clone();
                } else {
                    prefix = PathBuf::from(value);
                }
                index += 2;
            }
            value if value.starts_with('-') => return Err(format!("Unknown option: {value}")),
            value => {
                positional.push(value.to_owned());
                index += 1;
            }
        }
    }
    Ok((positional, registry, prefix))
}

fn load_json(client: &Client, source: &str) -> Result<LoadedJson, String> {
    if source.starts_with("http://") || source.starts_with("https://") {
        let response = client
            .get(source)
            .header("accept", "application/json")
            .send()
            .map_err(|error| format!("{source}: {error}"))?;
        let final_url = response.url().clone();
        if !response.status().is_success() {
            return Err(format!("{source} returned {}", response.status()));
        }
        let data = response
            .json()
            .map_err(|error| format!("Invalid JSON from {source}: {error}"))?;
        Ok(LoadedJson {
            data,
            base: final_url,
        })
    } else {
        let path = if let Some(file_url) = source.strip_prefix("file:") {
            Url::parse(&format!("file:{file_url}"))
                .map_err(|error| format!("Invalid file URL {source}: {error}"))?
                .to_file_path()
                .map_err(|_| format!("Invalid file URL {source}"))?
        } else {
            fs::canonicalize(source).map_err(|error| format!("Cannot read {source}: {error}"))?
        };
        let text = fs::read_to_string(&path)
            .map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
        let data = serde_json::from_str(&text)
            .map_err(|error| format!("Invalid JSON in {}: {error}", path.display()))?;
        let base = Url::from_file_path(path).map_err(|_| "Cannot create file URL".to_owned())?;
        Ok(LoadedJson { data, base })
    }
}

fn read_bytes(client: &Client, source: &Url) -> Result<Vec<u8>, String> {
    if source.scheme() == "file" {
        let path = source
            .to_file_path()
            .map_err(|_| format!("Invalid file URL {source}"))?;
        fs::read(&path).map_err(|error| format!("Cannot read {}: {error}", path.display()))
    } else {
        let response = client
            .get(source.clone())
            .send()
            .map_err(|error| format!("{source}: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("{source} returned {}", response.status()));
        }
        response
            .bytes()
            .map(|bytes| bytes.to_vec())
            .map_err(|error| format!("Cannot read {source}: {error}"))
    }
}

fn resolve(base: &Url, relative: &str) -> Result<Url, String> {
    base.join(relative)
        .map_err(|error| format!("Invalid artifact URL {relative}: {error}"))
}

fn verify(item: &PackageFields, content: &[u8]) -> Result<(), String> {
    let digest = format!("{:x}", Sha256::digest(content));
    if content.len() as u64 != item.artifact.size || digest != item.artifact.sha256 {
        return Err(format!("Integrity check failed for {}", item.key));
    }
    Ok(())
}

fn find<'a>(packages: &'a [Value], key: &str) -> Result<(&'a Value, PackageFields), String> {
    let item = packages
        .iter()
        .find(|candidate| {
            candidate
                .get("key")
                .and_then(Value::as_str)
                .is_some_and(|value| value.eq_ignore_ascii_case(key))
        })
        .ok_or_else(|| format!("Package not found: {key}"))?;
    let fields = field(item)?;
    Ok((item, fields))
}

fn print_list(packages: &[Value], query: &str) -> Result<(), String> {
    let needle = query.to_lowercase();
    for item in packages {
        let fields: PackageFields = field(item)?;
        let haystack = format!(
            "{} {} {} {}",
            fields.key, fields.name, fields.brand, fields.description
        )
        .to_lowercase();
        if haystack.contains(&needle) {
            println!("{:<42} {:<12} {}", fields.key, fields.version, fields.name);
        }
    }
    Ok(())
}

fn install(
    client: &Client,
    item: &PackageFields,
    raw: &Value,
    base: &Url,
    prefix: &Path,
) -> Result<(), String> {
    let content = read_bytes(client, &resolve(base, &item.wasm_url)?)?;
    verify(item, &content)?;
    let target = prefix
        .join("packages")
        .join(&item.plugin)
        .join(&item.model)
        .join(&item.version);
    fs::create_dir_all(&target)
        .map_err(|error| format!("Cannot create {}: {error}", target.display()))?;
    let temporary = target.join(format!("module.wasm.{}.tmp", std::process::id()));
    let mut file = fs::File::create(&temporary)
        .map_err(|error| format!("Cannot create {}: {error}", temporary.display()))?;
    file.write_all(&content)
        .map_err(|error| format!("Cannot write {}: {error}", temporary.display()))?;
    file.sync_all()
        .map_err(|error| format!("Cannot sync {}: {error}", temporary.display()))?;
    fs::rename(&temporary, target.join("module.wasm"))
        .map_err(|error| format!("Cannot install module: {error}"))?;
    let manifest = match &item.manifest_url {
        Some(url) => load_json(client, &resolve(base, url)?.to_string())?.data,
        None => raw.clone(),
    };
    let manifest_path = target.join("manifest.json");
    fs::write(
        &manifest_path,
        format!("{}\n", serde_json::to_string_pretty(&manifest).unwrap()),
    )
    .map_err(|error| format!("Cannot write {}: {error}", manifest_path.display()))?;
    println!(
        "{}@{} installed in {}",
        item.key,
        item.version,
        target.display()
    );
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    let (positional, registry_source, prefix) = parse_options(&args)?;
    let command = positional.first().map(String::as_str).unwrap_or("help");
    if command == "help" {
        println!("{USAGE}");
        return Ok(());
    }
    let query = positional.get(1).map(String::as_str).unwrap_or("");
    let client = Client::builder()
        .user_agent("peach-cli/1.0")
        .build()
        .map_err(|error| error.to_string())?;
    let loaded = load_json(&client, &registry_source)?;
    let registry: Registry = serde_json::from_value(loaded.data)
        .map_err(|error| format!("Invalid registry: {error}"))?;
    if registry.schema_version != 1 {
        return Err("Unsupported registry schema".to_owned());
    }
    match command {
        "list" => print_list(&registry.packages, ""),
        "search" => print_list(&registry.packages, query),
        "info" => {
            let (raw, _) = find(&registry.packages, query)?;
            println!("{}", serde_json::to_string_pretty(raw).unwrap());
            Ok(())
        }
        "install" => {
            let (raw, item) = find(&registry.packages, query)?;
            install(&client, &item, raw, &loaded.base, &prefix)
        }
        "verify" => {
            let (_, item) = find(&registry.packages, query)?;
            let target = prefix
                .join("packages")
                .join(&item.plugin)
                .join(&item.model)
                .join(&item.version)
                .join("module.wasm");
            let content = fs::read(&target)
                .map_err(|error| format!("Cannot read {}: {error}", target.display()))?;
            verify(&item, &content)?;
            println!("{}@{} verified", item.key, item.version);
            Ok(())
        }
        _ => {
            println!("{USAGE}");
            Ok(())
        }
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("peach: {error}");
        std::process::exit(1);
    }
}
