use serde::Serialize;
use serde_json::Value;
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use url::Url;

const LIBRARY_REPOSITORY: &str = "https://github.com/VCVRack/library.git";
const SOURCE_HOSTS: [&str; 4] = ["github.com", "gitlab.com", "codeberg.org", "git.s-ol.nu"];

#[derive(Clone, Debug)]
pub struct PrepareOptions {
    pub library_url: String,
    pub source_cache: Option<PathBuf>,
    pub source_dir: Option<PathBuf>,
    pub library_index: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTarget {
    pub plugin: String,
    pub model: String,
    pub key: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCheckout {
    pub directory: PathBuf,
    pub repository: String,
    pub commit: String,
    pub temporary: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedSource {
    pub target: SourceTarget,
    pub manifest: Value,
    pub source: SourceCheckout,
}

#[derive(Clone)]
struct CachedSource {
    directory: PathBuf,
    commit: String,
    manifest: Value,
}

#[derive(Clone, Debug)]
struct Submodule {
    path: String,
    url: String,
}

struct CacheLock(PathBuf);

impl Drop for CacheLock {
    fn drop(&mut self) {
        let _ = fs::remove_dir(&self.0);
    }
}

fn is_slug(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

fn exact_library_url(value: &str) -> Result<SourceTarget, String> {
    let url = Url::parse(value).map_err(|error| format!("Invalid Library URL: {error}"))?;
    if url.scheme() != "https"
        || url.host_str() != Some("library.vcvrack.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Expected an exact HTTPS VCV Library module URL".to_owned());
    }
    let parts = url
        .path_segments()
        .ok_or_else(|| "Library URL must contain exactly Plugin/Model slugs".to_owned())?
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.len() != 2 || parts.iter().any(|part| !is_slug(part)) {
        return Err("Library URL must contain exactly Plugin/Model slugs".to_owned());
    }
    Ok(SourceTarget {
        plugin: parts[0].to_owned(),
        model: parts[1].to_owned(),
        key: format!("{}/{}", parts[0], parts[1]),
        url: url.to_string(),
    })
}

pub fn normalize_source_repository(value: &str) -> Result<String, String> {
    let lower = value.to_ascii_lowercase();
    if lower.contains("/%2e") || value.split('/').any(|part| matches!(part, "." | "..")) {
        return Err("Source URL contains an unsafe path".to_owned());
    }
    let mut url = Url::parse(value).map_err(|error| format!("Invalid source URL: {error}"))?;
    let host = url
        .host_str()
        .ok_or_else(|| "Source URL does not contain a host".to_owned())?
        .to_owned();
    let upgradable_github = url.scheme() == "http" && host == "github.com";
    if (url.scheme() != "https" && !upgradable_github)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !SOURCE_HOSTS.contains(&host.as_str())
    {
        return Err("Automatic source checkout requires an approved HTTPS Git host".to_owned());
    }
    if upgradable_github {
        url.set_scheme("https")
            .map_err(|_| "Could not upgrade GitHub source URL".to_owned())?;
    }
    let mut parts = url
        .path()
        .trim_end_matches(".git")
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if host == "github.com"
        && parts.len() >= 4
        && matches!(parts.get(2), Some(&"blob") | Some(&"tree"))
    {
        parts.truncate(2);
    }
    if parts.is_empty()
        || parts.len() > 4
        || parts.iter().any(|part| {
            part.is_empty()
                || !part
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
        })
    {
        return Err("Source URL must identify a safe repository path".to_owned());
    }
    Ok(format!("https://{host}/{}.git", parts.join("/")))
}

fn locked_submodule_repository(value: &str) -> Result<String, String> {
    if value.trim_end_matches('/') == "http://luajit.org/git/luajit-2.0.git" {
        return Ok("https://github.com/LuaJIT/LuaJIT.git".to_owned());
    }
    normalize_source_repository(value)
}

fn run_git(directory: Option<&Path>, arguments: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    if let Some(directory) = directory {
        command.arg("-C").arg(directory);
    }
    let output = command
        .args(arguments)
        .output()
        .map_err(|error| format!("Could not run git: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if stderr.is_empty() {
            format!("git {} failed with {}", arguments.join(" "), output.status)
        } else {
            stderr
        });
    }
    String::from_utf8(output.stdout)
        .map(|value| value.trim().to_owned())
        .map_err(|error| format!("git output is not UTF-8: {error}"))
}

fn git_value(directory: &Path, arguments: &[&str]) -> String {
    run_git(Some(directory), arguments).unwrap_or_default()
}

fn unique_path(parent: &Path, prefix: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    parent.join(format!("{prefix}-{}-{nonce}", std::process::id()))
}

fn acquire_cache_lock(path: &Path) -> Result<CacheLock, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
    }
    let started = SystemTime::now();
    loop {
        match fs::create_dir(path) {
            Ok(()) => return Ok(CacheLock(path.to_owned())),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let stale = fs::metadata(path)
                    .and_then(|metadata| metadata.modified())
                    .ok()
                    .and_then(|modified| SystemTime::now().duration_since(modified).ok())
                    .is_some_and(|age| age > Duration::from_secs(120));
                if stale {
                    let _ = fs::remove_dir(path);
                    continue;
                }
                if SystemTime::now()
                    .duration_since(started)
                    .unwrap_or_default()
                    > Duration::from_secs(30)
                {
                    return Err(format!(
                        "Timed out waiting for source cache lock {}",
                        path.file_name()
                            .and_then(|name| name.to_str())
                            .unwrap_or("source-cache")
                    ));
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                return Err(format!("Cannot lock {}: {error}", path.display()));
            }
        }
    }
}

