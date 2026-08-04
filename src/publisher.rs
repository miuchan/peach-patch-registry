use crate::registry::{package_fields, package_layout, parse_registry};
use crate::storage::{now, read_json, write_atomic, write_json_atomic};
use serde::Serialize;
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub struct PublishOptions {
    pub root: PathBuf,
    pub catalog: Option<PathBuf>,
    pub dynamic_root: Option<PathBuf>,
    pub key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationReport {
    pub updated: usize,
    pub packages: usize,
    pub index: PathBuf,
}

fn object(value: Value, label: &str) -> Result<Map<String, Value>, String> {
    value
        .as_object()
        .cloned()
        .ok_or_else(|| format!("{label} must be a JSON object"))
}

fn array(value: Value, label: &str) -> Result<Vec<Value>, String> {
    value
        .as_array()
        .cloned()
        .ok_or_else(|| format!("{label} must be a JSON array"))
}

fn nested<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    path.iter().try_fold(value, |current, key| current.get(key))
}

fn optional_string(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_str).map(str::to_owned)
}

fn merge_package(existing: Option<&Value>, item: &Value) -> Result<Map<String, Value>, String> {
    let mut merged = existing
        .cloned()
        .map(|value| object(value, "existing package"))
        .transpose()?
        .unwrap_or_default();
    for (key, value) in object(item.clone(), "catalog package")? {
        merged.insert(key, value);
    }
    Ok(merged)
}

fn compare_package_keys(left: &str, right: &str) -> Ordering {
    left.to_ascii_lowercase()
        .cmp(&right.to_ascii_lowercase())
        .then_with(|| left.cmp(right))
}

fn insert_package_key(order: &mut Vec<String>, key: &str) {
    let position = order
        .iter()
        .position(|candidate| compare_package_keys(key, candidate) == Ordering::Less)
        .unwrap_or(order.len());
    order.insert(position, key.to_owned());
}

