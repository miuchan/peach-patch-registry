use crate::registry::{package_fields, package_layout, parse_registry};
use crate::storage::{now, read_json, write_atomic, write_json_atomic};
use serde::Serialize;
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::ops::Range;
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

fn package_object_ranges(source: &str) -> Result<Vec<(String, Range<usize>)>, String> {
    let packages = source
        .find("\"packages\"")
        .ok_or_else(|| "Registry index is missing packages".to_owned())?;
    let array = source[packages..]
        .find('[')
        .map(|offset| packages + offset + 1)
        .ok_or_else(|| "Registry packages value is not an array".to_owned())?;
    let bytes = source.as_bytes();
    let mut cursor = array;
    let mut ranges = Vec::new();
    loop {
        while cursor < bytes.len() && (bytes[cursor].is_ascii_whitespace() || bytes[cursor] == b',')
        {
            cursor += 1;
        }
        if bytes.get(cursor) == Some(&b']') {
            return Ok(ranges);
        }
        if bytes.get(cursor) != Some(&b'{') {
            return Err(format!(
                "Unexpected registry package token at byte {cursor}"
            ));
        }
        let start = cursor;
        let mut depth = 0_u64;
        let mut quoted = false;
        let mut escaped = false;
        while cursor < bytes.len() {
            let byte = bytes[cursor];
            cursor += 1;
            if quoted {
                if escaped {
                    escaped = false;
                } else if byte == b'\\' {
                    escaped = true;
                } else if byte == b'"' {
                    quoted = false;
                }
                continue;
            }
            if byte == b'"' {
                quoted = true;
            } else if byte == b'{' {
                depth += 1;
            } else if byte == b'}' {
                depth = depth
                    .checked_sub(1)
                    .ok_or_else(|| "Registry package object closed unexpectedly".to_owned())?;
                if depth == 0 {
                    break;
                }
            }
        }
        if depth != 0 || quoted {
            return Err("Registry package object did not terminate".to_owned());
        }
        let range = start..cursor;
        let package: Value = serde_json::from_str(&source[range.clone()])
            .map_err(|error| format!("Invalid registry package JSON: {error}"))?;
        let key = package
            .get("key")
            .and_then(Value::as_str)
            .ok_or_else(|| "Registry package is missing key".to_owned())?;
        ranges.push((key.to_owned(), range));
    }
}

fn preserve_unpublished_package_lexemes(
    original: &str,
    generated: &str,
    published_keys: &HashSet<String>,
) -> Result<String, String> {
    let original_ranges = package_object_ranges(original)?
        .into_iter()
        .collect::<HashMap<_, _>>();
    let generated_ranges = package_object_ranges(generated)?;
    let mut output = String::with_capacity(generated.len());
    let mut cursor = 0;
    for (key, range) in generated_ranges {
        output.push_str(&generated[cursor..range.start]);
        if published_keys.contains(&key) {
            output.push_str(&generated[range.clone()]);
        } else if let Some(original_range) = original_ranges.get(&key) {
            output.push_str(&original[original_range.clone()]);
        } else {
            output.push_str(&generated[range.clone()]);
        }
        cursor = range.end;
    }
    output.push_str(&generated[cursor..]);
    Ok(output)
}

