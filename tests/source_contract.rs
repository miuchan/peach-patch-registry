mod support;

use peach_cli::source::{normalize_source_repository, source_revision_from_remote};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use support::TemporaryDirectory;

fn git(directory: &Path, arguments: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(directory)
        .args(arguments)
        .output()
        .expect("git should run");
    assert!(
        output.status.success(),
        "git {} failed: {}",
        arguments.join(" "),
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout)
        .expect("git output should be UTF-8")
        .trim()
        .to_owned()
}

fn initialize_repository(path: &Path) {
    fs::create_dir_all(path).expect("repository directory should be created");
    git(path, &["init", "--quiet"]);
    git(path, &["config", "user.name", "Registry Fixture"]);
    git(path, &["config", "user.email", "registry@example.test"]);
}

fn commit_all(path: &Path, message: &str) -> String {
    git(path, &["add", "."]);
    git(path, &["commit", "--quiet", "-m", message]);
    git(path, &["rev-parse", "HEAD"])
}

struct SourceFixture {
    _temporary: TemporaryDirectory,
    source: PathBuf,
    index: PathBuf,
    cache: PathBuf,
    commit: String,
    rewrites: Vec<(String, String)>,
}

impl SourceFixture {
    fn new(label: &str, unsafe_submodule: bool) -> Self {
        let temporary = TemporaryDirectory::new(label);
        let source = temporary.path().join("source");
        initialize_repository(&source);
        fs::write(
            source.join("plugin.json"),
            "{\n  \"slug\": \"Fixture\",\n  \"version\": \"1.2.3\",\n  \"sourceUrl\": \"https://github.com/example/Fixture\",\n  \"modules\": [{\"slug\": \"Gain\"}]\n}\n",
        )
        .expect("plugin manifest should be written");
        fs::create_dir_all(source.join("src")).expect("source directory should be created");
        fs::write(source.join("src/Gain.cpp"), "// fixture source\n")
            .expect("source should be written");
        if unsafe_submodule {
            fs::write(
                source.join(".gitmodules"),
                "[submodule \"escape\"]\n\tpath = ../escape\n\turl = https://github.com/example/Escape.git\n",
            )
            .expect("unsafe submodule declaration should be written");
        }
        let commit = commit_all(&source, "source fixture");

        let index = temporary.path().join("library-index");
        initialize_repository(&index);
        fs::create_dir_all(index.join("manifests")).expect("manifest directory should be created");
        fs::write(
            index.join("manifests/Fixture.json"),
            "{\n  \"slug\": \"Fixture\",\n  \"name\": \"Fixture\",\n  \"version\": \"1.2.3\",\n  \"license\": \"MIT\",\n  \"sourceUrl\": \"https://github.com/example/Fixture\",\n  \"modules\": [{\"slug\": \"Gain\", \"name\": \"Gain\"}]\n}\n",
        )
        .expect("official manifest should be written");
        fs::write(
            index.join(".gitmodules"),
            "[submodule \"repos/Fixture\"]\n\tpath = repos/Fixture\n\turl = https://github.com/example/Fixture.git\n",
        )
        .expect("Library submodule declaration should be written");
        git(&index, &["add", ".gitmodules", "manifests/Fixture.json"]);
        git(
            &index,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                &format!("160000,{commit},repos/Fixture"),
            ],
        );
        git(&index, &["commit", "--quiet", "-m", "Library fixture"]);
        let cache = temporary.path().join("cache");
        let source_url = format!(
            "file://{}",
            source.to_str().expect("source path should be UTF-8")
        );
        Self {
            _temporary: temporary,
            source,
            index,
            cache,
            commit,
            rewrites: vec![(
                source_url,
                "https://github.com/example/Fixture.git".to_owned(),
            )],
        }
    }

    fn run(&self) -> Output {
        let mut command = self.command();
        command.args([
            "source",
            "prepare",
            "--url",
            "https://library.vcvrack.com/Fixture/Gain",
            "--source-cache",
            self.cache.to_str().expect("cache path should be UTF-8"),
            "--library-index",
            self.index.to_str().expect("index path should be UTF-8"),
            "--format",
            "json",
        ]);
        command.output().expect("source prepare should run")
    }

    fn command(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_peach-registry"));
        command.env("GIT_CONFIG_COUNT", self.rewrites.len().to_string());
        for (index, (replacement, original)) in self.rewrites.iter().enumerate() {
            command.env(
                format!("GIT_CONFIG_KEY_{index}"),
                format!("url.{replacement}.insteadOf"),
            );
            command.env(format!("GIT_CONFIG_VALUE_{index}"), original);
        }
        command
    }

    fn update_library_gitlink(&mut self) {
        git(
            &self.index,
            &[
                "update-index",
                "--add",
                "--cacheinfo",
                &format!("160000,{},repos/Fixture", self.commit),
            ],
        );
        git(
            &self.index,
            &["commit", "--quiet", "-m", "Update source gitlink"],
        );
    }
}

#[test]
fn source_urls_are_normalized_at_the_rust_boundary() {
    assert_eq!(
        normalize_source_repository("http://github.com/example/Fixture/tree/main/src")
            .expect("GitHub tree URL should normalize"),
        "https://github.com/example/Fixture.git"
    );
    assert_eq!(
        normalize_source_repository("https://gitlab.com/group/Fixture.git")
            .expect("GitLab URL should normalize"),
        "https://gitlab.com/group/Fixture.git"
    );
    for unsafe_url in [
        "https://evil.example/Fixture.git",
        "https://github.com/example/../secret",
        "https://github.com/example/%2e%2e/secret",
        "https://user@github.com/example/Fixture",
    ] {
        assert!(
            normalize_source_repository(unsafe_url).is_err(),
            "{unsafe_url} should be rejected"
        );
    }
}