fn refresh_library_index(index: &Path) -> Result<(), String> {
    let lock_name = format!(
        "{}.lock",
        index
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("library-index")
    );
    let lock = index
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(lock_name);
    let _lock = acquire_cache_lock(&lock)?;
    if !index.join(".git").exists() {
        if index.exists() {
            return Err(format!(
                "Library index cache is incomplete at {}",
                index.display()
            ));
        }
        let parent = index.parent().unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(parent)
            .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
        let staging = unique_path(
            parent,
            &format!("{}.building", index.file_name().unwrap().to_string_lossy()),
        );
        let staging_text = staging.to_string_lossy().into_owned();
        if let Err(error) = run_git(
            None,
            &[
                "clone",
                "--depth",
                "1",
                "--filter=blob:none",
                "--branch",
                "v2",
                "--no-checkout",
                LIBRARY_REPOSITORY,
                &staging_text,
            ],
        ) {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
        fs::rename(&staging, index).map_err(|error| {
            format!("Cannot publish Library index {}: {error}", index.display())
        })?;
        return Ok(());
    }
    let fresh = fs::metadata(index.join(".git/FETCH_HEAD"))
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| SystemTime::now().duration_since(modified).ok())
        .is_some_and(|age| age < Duration::from_secs(30));
    if fresh {
        return Ok(());
    }
    run_git(Some(index), &["fetch", "--depth", "1", "origin", "v2"])
        .map(|_| ())
        .or_else(|error| {
            if index.join(".git/HEAD").exists() {
                Ok(())
            } else {
                Err(format!(
                    "Could not refresh or reuse the VCV Library index: {error}"
                ))
            }
        })
}

fn parse_submodules(contents: &str) -> Vec<Submodule> {
    let mut entries = Vec::<BTreeMap<String, String>>::new();
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[submodule \"") && trimmed.ends_with("\"]") {
            entries.push(BTreeMap::new());
        } else if let Some((key, value)) = trimmed.split_once('=') {
            if let Some(entry) = entries.last_mut() {
                entry.insert(key.trim().to_owned(), value.trim().to_owned());
            }
        }
    }
    entries
        .into_iter()
        .filter_map(|entry| {
            Some(Submodule {
                path: entry.get("path")?.clone(),
                url: entry.get("url")?.clone(),
            })
        })
        .collect()
}

