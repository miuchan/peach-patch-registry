use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::Path;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

pub fn now() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| format!("Cannot format timestamp: {error}"))
}

pub fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
    serde_json::from_str(&text)
        .map_err(|error| format!("Invalid JSON in {}: {error}", path.display()))
}

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Cannot resolve parent of {}", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
    let temporary = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("registry"),
        std::process::id()
    ));
    let mut file = fs::File::create(&temporary)
        .map_err(|error| format!("Cannot create {}: {error}", temporary.display()))?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Cannot write {}: {error}", temporary.display()));
    }
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Cannot replace {}: {error}", path.display()));
    }
    Ok(())
}

pub fn write_json_atomic(path: &Path, value: &Value) -> Result<(), String> {
    let mut content = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("Cannot serialize {}: {error}", path.display()))?;
    content.push(b'\n');
    write_atomic(path, &content)
}