#[test]
fn remote_revision_prefers_version_tags_and_falls_back_to_head() {
    let temporary = TemporaryDirectory::new("source-revision");
    let repository = temporary.path().join("repository");
    initialize_repository(&repository);
    fs::write(repository.join("one"), "one\n").expect("fixture should be written");
    let tagged = commit_all(&repository, "tagged");
    git(&repository, &["tag", "v1.2.3"]);
    fs::write(repository.join("two"), "two\n").expect("fixture should be written");
    let head = commit_all(&repository, "head");
    assert_eq!(
        source_revision_from_remote(
            repository
                .to_str()
                .expect("repository path should be UTF-8"),
            "1.2.3"
        )
        .expect("version tag should resolve"),
        tagged
    );
    assert_eq!(
        source_revision_from_remote(
            repository
                .to_str()
                .expect("repository path should be UTF-8"),
            "9.9.9"
        )
        .expect("HEAD should resolve"),
        head
    );
}

#[test]
fn prepare_resolves_the_library_gitlink_and_reuses_an_immutable_checkout() {
    let fixture = SourceFixture::new("source-prepare", false);
    let first = fixture.run();
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    let report: Value =
        serde_json::from_slice(&first.stdout).expect("source report should be JSON");
    assert_eq!(report["target"]["key"], "Fixture/Gain");
    assert_eq!(report["source"]["commit"], fixture.commit);
    assert_eq!(
        report["source"]["repository"],
        "https://github.com/example/Fixture.git"
    );
    assert_eq!(report["source"]["temporary"], false);
    let checkout = fixture.cache.join("Fixture").join(&fixture.commit);
    assert_eq!(git(&checkout, &["rev-parse", "HEAD"]), fixture.commit);

    let second = fixture.run();
    assert!(
        second.status.success(),
        "{}",
        String::from_utf8_lossy(&second.stderr)
    );
    let repeated: Value =
        serde_json::from_slice(&second.stdout).expect("source report should be JSON");
    assert_eq!(
        repeated["source"]["directory"],
        report["source"]["directory"]
    );
}

#[test]
fn prepare_recovers_a_matching_interrupted_staging_checkout() {
    let fixture = SourceFixture::new("source-recovery", false);
    let first = fixture.run();
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    let checkout = fixture.cache.join("Fixture").join(&fixture.commit);
    let staging = fixture
        .cache
        .join("Fixture")
        .join(format!("{}.building-interrupted", fixture.commit));
    fs::rename(&checkout, &staging).expect("checkout should become interrupted staging");
    let resumed = fixture.run();
    assert!(
        resumed.status.success(),
        "{}",
        String::from_utf8_lossy(&resumed.stderr)
    );
    assert!(checkout.join("plugin.json").exists());
    assert!(String::from_utf8_lossy(&resumed.stderr).contains("Resuming locked checkout"));
}

#[test]
fn prepare_rejects_submodule_paths_that_escape_the_locked_checkout() {
    let fixture = SourceFixture::new("source-submodule-escape", true);
    let output = fixture.run();
    assert!(!output.status.success());
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("Unsafe submodule path ../escape"),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!fixture.cache.parent().unwrap().join("escape").exists());
}

#[test]
fn prepare_checks_out_the_exact_nested_gitlink_revision() {
    let mut fixture = SourceFixture::new("source-nested-gitlink", false);
    let dependency = fixture._temporary.path().join("dependency");
    initialize_repository(&dependency);
    fs::write(dependency.join("marker.hpp"), "#pragma once\n")
        .expect("dependency marker should be written");
    let dependency_commit = commit_all(&dependency, "dependency fixture");
    fs::write(
        fixture.source.join(".gitmodules"),
        "[submodule \"libs/Dependency\"]\n\tpath = libs/Dependency\n\turl = https://github.com/example/Dependency.git\n",
    )
    .expect("submodule declaration should be written");
    git(&fixture.source, &["add", ".gitmodules"]);
    git(
        &fixture.source,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            &format!("160000,{dependency_commit},libs/Dependency"),
        ],
    );
    git(
        &fixture.source,
        &["commit", "--quiet", "-m", "Lock dependency"],
    );
    fixture.commit = git(&fixture.source, &["rev-parse", "HEAD"]);
    fixture.update_library_gitlink();
    fixture.rewrites.push((
        format!(
            "file://{}",
            dependency
                .to_str()
                .expect("dependency path should be UTF-8")
        ),
        "https://github.com/example/Dependency.git".to_owned(),
    ));

    let output = fixture.run();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let nested = fixture
        .cache
        .join("Fixture")
        .join(&fixture.commit)
        .join("libs/Dependency");
    assert_eq!(git(&nested, &["rev-parse", "HEAD"]), dependency_commit);
    assert_eq!(
        fs::read_to_string(nested.join("marker.hpp")).expect("marker should exist"),
        "#pragma once\n"
    );
}

#[test]
fn dependency_checkout_command_publishes_only_the_requested_commit() {
    let fixture = SourceFixture::new("source-dependency-command", false);
    let target = fixture._temporary.path().join("dependency-checkout");
    let output = fixture
        .command()
        .args([
            "source",
            "checkout",
            "--repository",
            "https://github.com/example/Fixture.git",
            "--commit",
            &fixture.commit,
            "--target",
            target.to_str().expect("target path should be UTF-8"),
            "--format",
            "json",
        ])
        .output()
        .expect("dependency checkout should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&output.stdout).expect("checkout report should be JSON");
    assert_eq!(report["commit"], fixture.commit);
    assert_eq!(git(&target, &["rev-parse", "HEAD"]), fixture.commit);
    assert!(target.join("plugin.json").exists());
}