fn official_library_submodule(
    contents: &str,
    plugin: &str,
    source_url: &str,
) -> Result<Option<Submodule>, String> {
    let repository = normalize_source_repository(source_url)?;
    let entries = parse_submodules(contents);
    let by_path = entries
        .iter()
        .find(|entry| entry.path == format!("repos/{plugin}"))
        .cloned();
    let by_repository = entries
        .iter()
        .filter(|entry| {
            normalize_source_repository(&entry.url).as_deref() == Ok(repository.as_str())
        })
        .cloned()
        .collect::<Vec<_>>();
    let selected = by_path.or_else(|| {
        if by_repository.len() == 1 {
            by_repository.into_iter().next()
        } else {
            None
        }
    });
    if selected
        .as_ref()
        .is_some_and(|entry| !safe_library_submodule_path(&entry.path))
    {
        return Err("Official Library submodule path is not a safe repository entry".to_owned());
    }
    Ok(selected)
}

fn safe_library_submodule_path(value: &str) -> bool {
    value.strip_prefix("repos/").is_some_and(|name| {
        !name.is_empty()
            && name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
    })
}

fn legacy_lock(plugin: &str, version: &str) -> Option<(&'static str, &'static str)> {
    match (plugin, version) {
        ("RJModules", "1.7.2") => Some((
            "https://github.com/Miserlou/RJModules.git",
            "7db2aadc1c2521365bf200a3c42ed0f90bbd841a",
        )),
        ("TheXOR", "1.1.1") => Some((
            "https://github.com/spectromas/RackPlugins.git",
            "168a32e1331f7eb355b1522ae0550186bebba45a",
        )),
        ("luckyxxl", "1.0.0") => Some((
            "https://github.com/eriser/vcv_luckyxxl.git",
            "13b76875e980503c1d123edded34a310cb2588a6",
        )),
        ("RacketScience", "1.1.0") => Some((
            "https://github.com/ContemporaryInsanity/RacketScience.git",
            "04caab44e47d60b3af2a9fae0108e9cc241f31ac",
        )),
        _ => None,
    }
}

pub fn source_revision_from_remote(repository: &str, version: &str) -> Result<String, String> {
    let tags = [
        format!("v{version}"),
        version.to_owned(),
        format!("vcv-v{version}"),
    ];
    let mut owned = vec!["ls-remote".to_owned(), repository.to_owned()];
    for tag in &tags {
        owned.push(format!("refs/tags/{tag}"));
        owned.push(format!("refs/tags/{tag}^{{}}"));
    }
    let arguments = owned.iter().map(String::as_str).collect::<Vec<_>>();
    let references = run_git(None, &arguments)?;
    let lines = references.lines().collect::<Vec<_>>();
    let tagged = lines
        .iter()
        .find(|line| line.ends_with("^{}"))
        .or_else(|| lines.first())
        .and_then(|line| line.split_whitespace().next())
        .unwrap_or_default();
    if is_commit(tagged) {
        return Ok(tagged.to_owned());
    }
    let head = run_git(None, &["ls-remote", repository, "HEAD"])?;
    let commit = head.split_whitespace().next().unwrap_or_default();
    if is_commit(commit) {
        Ok(commit.to_owned())
    } else {
        Err(format!(
            "Could not resolve an exact source revision for {repository}"
        ))
    }
}

