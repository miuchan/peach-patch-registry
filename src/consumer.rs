use crate::registry::{
    default_prefix, find_package, load_json, package_fields, parse_registry, read_bytes, resolve,
    verify_artifact, PackageFields, DEFAULT_REGISTRY,
};
use reqwest::blocking::Client;
use serde_json::Value;
use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use url::Url;

pub const USAGE: &str =
    "peach <search QUERY|list|info KEY|install KEY|verify KEY> [--registry URL|FILE] [--prefix DIR]";

fn parse_options(args: &[String]) -> Result<(Vec<String>, String, PathBuf), String> {
    let mut positional = Vec::new();
    let mut registry =
        env::var("PEACH_PATCH_REGISTRY").unwrap_or_else(|_| DEFAULT_REGISTRY.to_owned());
    let mut prefix = default_prefix();
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

fn print_list(packages: &[Value], query: &str) -> Result<(), String> {
    let needle = query.to_lowercase();
    for item in packages {
        let fields = package_fields(item)?;
        if fields.hidden {
            continue;
        }
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
    verify_artifact(item, &content)?;
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
        Some(url) => {
            let manifest_url = resolve(base, url)?;
            load_json(client, manifest_url.as_str())?.data
        }
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

pub fn run(args: &[String]) -> Result<(), String> {
    let (positional, registry_source, prefix) = parse_options(args)?;
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
    let registry = parse_registry(loaded.data)?;
    match command {
        "list" => print_list(&registry.packages, ""),
        "search" => print_list(&registry.packages, query),
        "info" => {
            let (raw, _) = find_package(&registry.packages, query)?;
            println!("{}", serde_json::to_string_pretty(raw).unwrap());
            Ok(())
        }
        "install" => {
            let (raw, item) = find_package(&registry.packages, query)?;
            install(&client, &item, raw, &loaded.base, &prefix)
        }
        "verify" => {
            let (_, item) = find_package(&registry.packages, query)?;
            let target = prefix
                .join("packages")
                .join(&item.plugin)
                .join(&item.model)
                .join(&item.version)
                .join("module.wasm");
            let content = fs::read(&target)
                .map_err(|error| format!("Cannot read {}: {error}", target.display()))?;
            verify_artifact(&item, &content)?;
            println!("{}@{} verified", item.key, item.version);
            Ok(())
        }
        _ => {
            println!("{USAGE}");
            Ok(())
        }
    }
}
