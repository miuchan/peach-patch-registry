use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use url::Url;

pub const DEFAULT_REGISTRY: &str =
    "https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/index.json";
pub const REGISTRY_SCHEMA_VERSION: u64 = 1;
pub const REGISTRY_ABI_VERSION: &str = "0.3";

#[derive(Debug, Deserialize)]
pub struct Registry {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u64,
    #[serde(rename = "abiVersion")]
    pub abi_version: String,
    #[serde(rename = "packageCount")]
    pub package_count: Option<u64>,
    #[serde(rename = "totalBytes")]
    pub total_bytes: Option<u64>,
    pub packages: Vec<Value>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Artifact {
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
pub struct PackageFields {
    pub key: String,
    pub plugin: String,
    pub model: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub description: String,
    pub width: f64,
    #[serde(rename = "wasmUrl")]
    pub wasm_url: String,
    #[serde(rename = "manifestUrl")]
    pub manifest_url: Option<String>,
    pub artifact: Artifact,
}

pub struct LoadedJson {
    pub data: Value,
    pub base: Url,
}

pub struct PackageLayout {
    pub key: String,
    pub wasm_url: String,
    pub manifest_url: String,
}

pub fn package_layout(plugin: &str, model: &str, version: &str) -> Result<PackageLayout, String> {
    for (label, value) in [("plugin", plugin), ("model", model), ("version", version)] {
        let mut characters = value.chars();
        let starts_safely = characters
            .next()
            .is_some_and(|value| value.is_ascii_alphanumeric());
        if !starts_safely
            || !characters.all(|value| value.is_ascii_alphanumeric() || "._+-".contains(value))
        {
            return Err(format!("Invalid package record: unsafe {label} {value}"));
        }
    }
    Ok(PackageLayout {
        key: format!("{plugin}/{model}"),
        wasm_url: format!("packages/{plugin}/{model}/{version}/module.wasm"),
        manifest_url: format!("packages/{plugin}/{model}/{version}/manifest.json"),
    })
}

pub fn package_fields(item: &Value) -> Result<PackageFields, String> {
    let fields: PackageFields = serde_json::from_value(item.clone())
        .map_err(|error| format!("Invalid package record: {error}"))?;
    let layout = package_layout(&fields.plugin, &fields.model, &fields.version)?;
    if !fields.width.is_finite()
        || fields.width <= 0.0
        || fields.key != layout.key
        || fields.wasm_url != layout.wasm_url
        || fields
            .manifest_url
            .as_deref()
            .is_some_and(|value| value != layout.manifest_url)
    {
        return Err(format!(
            "Invalid package record: identity or package path mismatch for {}",
            fields.key
        ));
    }
    Ok(fields)
}

pub fn parse_registry(data: Value) -> Result<Registry, String> {
    let registry: Registry =
        serde_json::from_value(data).map_err(|error| format!("Invalid registry: {error}"))?;
    if registry.schema_version != REGISTRY_SCHEMA_VERSION {
        return Err("Unsupported registry schema".to_owned());
    }
    if registry.abi_version != REGISTRY_ABI_VERSION {
        return Err("Unsupported registry ABI".to_owned());
    }
    Ok(registry)
}

pub fn load_json(client: &Client, source: &str) -> Result<LoadedJson, String> {
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

pub fn read_bytes(client: &Client, source: &Url) -> Result<Vec<u8>, String> {
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

pub fn resolve(base: &Url, relative: &str) -> Result<Url, String> {
    base.join(relative)
        .map_err(|error| format!("Invalid artifact URL {relative}: {error}"))
}

pub fn verify_artifact(item: &PackageFields, content: &[u8]) -> Result<(), String> {
    let digest = format!("{:x}", Sha256::digest(content));
    if content.len() as u64 != item.artifact.size || digest != item.artifact.sha256 {
        return Err(format!("Integrity check failed for {}", item.key));
    }
    Ok(())
}

pub fn find_package<'a>(
    packages: &'a [Value],
    key: &str,
) -> Result<(&'a Value, PackageFields), String> {
    let item = packages
        .iter()
        .find(|candidate| {
            candidate
                .get("key")
                .and_then(Value::as_str)
                .is_some_and(|value| value.eq_ignore_ascii_case(key))
        })
        .ok_or_else(|| format!("Package not found: {key}"))?;
    let fields = package_fields(item)?;
    Ok((item, fields))
}

pub fn default_prefix() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".peach-patch")
}