fn is_commit(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn official_source_lock(
    plugin: &str,
    source_url: &str,
    version: &str,
    index: &Path,
) -> Result<(String, String), String> {
    let revision =
        if !git_value(index, &["rev-parse", "--verify", "FETCH_HEAD^{commit}"]).is_empty() {
            "FETCH_HEAD"
        } else {
            "HEAD"
        };
    let modules = run_git(Some(index), &["show", &format!("{revision}:.gitmodules")])?;
    let submodule = official_library_submodule(&modules, plugin, source_url)?;
    let (repository, commit) = if let Some(submodule) = submodule {
        (
            normalize_source_repository(&submodule.url)?,
            run_git(
                Some(index),
                &["rev-parse", &format!("{revision}:{}", submodule.path)],
            )?,
        )
    } else if let Some((repository, commit)) = legacy_lock(plugin, version) {
        (repository.to_owned(), commit.to_owned())
    } else {
        let repository = normalize_source_repository(source_url)?;
        let commit = source_revision_from_remote(&repository, version)?;
        (repository, commit)
    };
    if !is_commit(&commit) {
        return Err(format!(
            "Could not resolve an exact source revision for {plugin} {version}"
        ));
    }
    Ok((repository, commit))
}

fn manifest_from_index(index: &Path, plugin: &str) -> Result<Value, String> {
    for revision in ["FETCH_HEAD", "HEAD"] {
        if let Ok(contents) = run_git(
            Some(index),
            &["show", &format!("{revision}:manifests/{plugin}.json")],
        ) {
            return serde_json::from_str(&contents)
                .map_err(|error| format!("Invalid official manifest for {plugin}: {error}"));
        }
    }
    Err(format!("Could not read the official manifest for {plugin}"))
}

fn official_manifest(index: &Path, plugin: &str, prefer_index: bool) -> Result<Value, String> {
    if prefer_index {
        return manifest_from_index(index, plugin);
    }
    let remote = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Could not create manifest client: {error}"))?
        .get(format!(
            "https://raw.githubusercontent.com/VCVRack/library/v2/manifests/{plugin}.json"
        ))
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .and_then(reqwest::blocking::Response::json::<Value>);
    remote
        .map_err(|error| format!("Could not fetch the official manifest: {error}"))
        .or_else(|_| manifest_from_index(index, plugin))
}

fn version_parts(value: &str) -> Vec<(bool, String)> {
    let mut parts: Vec<(bool, String)> = Vec::new();
    for character in value.chars() {
        let numeric = character.is_ascii_digit();
        if parts.last().is_some_and(|(kind, _)| *kind == numeric) {
            parts.last_mut().unwrap().1.push(character);
        } else {
            parts.push((numeric, character.to_string()));
        }
    }
    parts
}

fn compare_versions(left: &str, right: &str) -> Ordering {
    let left = version_parts(left);
    let right = version_parts(right);
    for (left, right) in left.iter().zip(&right) {
        let order = if left.0 && right.0 {
            left.1
                .trim_start_matches('0')
                .len()
                .cmp(&right.1.trim_start_matches('0').len())
                .then_with(|| left.1.cmp(&right.1))
        } else {
            left.1.cmp(&right.1)
        };
        if order != Ordering::Equal {
            return order;
        }
    }
    left.len().cmp(&right.len())
}

fn cached_source(cache: Option<&Path>, target: &SourceTarget) -> Option<CachedSource> {
    let plugin_root = cache?.join(&target.plugin);
    let mut candidates = fs::read_dir(plugin_root)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter_map(|entry| {
            let commit = entry.file_name().to_string_lossy().into_owned();
            if !is_commit(&commit) || !entry.path().join(".git").exists() {
                return None;
            }
            let manifest: Value =
                serde_json::from_slice(&fs::read(entry.path().join("plugin.json")).ok()?).ok()?;
            let valid = git_value(&entry.path(), &["rev-parse", "HEAD"]) == commit
                && manifest.get("slug").and_then(Value::as_str) == Some(target.plugin.as_str())
                && manifest
                    .get("modules")
                    .and_then(Value::as_array)
                    .is_some_and(|modules| {
                        modules.iter().any(|module| {
                            module.get("slug").and_then(Value::as_str)
                                == Some(target.model.as_str())
                        })
                    })
                && manifest.get("sourceUrl").and_then(Value::as_str).is_some();
            valid.then_some(CachedSource {
                directory: entry.path(),
                commit,
                manifest,
            })
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        compare_versions(
            right
                .manifest
                .get("version")
                .and_then(Value::as_str)
                .unwrap_or(""),
            left.manifest
                .get("version")
                .and_then(Value::as_str)
                .unwrap_or(""),
        )
    });
    candidates.into_iter().next()
}

fn recoverable_checkout(repository: &str, commit: &str, target: &Path) -> Option<PathBuf> {
    let parent = target.parent()?;
    let prefix = format!("{}.building", target.file_name()?.to_string_lossy());
    let mut candidates = fs::read_dir(parent)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| {
            entry.file_type().is_ok_and(|kind| kind.is_dir())
                && entry.file_name().to_string_lossy().starts_with(&prefix)
        })
        .filter_map(|entry| {
            let directory = entry.path();
            let origin = git_value(&directory, &["config", "--get", "remote.origin.url"]);
            let normalized = locked_submodule_repository(&origin).ok()?;
            let valid = normalized == repository
                && git_value(&directory, &["rev-parse", "HEAD"]) == commit
                && git_value(&directory, &["status", "--porcelain"]).is_empty();
            let modified = entry.metadata().ok()?.modified().ok()?;
            valid.then_some((modified, directory))
        })
        .collect::<Vec<_>>();
    candidates.sort_by_key(|candidate| std::cmp::Reverse(candidate.0));
    candidates.into_iter().next().map(|(_, path)| path)
}

