use crate::registry::{package_fields, package_layout, parse_registry};
use crate::storage::{now, read_json, write_json_atomic};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug)]
pub struct DiscoveryOptions {
    pub root: PathBuf,
    pub library_index: Option<PathBuf>,
    pub output: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryReport {
    pub output: PathBuf,
    pub packages: usize,
    pub modules: usize,
    pub compiled: usize,
    pub pending: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryManifest {
    slug: Option<String>,
    name: Option<String>,
    version: Option<String>,
    license: Option<String>,
    source_url: Option<String>,
    modules: Option<Vec<LibraryModule>>,
}

#[derive(Debug, Deserialize)]
struct LibraryModule {
    slug: Option<String>,
    name: Option<String>,
    description: Option<String>,
    #[serde(default)]
    tags: Vec<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageRecord {
    plugin: String,
    name: String,
    version: String,
    license: String,
    source_url: String,
    modules: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModuleRecord {
    key: String,
    plugin: String,
    model: String,
    name: String,
    description: String,
    tags: Vec<Value>,
    version: String,
    license: String,
    source_url: String,
    library_url: String,
    compiled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveryIndex {
    schema_version: u64,
    discovered_at: String,
    source_revision: String,
    packages: usize,
    modules: usize,
    compiled: usize,
    pending: usize,
    package_records: Vec<PackageRecord>,
    module_records: Vec<ModuleRecord>,
}

struct Snapshot(PathBuf);

impl Snapshot {
    fn create() -> Result<Self, String> {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("Cannot create discovery timestamp: {error}"))?
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("peach-library-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&path)
            .map_err(|error| format!("Cannot create {}: {error}", path.display()))?;
        Ok(Self(path))
    }
}

impl Drop for Snapshot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn run(command: &str, arguments: &[String]) -> Result<String, String> {
    let output = Command::new(command)
        .args(arguments)
        .output()
        .map_err(|error| format!("Cannot run {command}: {error}"))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if message.is_empty() {
            format!("{command} exited with {}", output.status)
        } else {
            format!("{command}: {message}")
        });
    }
    String::from_utf8(output.stdout)
        .map_err(|error| format!("{command} output is not UTF-8: {error}"))
}

fn git(index: &Path, arguments: &[&str]) -> Result<String, String> {
    let mut command = vec!["-C".to_owned(), index.display().to_string()];
    command.extend(arguments.iter().map(|value| (*value).to_owned()));
    run("git", &command)
}

fn snapshot_manifests(index: &Path, revision: &str) -> Result<Snapshot, String> {
    let snapshot = Snapshot::create()?;
    let archive = snapshot.0.join("manifests.tar");
    git(
        index,
        &[
            "archive",
            "--format=tar",
            &format!("--output={}", archive.display()),
            revision,
            "manifests",
        ],
    )?;
    run(
        "tar",
        &[
            "-xf".to_owned(),
            archive.display().to_string(),
            "-C".to_owned(),
            snapshot.0.display().to_string(),
        ],
    )?;
    Ok(snapshot)
}

pub fn discover(options: &DiscoveryOptions) -> Result<DiscoveryReport, String> {
    let root = fs::canonicalize(&options.root).map_err(|error| {
        format!(
            "Cannot resolve repository root {}: {error}",
            options.root.display()
        )
    })?;
    let library_index = options
        .library_index
        .clone()
        .unwrap_or_else(|| root.join(".cache/vcv-library-sources/library-index"));
    let output = options
        .output
        .clone()
        .unwrap_or_else(|| root.join(".build/open-source-modules.json"));
    let registry = parse_registry(read_json(&root.join("index.json"))?)?;
    let compiled: HashSet<String> = registry
        .packages
        .iter()
        .map(package_fields)
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(|fields| fields.key)
        .collect();
    let revision = git(&library_index, &["rev-parse", "HEAD"])?
        .trim()
        .to_owned();
    if revision.len() != 40 || !revision.bytes().all(|value| value.is_ascii_hexdigit()) {
        return Err("Library index HEAD is not an exact Git revision".to_owned());
    }
    let snapshot = snapshot_manifests(&library_index, &revision)?;
    let manifests = snapshot.0.join("manifests");
    let mut manifest_files = fs::read_dir(&manifests)
        .map_err(|error| format!("Cannot read {}: {error}", manifests.display()))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .collect::<Vec<_>>();
    manifest_files.sort();
    let open_license = Regex::new(
        r"(?i)(?:^|\b)(?:AGPL|Apache|Artistic|BSD|CC0|GPL|ISC|LGPL|MIT|MPL|Unlicense|Zlib)(?:\b|-)",
    )
    .map_err(|error| format!("Cannot compile license matcher: {error}"))?;
    let mut packages = Vec::new();
    let mut modules = Vec::new();

    for file in manifest_files {
        let Ok(content) = fs::read_to_string(&file) else {
            continue;
        };
        let Ok(manifest) = serde_json::from_str::<LibraryManifest>(&content) else {
            continue;
        };
        let Some(source_url) = manifest.source_url.filter(|value| !value.is_empty()) else {
            continue;
        };
        let Some(license) = manifest.license else {
            continue;
        };
        if !open_license.is_match(&license) {
            continue;
        }
        let fallback_plugin = file
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_owned();
        let plugin = manifest
            .slug
            .filter(|value| !value.is_empty())
            .unwrap_or(fallback_plugin);
        let version = manifest
            .version
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "0.0.0".to_owned());
        let Some(manifest_modules) = manifest.modules else {
            continue;
        };
        let mut package_modules = Vec::new();
        for item in manifest_modules {
            let Some(model) = item.slug.filter(|value| !value.is_empty()) else {
                continue;
            };
            let Ok(layout) = package_layout(&plugin, &model, &version) else {
                continue;
            };
            let record = ModuleRecord {
                key: layout.key.clone(),
                plugin: plugin.clone(),
                model: model.clone(),
                name: item
                    .name
                    .filter(|value| !value.is_empty())
                    .unwrap_or_else(|| model.clone()),
                description: item.description.unwrap_or_default(),
                tags: item.tags,
                version: version.clone(),
                license: license.clone(),
                source_url: source_url.clone(),
                library_url: format!("https://library.vcvrack.com/{plugin}/{model}"),
                compiled: compiled.contains(&layout.key),
            };
            package_modules.push(layout.key);
            modules.push(record);
        }
        packages.push(PackageRecord {
            plugin: plugin.clone(),
            name: manifest
                .name
                .filter(|value| !value.is_empty())
                .unwrap_or(plugin),
            version,
            license,
            source_url,
            modules: package_modules,
        });
    }
    let compiled_count = modules.iter().filter(|item| item.compiled).count();
    let result = DiscoveryIndex {
        schema_version: 1,
        discovered_at: now()?,
        source_revision: revision,
        packages: packages.len(),
        modules: modules.len(),
        compiled: compiled_count,
        pending: modules.len() - compiled_count,
        package_records: packages,
        module_records: modules,
    };
    let value = serde_json::to_value(&result)
        .map_err(|error| format!("Cannot serialize discovery result: {error}"))?;
    write_json_atomic(&output, &value)?;
    Ok(DiscoveryReport {
        output,
        packages: result.packages,
        modules: result.modules,
        compiled: result.compiled,
        pending: result.pending,
    })
}
