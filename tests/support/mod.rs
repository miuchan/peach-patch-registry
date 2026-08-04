use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct TemporaryDirectory(tempfile::TempDir);

impl TemporaryDirectory {
    pub fn new(label: &str) -> Self {
        Self(
            tempfile::Builder::new()
                .prefix(&format!("peach-registry-{label}-"))
                .tempdir()
                .expect("temporary directory should be created"),
        )
    }

    pub fn path(&self) -> &Path {
        self.0.path()
    }
}

#[allow(dead_code)]
pub fn copy_tree(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).expect("fixture destination should be created");
    for entry in fs::read_dir(source).expect("fixture directory should be readable") {
        let entry = entry.expect("fixture entry should be readable");
        let target = destination.join(entry.file_name());
        if entry
            .file_type()
            .expect("fixture type should be readable")
            .is_dir()
        {
            copy_tree(&entry.path(), &target);
        } else {
            fs::copy(entry.path(), target).expect("fixture file should be copied");
        }
    }
}

#[allow(dead_code)]
pub fn compile_rust_fixture(source: &Path, output_directory: &Path, name: &str) -> PathBuf {
    fs::create_dir_all(output_directory).expect("fixture output directory should be created");
    let binary = output_directory.join(if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_owned()
    });
    let rustc = std::env::var_os("RUSTC").unwrap_or_else(|| "rustc".into());
    let output = Command::new(rustc)
        .arg("--edition=2021")
        .arg(source)
        .arg("-o")
        .arg(&binary)
        .output()
        .expect("Rust fixture compiler should run");
    assert!(
        output.status.success(),
        "Rust fixture should compile: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    binary
}