pub fn checkout_locked_repository(
    repository: &str,
    commit: &str,
    target: &Path,
) -> Result<PathBuf, String> {
    let repository = locked_submodule_repository(repository)?;
    if !is_commit(commit) {
        return Err(
            "Locked source commit must contain exactly 40 hexadecimal characters".to_owned(),
        );
    }
    if target.exists() {
        return Err(format!(
            "Source cache is incomplete at {}",
            target.display()
        ));
    }
    let parent = target
        .parent()
        .ok_or_else(|| format!("Source target has no parent: {}", target.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Cannot create {}: {error}", parent.display()))?;
    let recovered = recoverable_checkout(&repository, commit, target);
    let staging = recovered.clone().unwrap_or_else(|| {
        unique_path(
            parent,
            &format!("{}.building", target.file_name().unwrap().to_string_lossy()),
        )
    });
    if recovered.is_some() {
        eprintln!(
            "Resuming locked checkout {} from {}",
            target.file_name().unwrap().to_string_lossy(),
            staging.file_name().unwrap().to_string_lossy()
        );
    } else {
        let staging_text = staging.to_string_lossy().into_owned();
        run_git(
            None,
            &[
                "clone",
                "--filter=blob:none",
                "--no-checkout",
                &repository,
                &staging_text,
            ],
        )?;
    }
    if git_value(&staging, &["rev-parse", "HEAD"]) != commit {
        run_git(Some(&staging), &["fetch", "--depth", "1", "origin", commit])?;
    }
    run_git(Some(&staging), &["checkout", "--detach", commit])?;
    Ok(staging)
}

fn checkout_source(repository: &str, commit: &str, target: &Path) -> Result<(), String> {
    let staging = checkout_locked_repository(repository, commit, target)?;
    fs::rename(&staging, target).map_err(|error| {
        format!(
            "Cannot publish source checkout {}: {error}",
            target.display()
        )
    })
}

pub fn checkout_locked_dependency(
    repository: &str,
    commit: &str,
    target: &Path,
) -> Result<(), String> {
    checkout_source(repository, commit, target)
}

fn safe_relative_path(value: &str) -> bool {
    let path = Path::new(value);
    !path.is_absolute()
        && !value.is_empty()
        && path.components().all(|component| {
            matches!(component, Component::Normal(_))
                && component
                    .as_os_str()
                    .to_str()
                    .is_some_and(|part| !part.is_empty())
        })
}

fn selected_path(path: &str, allowed: Option<&BTreeSet<String>>) -> bool {
    allowed.is_none_or(|allowed| {
        allowed
            .iter()
            .any(|candidate| candidate == path || candidate.starts_with(&format!("{path}/")))
    })
}

fn initialize_submodules(
    root: &Path,
    depth: usize,
    allowed: Option<&BTreeSet<String>>,
    parent_path: &str,
) -> Result<(), String> {
    let modules_file = root.join(".gitmodules");
    if !modules_file.exists() {
        return Ok(());
    }
    if depth >= 4 {
        return Err(format!(
            "Submodule nesting exceeds the supported depth at {}",
            root.display()
        ));
    }
    let contents = fs::read_to_string(&modules_file)
        .map_err(|error| format!("Cannot read {}: {error}", modules_file.display()))?;
    for module in parse_submodules(&contents) {
        if !safe_relative_path(&module.path) {
            return Err(format!("Unsafe submodule path {}", module.path));
        }
        let locked_path = if parent_path.is_empty() {
            module.path.clone()
        } else {
            format!("{parent_path}/{}", module.path)
        };
        if !selected_path(&locked_path, allowed) {
            continue;
        }
        let target = root.join(&module.path);
        if !target.starts_with(root) {
            return Err(format!(
                "Submodule path escapes its source checkout: {}",
                module.path
            ));
        }
        let tree = run_git(Some(root), &["ls-tree", "HEAD", "--", &module.path])?;
        let mut fields = tree.split_whitespace();
        let mode = fields.next().unwrap_or_default();
        let kind = fields.next().unwrap_or_default();
        let object = fields.next().unwrap_or_default();
        if mode == "040000"
            && kind == "tree"
            && target.is_dir()
            && fs::read_dir(&target).is_ok_and(|mut entries| entries.next().is_some())
        {
            continue;
        }
        if mode != "160000" || kind != "commit" || !is_commit(object) {
            return Err(format!(
                "Could not resolve the locked gitlink for {}",
                module.path
            ));
        }
        let commit = object.to_owned();
        let repository = locked_submodule_repository(&module.url)?;
        let current = if target.join(".git").exists() {
            git_value(&target, &["rev-parse", "HEAD"])
        } else {
            String::new()
        };
        if !current.is_empty() {
            if current != commit {
                return Err(format!(
                    "Submodule cache {} differs from its locked gitlink",
                    module.path
                ));
            }
            initialize_submodules(&target, depth + 1, allowed, &locked_path)?;
            continue;
        }
        if target.exists() {
            if fs::read_dir(&target).is_ok_and(|mut entries| entries.next().is_some()) {
                return Err(format!(
                    "Submodule cache is incomplete at {}",
                    target.display()
                ));
            }
            fs::remove_dir(&target)
                .map_err(|error| format!("Cannot remove {}: {error}", target.display()))?;
        }
        let staging = match checkout_locked_repository(&repository, &commit, &target) {
            Ok(staging) => staging,
            Err(error) => {
                eprintln!(
                    "Skipping unavailable locked submodule {}: {error}",
                    module.path
                );
                continue;
            }
        };
        initialize_submodules(&staging, depth + 1, allowed, &locked_path)?;
        fs::rename(&staging, &target)
            .map_err(|error| format!("Cannot publish submodule {}: {error}", target.display()))?;
    }
    Ok(())
}

fn manifest_string<'a>(manifest: &'a Value, key: &str) -> Result<&'a str, String> {
    manifest
        .get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("Official manifest does not contain {key}"))
}