fn refresh_repository_metadata(
    root: &std::path::Path,
    packages: &[Value],
    published_keys: &HashSet<String>,
    generated_at: &str,
) -> Result<(), String> {
    let status_path = root.join("build-status.json");
    let mut status_counts = None;
    if status_path.exists() {
        let mut status = object(read_json(&status_path)?, "build status")?;
        let mut records = array(
            status
                .remove("records")
                .ok_or_else(|| "Build status is missing records".to_owned())?,
            "build status records",
        )?;
        let published = packages
            .iter()
            .filter(|item| item.get("hidden") != Some(&Value::Bool(true)))
            .filter_map(|item| {
                let key = item.get("key")?.as_str()?;
                published_keys
                    .contains(key)
                    .then_some((key.to_owned(), item))
            })
            .collect::<Vec<_>>();
        let published_by_key = published
            .iter()
            .map(|(key, item)| (key.as_str(), *item))
            .collect::<HashMap<_, _>>();
        let mut observed = HashSet::new();
        for record in &mut records {
            let Some(key) = record.get("key").and_then(Value::as_str) else {
                continue;
            };
            let Some(module) = published_by_key.get(key) else {
                continue;
            };
            observed.insert(key.to_owned());
            let record = record
                .as_object_mut()
                .ok_or_else(|| "Build status record must be an object".to_owned())?;
            record.insert("status".to_owned(), Value::String("compiled".to_owned()));
            for field in [
                "plugin",
                "model",
                "name",
                "version",
                "license",
                "sourceUrl",
                "libraryUrl",
                "sourceCommit",
            ] {
                if let Some(value) = module.get(field) {
                    record.insert(field.to_owned(), value.clone());
                }
            }
            for field in ["assessment", "error", "blockers"] {
                record.remove(field);
            }
        }
        for (key, module) in published {
            if observed.contains(&key) {
                continue;
            }
            let mut record = Map::new();
            for field in [
                "key",
                "plugin",
                "model",
                "name",
                "version",
                "license",
                "sourceUrl",
                "libraryUrl",
                "sourceCommit",
            ] {
                if let Some(value) = module.get(field) {
                    record.insert(field.to_owned(), value.clone());
                }
            }
            record.insert("status".to_owned(), Value::String("compiled".to_owned()));
            records.push(Value::Object(record));
        }
        let mut counts = records.iter().fold(BTreeMap::new(), |mut counts, record| {
            let status = record
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("pending");
            *counts.entry(status.to_owned()).or_insert(0_u64) += 1;
            counts
        });
        for status in ["compiled", "failed", "pending"] {
            counts.entry(status.to_owned()).or_insert(0);
        }
        let counts_value = Value::Object(
            counts
                .iter()
                .map(|(key, value)| (key.clone(), Value::Number((*value).into())))
                .collect(),
        );
        status.insert(
            "generatedAt".to_owned(),
            Value::String(generated_at.to_owned()),
        );
        status.insert(
            "modules".to_owned(),
            Value::Number((records.len() as u64).into()),
        );
        status.insert("status".to_owned(), counts_value);
        status.insert("records".to_owned(), Value::Array(records));
        write_json_atomic(&status_path, &Value::Object(status))?;
        status_counts = Some(counts);
    }

    let coverage_path = root.join("coverage.json");
    if coverage_path.exists() {
        let mut coverage = object(read_json(&coverage_path)?, "coverage")?;
        let visible = packages
            .iter()
            .filter(|item| item.get("hidden") != Some(&Value::Bool(true)))
            .collect::<Vec<_>>();
        let plugins = visible
            .iter()
            .filter_map(|item| item.get("plugin").and_then(Value::as_str))
            .collect::<HashSet<_>>();
        let bytes = visible.iter().try_fold(0_u64, |total, item| {
            let size = nested(item, &["artifact", "size"])
                .and_then(Value::as_u64)
                .ok_or_else(|| "Visible package artifact size must be an integer".to_owned())?;
            total
                .checked_add(size)
                .ok_or_else(|| "Visible package byte total overflow".to_owned())
        })?;
        let strategies = visible.iter().fold(BTreeMap::new(), |mut counts, item| {
            let strategy = nested(item, &["runtime", "strategy"])
                .and_then(Value::as_str)
                .unwrap_or("ordered-translation");
            *counts.entry(strategy.to_owned()).or_insert(0_u64) += 1;
            counts
        });
        coverage.insert(
            "generatedAt".to_owned(),
            Value::String(generated_at.to_owned()),
        );
        coverage.insert(
            "compiledModules".to_owned(),
            Value::Number((visible.len() as u64).into()),
        );
        coverage.insert(
            "plugins".to_owned(),
            Value::Number((plugins.len() as u64).into()),
        );
        coverage.insert("bytes".to_owned(), Value::Number(bytes.into()));
        coverage.insert(
            "strategies".to_owned(),
            Value::Object(
                strategies
                    .into_iter()
                    .map(|(key, value)| (key, Value::Number(value.into())))
                    .collect(),
            ),
        );
        if let Some(counts) = status_counts {
            coverage.insert(
                "openSourceCandidates".to_owned(),
                Value::Number(counts.values().sum::<u64>().into()),
            );
            coverage.insert(
                "openSourceStatus".to_owned(),
                Value::Object(
                    counts
                        .into_iter()
                        .map(|(key, value)| (key, Value::Number(value.into())))
                        .collect(),
                ),
            );
        }
        write_json_atomic(&coverage_path, &Value::Object(coverage))?;
    }
    Ok(())
}

pub fn publish(options: &PublishOptions) -> Result<PublicationReport, String> {
    let root = fs::canonicalize(&options.root).map_err(|error| {
        format!(
            "Cannot resolve repository root {}: {error}",
            options.root.display()
        )
    })?;
    let index_path = root.join("index.json");
    let index_source = fs::read_to_string(&index_path)
        .map_err(|error| format!("Cannot read {}: {error}", index_path.display()))?;
    let raw_index: Value = serde_json::from_str(&index_source)
        .map_err(|error| format!("Invalid JSON in {}: {error}", index_path.display()))?;
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
    let mut published_keys = HashSet::new();
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
        published_keys.insert(layout.key);
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
    let generated_at = now()?;
    index.insert(
        "generatedAt".to_owned(),
        Value::String(generated_at.clone()),
    );
    index.insert(
        "packageCount".to_owned(),
        Value::Number((packages.len() as u64).into()),
    );
    index.insert("totalBytes".to_owned(), Value::Number(total_bytes.into()));
    index.insert("packages".to_owned(), Value::Array(packages.clone()));
    let mut generated_index = serde_json::to_string_pretty(&Value::Object(index))
        .map_err(|error| format!("Cannot serialize {}: {error}", index_path.display()))?;
    generated_index.push('\n');
    let generated_index =
        preserve_unpublished_package_lexemes(&index_source, &generated_index, &published_keys)?;
    write_atomic(&index_path, generated_index.as_bytes())?;
    refresh_repository_metadata(&root, &packages, &published_keys, &generated_at)?;

    Ok(PublicationReport {
        updated,
        packages: packages.len(),
        index: index_path,
    })
}
