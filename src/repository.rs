use crate::registry::{
    package_fields, parse_registry, Artifact, REGISTRY_ABI_VERSION, REGISTRY_SCHEMA_VERSION,
};
use crate::storage::read_json;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerificationReport {
    pub package_count: usize,
    pub total_bytes: u64,
}

#[derive(Debug, Deserialize)]
struct Manifest {
    #[serde(rename = "schemaVersion")]
    schema_version: u64,
    #[serde(rename = "abiVersion")]
    abi_version: String,
    module: ManifestModule,
}

#[derive(Debug, Deserialize)]
struct ManifestModule {
    key: String,
    plugin: String,
    model: String,
    version: String,
    #[serde(rename = "wasmUrl")]
    wasm_url: String,
    #[serde(rename = "manifestUrl")]
    manifest_url: String,
    artifact: Artifact,
}

fn repository_path(root: &Path, relative: &str, label: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!("Invalid relative {label} path: {relative}"));
    }
    let candidate = root.join(path);
    let canonical = fs::canonicalize(&candidate)
        .map_err(|error| format!("Cannot resolve {}: {error}", candidate.display()))?;
    if !canonical.starts_with(root) {
        return Err(format!("{label} path escapes the repository: {relative}"));
    }
    Ok(canonical)
}

fn verify_manifest(
    path: &Path,
    raw: Value,
    expected: &crate::registry::PackageFields,
    expected_module: &Value,
) -> Result<(), String> {
    if raw.get("module") != Some(expected_module) {
        return Err(format!("Manifest mismatch for {}", expected.key));
    }
    let manifest: Manifest = serde_json::from_value(raw)
        .map_err(|error| format!("Invalid package manifest {}: {error}", path.display()))?;
    if manifest.schema_version != REGISTRY_SCHEMA_VERSION {
        return Err(format!("Unsupported manifest schema in {}", path.display()));
    }
    if manifest.abi_version != REGISTRY_ABI_VERSION {
        return Err(format!("Unsupported manifest ABI in {}", path.display()));
    }
    let module = manifest.module;
    if module.key != expected.key
        || module.plugin != expected.plugin
        || module.model != expected.model
        || module.version != expected.version
        || module.wasm_url != expected.wasm_url
        || Some(module.manifest_url.as_str()) != expected.manifest_url.as_deref()
        || module.artifact.sha256 != expected.artifact.sha256
        || module.artifact.size != expected.artifact.size
    {
        return Err(format!("Manifest mismatch for {}", expected.key));
    }
    Ok(())
}

pub fn verify_checkout(root: &Path) -> Result<VerificationReport, String> {
    let root = fs::canonicalize(root)
        .map_err(|error| format!("Cannot resolve repository root {}: {error}", root.display()))?;
    let index_path = root.join("index.json");
    let registry = parse_registry(read_json(&index_path)?)?;
    let mut keys = HashSet::new();
    let mut total_bytes = 0_u64;

    for item in &registry.packages {
        let fields = package_fields(item)?;
        if !keys.insert(fields.key.clone()) {
            return Err(format!("Duplicate key {}", fields.key));
        }
        if fields.key != format!("{}/{}", fields.plugin, fields.model) {
            return Err(format!("Package identity mismatch for {}", fields.key));
        }
        let expected_wasm_url = format!(
            "packages/{}/{}/{}/module.wasm",
            fields.plugin, fields.model, fields.version
        );
        let expected_manifest_url = format!(
            "packages/{}/{}/{}/manifest.json",
            fields.plugin, fields.model, fields.version
        );
        let manifest_url = fields
            .manifest_url
            .as_deref()
            .ok_or_else(|| format!("Missing manifestUrl for {}", fields.key))?;
        if fields.wasm_url != expected_wasm_url || manifest_url != expected_manifest_url {
            return Err(format!("Package path mismatch for {}", fields.key));
        }

        let artifact_path = repository_path(&root, &fields.wasm_url, "artifact")?;
        let content = fs::read(&artifact_path)
            .map_err(|error| format!("Cannot read {}: {error}", artifact_path.display()))?;
        let digest = format!("{:x}", Sha256::digest(&content));
        if content.len() as u64 != fields.artifact.size || digest != fields.artifact.sha256 {
            return Err(format!("Integrity mismatch {}", fields.key));
        }

        let manifest_path = repository_path(&root, manifest_url, "manifest")?;
        verify_manifest(&manifest_path, read_json(&manifest_path)?, &fields, item)?;
        total_bytes = total_bytes
            .checked_add(fields.artifact.size)
            .ok_or_else(|| "Registry byte total overflow".to_owned())?;
    }

    if registry.package_count != Some(registry.packages.len() as u64) {
        return Err("Registry packageCount does not match packages".to_owned());
    }
    if registry.total_bytes != Some(total_bytes) {
        return Err("Registry totalBytes does not match artifacts".to_owned());
    }

    Ok(VerificationReport {
        package_count: registry.packages.len(),
        total_bytes,
    })
}