fn validate_manifest(manifest: &Value, target: &SourceTarget) -> Result<(), String> {
    if manifest.get("slug").and_then(Value::as_str) != Some(target.plugin.as_str())
        || !manifest
            .get("modules")
            .and_then(Value::as_array)
            .is_some_and(|modules| {
                modules.iter().any(|module| {
                    module.get("slug").and_then(Value::as_str) == Some(target.model.as_str())
                })
            })
    {
        return Err("Official manifest does not match the requested module".to_owned());
    }
    manifest_string(manifest, "sourceUrl")?;
    manifest_string(manifest, "version")?;
    Ok(())
}

pub fn prepare(options: &PrepareOptions) -> Result<PreparedSource, String> {
    let target = exact_library_url(&options.library_url)?;
    let cached = cached_source(options.source_cache.as_deref(), &target);
    let (index, temporary_index, prefer_index) = if let Some(index) = &options.library_index {
        (index.to_owned(), None, true)
    } else if let Some(cache) = &options.source_cache {
        (cache.join("library-index"), None, false)
    } else {
        let root = unique_path(&std::env::temp_dir(), "rack-web-library");
        (root.join("index"), Some(root), false)
    };
    if options.library_index.is_none() {
        if let Err(error) = refresh_library_index(&index) {
            if cached.is_none() || !index.join(".git").exists() {
                return Err(error);
            }
        }
    } else if !index.join(".git").exists() {
        return Err(format!(
            "Library index is not a Git checkout: {}",
            index.display()
        ));
    }
    let manifest = official_manifest(&index, &target.plugin, prefer_index).or_else(|error| {
        cached
            .as_ref()
            .map(|cached| cached.manifest.clone())
            .ok_or(error)
    })?;
    validate_manifest(&manifest, &target)?;
    let source_url = manifest_string(&manifest, "sourceUrl")?;
    let version = manifest_string(&manifest, "version")?;
    let normalized_source = normalize_source_repository(source_url)?;
    let matching_cache = cached.as_ref().filter(|cached| {
        cached.manifest.get("version").and_then(Value::as_str) == Some(version)
            && cached
                .manifest
                .get("sourceUrl")
                .and_then(Value::as_str)
                .and_then(|value| normalize_source_repository(value).ok())
                .as_deref()
                == Some(normalized_source.as_str())
    });
    let (repository, locked_commit) = if let Some(cached) = matching_cache {
        (normalized_source, cached.commit.clone())
    } else {
        official_source_lock(&target.plugin, source_url, version, &index)?
    };
    let (source_dir, commit, temporary) = if let Some(explicit) = &options.source_dir {
        let directory = fs::canonicalize(explicit).map_err(|error| {
            format!(
                "Cannot resolve source directory {}: {error}",
                explicit.display()
            )
        })?;
        let commit = git_value(&directory, &["rev-parse", "HEAD"]);
        if !is_commit(&commit) {
            return Err("Explicit source directory must be an exact Git checkout".to_owned());
        }
        (directory, commit, false)
    } else if let Some(cached) = matching_cache {
        (cached.directory.clone(), cached.commit.clone(), false)
    } else if let Some(cache) = &options.source_cache {
        let directory = cache.join(&target.plugin).join(&locked_commit);
        if !directory.join("plugin.json").exists() {
            checkout_source(&repository, &locked_commit, &directory)?;
        }
        (directory, locked_commit, false)
    } else {
        let root = unique_path(&std::env::temp_dir(), "rack-web-source");
        fs::create_dir_all(&root)
            .map_err(|error| format!("Cannot create {}: {error}", root.display()))?;
        let directory = root.join("checkout");
        checkout_source(&repository, &locked_commit, &directory)?;
        (directory, locked_commit, true)
    };
    if !source_dir.join("plugin.json").exists() {
        return Err("Checked-out source does not contain plugin.json".to_owned());
    }
    let allowed = if target.key == "ParableInstruments/Neil" {
        Some(BTreeSet::from(["parasites/stmlib".to_owned()]))
    } else {
        None
    };
    initialize_submodules(&source_dir, 0, allowed.as_ref(), "")?;
    let source_manifest: Value = serde_json::from_slice(
        &fs::read(source_dir.join("plugin.json"))
            .map_err(|error| format!("Cannot read source plugin.json: {error}"))?,
    )
    .map_err(|error| format!("Invalid source plugin.json: {error}"))?;
    if source_manifest.get("slug") != manifest.get("slug") {
        return Err("Source plugin.json slug differs from the official manifest".to_owned());
    }
    if source_manifest.get("version") != manifest.get("version") {
        return Err(format!(
            "Source version {} differs from Library version {}",
            source_manifest
                .get("version")
                .and_then(Value::as_str)
                .unwrap_or("<missing>"),
            version
        ));
    }
    if let Some(root) = temporary_index {
        let _ = fs::remove_dir_all(root);
    }
    Ok(PreparedSource {
        target,
        manifest,
        source: SourceCheckout {
            directory: source_dir,
            repository,
            commit,
            temporary,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::{legacy_lock, official_library_submodule};

    #[test]
    fn library_path_is_authoritative_when_a_submodule_label_differs() {
        let modules = "[submodule \"repos/Other\"]\n\tpath = repos/Other\n\turl = https://github.com/example/Other.git\n[submodule \"repos/ValleyFree\"]\n\tpath = repos/Valley\n\turl = https://github.com/ValleyAudio/ValleyRackFree.git\n";
        let selected =
            official_library_submodule(modules, "Valley", "https://github.com/attacker/Different")
                .expect("Library submodules should parse")
                .expect("Library path should select a source");
        assert_eq!(selected.path, "repos/Valley");
        assert_eq!(
            selected.url,
            "https://github.com/ValleyAudio/ValleyRackFree.git"
        );
    }

    #[test]
    fn legacy_library_releases_keep_their_reviewed_revision() {
        assert_eq!(
            legacy_lock("RJModules", "1.7.2"),
            Some((
                "https://github.com/Miserlou/RJModules.git",
                "7db2aadc1c2521365bf200a3c42ed0f90bbd841a"
            ))
        );
        assert_eq!(legacy_lock("RJModules", "2.0.0"), None);
    }
}