pub fn publish(options: &PublishOptions) -> Result<PublicationReport, String> {
    let root = fs::canonicalize(&options.root).map_err(|error| {
        format!(
            "Cannot resolve repository root {}: {error}",
            options.root.display()
        )
    })?;
    let index_path = root.join("index.json");
    let raw_index = read_json(&index_path)?;
    let registry = parse_registry(raw_index.clone())?;
    let mut index = object(raw_index, "registry index")?;
    let catalog_path = options
        .catalog
        .clone()
        .unwrap_or_else(|| root.join(".build/catalog.json"));
    let catalog = if catalog_path.exists() {
        array(read_json(&catalog_path)?, "catalog")?
    } else {
        registry.packages.clone()
    };
    let dynamic_root = options
        .dynamic_root
        .clone()
        .unwrap_or_else(|| root.join("public/dynamic-plugins"));
    let mut by_key = HashMap::new();
    let mut package_order = Vec::new();
    for item in registry.packages {
        let fields = package_fields(&item)?;
        package_order.push(fields.key.clone());
        by_key.insert(fields.key, item);
    }
    let candidates: Vec<Value> = catalog
        .into_iter()
        .filter(|item| {
            options
                .key
                .as_ref()
                .is_none_or(|key| item.get("key").and_then(Value::as_str) == Some(key.as_str()))
        })
        .collect();
    if options.key.is_some() && candidates.len() != 1 {
        return Err(format!(
            "Unknown registry key: {}",
            options.key.as_deref().unwrap_or_default()
        ));
    }

    let mut updated = 0;
    for item in candidates {
        let key = item
            .get("key")
            .and_then(Value::as_str)
            .ok_or_else(|| "Catalog package is missing key".to_owned())?
            .to_owned();
        let existing = by_key.get(&key).cloned();
        let mut module = merge_package(existing.as_ref(), &item)?;
        let plugin = module
            .get("plugin")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("Catalog package {key} is missing plugin"))?
            .to_owned();
        let model = module
            .get("model")
            .and_then(Value::as_str)
            .ok_or_else(|| format!("Catalog package {key} is missing model"))?
            .to_owned();
        let version = module
            .get("version")
            .and_then(Value::as_str)
            .or_else(|| {
                existing
                    .as_ref()
                    .and_then(|value| value.get("version"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("0.0.0")
            .to_owned();
        module.insert("key".to_owned(), Value::String(key.clone()));
        module.insert("plugin".to_owned(), Value::String(plugin.clone()));
        module.insert("model".to_owned(), Value::String(model.clone()));
        module.insert("version".to_owned(), Value::String(version.clone()));
        let layout = package_layout(&plugin, &model, &version)?;
        if key != layout.key {
            return Err(format!("Catalog package identity mismatch for {key}"));
        }
        let relative_artifact = layout.wasm_url;
        let relative_manifest = layout.manifest_url;
        module.insert(
            "wasmUrl".to_owned(),
            Value::String(relative_artifact.clone()),
        );
        module.insert(
            "manifestUrl".to_owned(),
            Value::String(relative_manifest.clone()),
        );
        let dynamic = dynamic_root.join(&plugin).join(&model).join("module.wasm");
        let existing_artifact = existing
            .as_ref()
            .and_then(|value| value.get("wasmUrl"))
            .and_then(Value::as_str)
            .map(|value| root.join(value));
        let source_artifact = if dynamic.exists() {
            Some(dynamic)
        } else {
            existing_artifact.filter(|path| path.exists())
        };
        let Some(source_artifact) = source_artifact else {
            continue;
        };
        let content = fs::read(&source_artifact)
            .map_err(|error| format!("Cannot read {}: {error}", source_artifact.display()))?;
        let artifact = serde_json::json!({
            "sha256": format!("{:x}", Sha256::digest(&content)),
            "size": content.len() as u64,
        });
        module.insert("artifact".to_owned(), artifact.clone());
        let local_build = module.remove("localBuild");
        if let Some(source_commit) = optional_string(
            local_build
                .as_ref()
                .and_then(|value| value.get("sourceCommit")),
        ) {
            module.insert("sourceCommit".to_owned(), Value::String(source_commit));
        }
        let module_value = Value::Object(module);
        package_fields(&module_value)?;
        let destination = root.join(&relative_artifact);
        if source_artifact != destination {
            write_atomic(&destination, &content)?;
        }
        let source_commit = optional_string(
            local_build
                .as_ref()
                .and_then(|value| value.get("sourceCommit")),
        )
        .or_else(|| optional_string(module_value.get("sourceCommit")));
        let source_url = module_value.get("sourceUrl").cloned();
        let strategy = nested(&module_value, &["runtime", "strategy"])
            .cloned()
            .unwrap_or_else(|| Value::String("ordered-translation".to_owned()));
        let mut source = Map::new();
        if let Some(source_url) = source_url {
            source.insert("url".to_owned(), source_url);
        }
        source.insert(
            "commit".to_owned(),
            source_commit.map(Value::String).unwrap_or(Value::Null),
        );
        let mut build = Map::new();
        build.insert("strategy".to_owned(), strategy);
        for key in ["fingerprint", "builtAt"] {
            if let Some(value) = local_build
                .as_ref()
                .and_then(|local_build| local_build.get(key))
                .cloned()
            {
                build.insert(key.to_owned(), value);
            }
        }
        let manifest = serde_json::json!({
            "schemaVersion": 1,
            "abiVersion": "0.3",
            "module": module_value,
            "source": source,
            "build": build,
        });
        write_json_atomic(&root.join(&relative_manifest), &manifest)?;
        if !by_key.contains_key(&key) {
            insert_package_key(&mut package_order, &key);
        }
        by_key.insert(key, manifest["module"].clone());
        updated += 1;
    }

    let packages: Vec<Value> = package_order
        .into_iter()
        .map(|key| {
            by_key
                .remove(&key)
                .ok_or_else(|| format!("Internal package ordering mismatch for {key}"))
        })
        .collect::<Result<_, _>>()?;
    let total_bytes = packages.iter().try_fold(0_u64, |total, item| {
        let fields = package_fields(item)?;
        total
            .checked_add(fields.artifact.size)
            .ok_or_else(|| "Registry byte total overflow".to_owned())
    })?;
    index.insert("generatedAt".to_owned(), Value::String(now()?));
    index.insert(
        "packageCount".to_owned(),
        Value::Number((packages.len() as u64).into()),
    );
    index.insert("totalBytes".to_owned(), Value::Number(total_bytes.into()));
    index.insert("packages".to_owned(), Value::Array(packages.clone()));
    write_json_atomic(&index_path, &Value::Object(index))?;

    Ok(PublicationReport {
        updated,
        packages: packages.len(),
        index: index_path,
    })
}
