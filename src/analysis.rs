use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::abi::{evaluate_static_string, numeric_expression};

const DEVELOPMENT_DIRECTORIES: [&str; 15] = [
    ".git",
    "bench",
    "benchmark",
    "build",
    "cmdline",
    "dist",
    "doc",
    "docs",
    "dep",
    "deps",
    "examples",
    "node_modules",
    "test",
    "tests",
    "unittest",
];

const DEPENDENCY_EXCLUDED_DIRECTORIES: [&str; 11] = [
    ".git",
    "build",
    "dist",
    "dep",
    "deps",
    "node_modules",
    "third_party",
    "CMSIS",
    "test",
    "tests",
    "examples",
];

const CONFIG_CALL_NAMES: [&str; 13] = [
    "config",
    "venomConfig",
    "configParam",
    "configParamNoRand",
    "configSwitch",
    "configButton",
    "configInput",
    "configOutput",
    "configBypass",
    "configOnOff",
    "configOnOffNoRand",
    "configMenuParam",
    "rackWebSnapParam",
];

const MAX_PREPROCESS_SOURCE_BYTES: usize = 64 * 1024 * 1024;
const MAX_PREPROCESS_DEFINITIONS: usize = 65_536;
const MAX_PREPROCESS_DEFINITION_BYTES: usize = 1024 * 1024;
const MAX_BUILD_METADATA_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceInventory {
    pub source_root: PathBuf,
    pub source_files: Vec<PathBuf>,
    pub repository_roots: Vec<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceIncludeInventory {
    pub source_root: PathBuf,
    pub includes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyFileInventory {
    pub source_root: PathBuf,
    pub profile: String,
    pub source_files: Vec<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MakefileAnalysisReport {
    pub source_root: PathBuf,
    pub makefile: Option<PathBuf>,
    pub source_variables: Vec<String>,
    pub compile_definitions: Vec<String>,
    pub all_compile_definitions: Vec<String>,
    pub include_directories: Vec<PathBuf>,
    pub implementation_sources: Vec<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CmakeAnalysisReport {
    pub source_root: PathBuf,
    pub cmake_lists: Option<PathBuf>,
    pub compile_definitions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumericConstantRequest {
    pub source: String,
    #[serde(default)]
    pub initial: BTreeMap<String, Value>,
    #[serde(default)]
    pub owner: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NumericConstantReport {
    pub constants: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreprocessRequest {
    pub source: String,
    #[serde(default)]
    pub initial_definitions: BTreeMap<String, String>,
    #[serde(default = "default_expand_object_macros")]
    pub expand_object_macros: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreprocessReport {
    pub source: String,
    pub definitions: BTreeMap<String, String>,
    pub include_directives: Vec<SourceIncludeDirectiveCandidate>,
}

const fn default_expand_object_macros() -> bool {
    true
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDeclarationRequest {
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDeclarationReport {
    pub include_directives: Vec<SourceIncludeDirectiveCandidate>,
    pub preprocessor_directives: Vec<SourcePreprocessorDirectiveCandidate>,
    pub macro_definitions: Vec<SourceMacroDefinitionCandidate>,
    pub conditional_directives: Vec<SourceConditionalDirectiveCandidate>,
    pub conditional_blocks: Vec<SourceConditionalBlockCandidate>,
    pub header_guards: Vec<SourceHeaderGuardCandidate>,
    pub type_declarations: Vec<SourceTypeDeclarationCandidate>,
    pub anonymous_typedef_declarations: Vec<SourceAnonymousTypedefDeclarationCandidate>,
    pub type_aliases: Vec<SourceTypeAliasCandidate>,
    pub enum_declarations: Vec<SourceEnumDeclarationCandidate>,
    pub namespace_constant_declarations: Vec<SourceNamespaceConstantDeclarationCandidate>,
    pub namespace_variable_declarations: Vec<SourceNamespaceVariableDeclarationCandidate>,
    pub namespace_using_declarations: Vec<SourceNamespaceUsingDeclarationCandidate>,
    pub namespace_using_directives: Vec<SourceNamespaceUsingDirectiveCandidate>,
    pub config_calls: Vec<SourceConfigCallCandidate>,
    pub inline_member_definitions: Vec<SourceInlineMemberDefinitionCandidate>,
    pub out_of_line_definitions: Vec<SourceOutOfLineDefinitionCandidate>,
    pub free_function_declarations: Vec<SourceFreeFunctionDeclarationCandidate>,
    pub free_function_definitions: Vec<SourceFreeFunctionDefinitionCandidate>,
    pub repeated_default_argument_ranges: Vec<SourceTextRangeCandidate>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTextRangeCandidate {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceIncludeDirectiveCandidate {
    pub start: usize,
    pub include: String,
    pub angle: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourcePreprocessorDirectiveCandidate {
    pub start: usize,
    pub end: usize,
    pub kind: String,
    pub commented: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMacroDefinitionCandidate {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub function_like: bool,
    pub parameters: Vec<String>,
    pub replacement: String,
    pub commented: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceConditionalDirectiveCandidate {
    pub start: usize,
    pub end: usize,
    pub kind: String,
    pub expression: String,
    pub simple_macro: Option<String>,
    pub negated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceConditionalBlockCandidate {
    pub open_start: usize,
    pub open_end: usize,
    pub close_start: Option<usize>,
    pub close_end: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceHeaderGuardCandidate {
    pub name: String,
    pub open_start: usize,
    pub open_end: usize,
    pub define_start: usize,
    pub define_end: usize,
    pub close_start: Option<usize>,
    pub close_end: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTypeDeclarationCandidate {
    pub start: usize,
    pub declaration_start: usize,
    pub declaration_end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub name: String,
    pub kind: String,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
    pub template_source: Option<String>,
    pub template_parameters: Vec<String>,
    pub bases: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceAnonymousTypedefDeclarationCandidate {
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub name_start: usize,
    pub name: String,
    pub kind: String,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTypeAliasCandidate {
    pub start: usize,
    pub declaration_start: usize,
    pub declaration_end: usize,
    pub name: String,
    pub target: String,
    pub kind: String,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceEnumDeclarationCandidate {
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub name: Option<String>,
    pub scoped: bool,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
    pub raw: String,
    pub identifiers: Vec<EnumIdentifierCandidate>,
    pub assignments: BTreeMap<String, String>,
    pub complete: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceNamespaceConstantDeclarationCandidate {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceNamespaceVariableDeclarationCandidate {
    pub start: usize,
    pub end: usize,
    pub name_start: usize,
    pub declarator_end: usize,
    pub name: String,
    pub namespace: Vec<String>,
    pub type_source: String,
    pub array_extent: String,
    pub c_linkage: bool,
    pub initialized: bool,
    pub extern_declaration: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceNamespaceUsingDeclarationCandidate {
    pub start: usize,
    pub end: usize,
    pub target: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceNamespaceUsingDirectiveCandidate {
    pub start: usize,
    pub end: usize,
    pub target: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceInlineMemberDefinitionCandidate {
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub owner: String,
    pub owner_chain: Vec<String>,
    pub namespace: Vec<String>,
    pub member: String,
    pub callable_kind: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceConfigCallCandidate {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub template_source: Option<String>,
    pub arguments_source: String,
    pub arguments: Vec<String>,
    pub namespace: Vec<String>,
    pub owners: Vec<TypeOwnerCandidate>,
    pub loops: Vec<ConfigLoopCandidate>,
    pub string_bindings: Vec<ConfigStringBindingCandidate>,
    pub synthetic: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFreeFunctionDefinitionCandidate {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub namespace: Vec<String>,
    pub signature: String,
    pub declaration_signature: String,
    pub references: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFreeFunctionDeclarationCandidate {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceOutOfLineDefinitionCandidate {
    pub start: usize,
    pub end: usize,
    pub body_start: Option<usize>,
    pub body_end: Option<usize>,
    pub owner: String,
    pub owner_chain: Vec<String>,
    pub kind: String,
    pub namespace: Vec<String>,
    pub member: Option<String>,
    pub callable_kind: Option<String>,
    pub signature: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelFactoryCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub factory: String,
    pub template_source: String,
    pub call_source: String,
    pub template_arguments: Vec<String>,
    pub call_arguments: Vec<String>,
    pub namespace: Vec<String>,
    pub registered_module_type: Option<String>,
    pub widget_namespace: Vec<String>,
    pub context_files: Vec<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomModelFactoryCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub variable_slug: String,
    pub slug_source: Option<String>,
    pub model_type: String,
    pub module_type: String,
    pub widget_class: Option<String>,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaModuleFactoryCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub variable_slug: String,
    pub template_source: String,
    pub template_arguments: Vec<String>,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCandidateReport {
    pub source_root: PathBuf,
    pub candidates: Vec<ModelFactoryCandidate>,
    pub custom_model_candidates: Vec<CustomModelFactoryCandidate>,
    pub meta_module_candidates: Vec<MetaModuleFactoryCandidate>,
    pub string_constants: Vec<StringConstantCandidate>,
    pub type_aliases: Vec<TypeAliasCandidate>,
    pub type_declarations: Vec<TypeDeclarationCandidate>,
    pub anonymous_typedef_declarations: Vec<AnonymousTypedefDeclarationCandidate>,
    pub enum_declarations: Vec<EnumDeclarationCandidate>,
    pub namespace_constant_declarations: Vec<NamespaceConstantDeclarationCandidate>,
    pub namespace_variable_declarations: Vec<NamespaceVariableDeclarationCandidate>,
    pub namespace_using_declarations: Vec<NamespaceUsingDeclarationCandidate>,
    pub namespace_using_directives: Vec<NamespaceUsingDirectiveCandidate>,
    pub config_calls: Vec<ConfigCallCandidate>,
    pub out_of_line_definitions: Vec<OutOfLineDefinitionCandidate>,
    pub free_function_declarations: Vec<FreeFunctionDeclarationCandidate>,
    pub free_function_definitions: Vec<FreeFunctionDefinitionCandidate>,
    pub include_directives: Vec<IncludeDirectiveCandidate>,
    pub companion_implementations: Vec<CompanionImplementationCandidate>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigCallCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub template_source: Option<String>,
    pub arguments_source: String,
    pub arguments: Vec<String>,
    pub namespace: Vec<String>,
    pub owners: Vec<TypeOwnerCandidate>,
    pub loops: Vec<ConfigLoopCandidate>,
    pub string_bindings: Vec<ConfigStringBindingCandidate>,
    pub synthetic: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigLoopCandidate {
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub variable: String,
    pub start_expression: String,
    pub end_expression: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigStringBindingCandidate {
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub expression: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum EnumIdentifierCandidate {
    Name(String),
    Repeated { base: String, count: String },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub name: Option<String>,
    pub scoped: bool,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
    pub raw: String,
    pub identifiers: Vec<EnumIdentifierCandidate>,
    pub assignments: BTreeMap<String, String>,
    pub complete: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StringConstantCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub name: String,
    pub expression: String,
    pub value: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeAliasCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub declaration_start: usize,
    pub declaration_end: usize,
    pub name: String,
    pub target: String,
    pub kind: String,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeOwnerCandidate {
    pub name: String,
    pub template_parameters: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub declaration_start: usize,
    pub declaration_end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub name: String,
    pub kind: String,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
    pub template_source: Option<String>,
    pub template_parameters: Vec<String>,
    pub bases: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnonymousTypedefDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub name_start: usize,
    pub name: String,
    pub kind: String,
    pub namespace: Vec<String>,
    pub namespace_scope: bool,
    pub owners: Vec<TypeOwnerCandidate>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutOfLineDefinitionCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub body_start: Option<usize>,
    pub body_end: Option<usize>,
    pub owner: String,
    pub owner_chain: Vec<String>,
    pub kind: String,
    pub namespace: Vec<String>,
    pub member: Option<String>,
    pub callable_kind: Option<String>,
    pub signature: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeFunctionDefinitionCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub namespace: Vec<String>,
    pub signature: String,
    pub declaration_signature: String,
    pub references: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeFunctionDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceConstantDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub name: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceVariableDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub name_start: usize,
    pub declarator_end: usize,
    pub name: String,
    pub namespace: Vec<String>,
    pub type_source: String,
    pub array_extent: String,
    pub c_linkage: bool,
    pub initialized: bool,
    pub extern_declaration: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceUsingDeclarationCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub target: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceUsingDirectiveCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub end: usize,
    pub target: String,
    pub namespace: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncludeDirectiveCandidate {
    pub file: PathBuf,
    pub start: usize,
    pub include: String,
    pub angle: bool,
    pub target: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionImplementationCandidate {
    pub header: PathBuf,
    pub targets: Vec<PathBuf>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyClosureReport {
    pub source_root: PathBuf,
    pub roots: Vec<PathBuf>,
    pub files: Vec<PathBuf>,
    pub pruned_files: Vec<PathBuf>,
}

struct ParsedTypeDeclaration {
    start: usize,
    declaration_start: usize,
    owner: TypeOwnerCandidate,
    kind: String,
    template_source: Option<String>,
    bases: Vec<String>,
}

fn is_source_file(path: &Path) -> bool {
    path.file_name().and_then(|name| name.to_str()) != Some("miniaudio.h")
        && matches!(
            path.extension().and_then(|extension| extension.to_str()),
            Some("c" | "cc" | "cpp" | "cxx" | "h" | "hh" | "hpp" | "inl")
        )
}

fn source_files(root: &Path, current: &Path, found: &mut Vec<PathBuf>) -> Result<(), String> {
    if current != root && current.join(".git").exists() {
        return Ok(());
    }
    for entry in fs::read_dir(current).map_err(|error| {
        format!(
            "Cannot read source directory {}: {error}",
            current.display()
        )
    })? {
        let entry = entry
            .map_err(|error| format!("Cannot read an entry in {}: {error}", current.display()))?;
        let name = entry.file_name();
        let name = name
            .to_str()
            .ok_or_else(|| format!("Source path is not UTF-8: {}", entry.path().display()))?;
        if DEVELOPMENT_DIRECTORIES.contains(&name) {
            continue;
        }
        let kind = entry
            .file_type()
            .map_err(|error| format!("Cannot inspect {}: {error}", entry.path().display()))?;
        if kind.is_dir() {
            source_files(root, &entry.path(), found)?;
        } else if is_source_file(&entry.path()) {
            found.push(entry.path());
        }
    }
    Ok(())
}

fn submodule_paths(modules_file: &Path) -> Result<Vec<String>, String> {
    let contents = fs::read_to_string(modules_file)
        .map_err(|error| format!("Cannot read {}: {error}", modules_file.display()))?;
    let mut paths = Vec::new();
    let mut in_submodule = false;
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[submodule \"") && trimmed.ends_with("\"]") {
            in_submodule = true;
        } else if trimmed.starts_with('[') {
            in_submodule = false;
        } else if in_submodule {
            if let Some((key, value)) = trimmed.split_once('=') {
                if key.trim() == "path" {
                    paths.push(value.trim().to_owned());
                }
            }
        }
    }
    Ok(paths)
}

fn safe_relative_path(value: &str) -> bool {
    let path = Path::new(value);
    !value.is_empty()
        && !value.contains('\\')
        && !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn nested_repository_roots(
    root: &Path,
    current: &Path,
    found: &mut Vec<PathBuf>,
) -> Result<(), String> {
    let modules_file = current.join(".gitmodules");
    if !modules_file.exists() {
        return Ok(());
    }
    for relative in submodule_paths(&modules_file)? {
        if !safe_relative_path(&relative) {
            return Err(format!("Unsafe submodule path {relative}"));
        }
        let target = current.join(&relative);
        if !target.starts_with(root) {
            return Err(format!(
                "Submodule path escapes its source checkout: {relative}"
            ));
        }
        if target.file_name().and_then(|name| name.to_str()) == Some("metamodule-plugin-sdk") {
            continue;
        }
        if target.join(".git").exists() {
            found.push(target.clone());
            nested_repository_roots(root, &target, found)?;
        }
    }
    Ok(())
}

pub fn inventory(source_root: &Path) -> Result<SourceInventory, String> {
    let source_root = fs::canonicalize(source_root).map_err(|error| {
        format!(
            "Cannot resolve source directory {}: {error}",
            source_root.display()
        )
    })?;
    if !source_root.is_dir() {
        return Err(format!(
            "Source path is not a directory: {}",
            source_root.display()
        ));
    }
    let mut files = Vec::new();
    source_files(&source_root, &source_root, &mut files)?;
    let mut repository_roots = vec![source_root.clone()];
    nested_repository_roots(&source_root, &source_root, &mut repository_roots)?;
    Ok(SourceInventory {
        source_root,
        source_files: files,
        repository_roots,
    })
}

fn push_unique<T: PartialEq>(values: &mut Vec<T>, value: T) {
    if !values.contains(&value) {
        values.push(value);
    }
}

fn canonical_makefile_entry(
    source_root: &Path,
    resolution_root: &Path,
    token: &str,
    directory: bool,
) -> Option<PathBuf> {
    if token.is_empty() || token.contains('$') {
        return None;
    }
    let token_path = Path::new(token);
    let candidate = if token_path.is_absolute() {
        token_path.to_owned()
    } else {
        resolution_root.join(token_path)
    };
    let resolved = fs::canonicalize(candidate).ok()?;
    (resolved.starts_with(source_root)
        && if directory {
            resolved.is_dir()
        } else {
            resolved.is_file()
        })
    .then_some(resolved)
}

pub fn makefile_analysis(source_root: &Path) -> Result<MakefileAnalysisReport, String> {
    makefile_analysis_for(source_root, Path::new("Makefile"), &["SOURCES".to_owned()])
}

pub fn makefile_analysis_for(
    source_root: &Path,
    makefile_path: &Path,
    source_variables: &[String],
) -> Result<MakefileAnalysisReport, String> {
    let source_root = fs::canonicalize(source_root).map_err(|error| {
        format!(
            "Cannot resolve source directory {}: {error}",
            source_root.display()
        )
    })?;
    if !source_root.is_dir() {
        return Err(format!(
            "Source path is not a directory: {}",
            source_root.display()
        ));
    }
    let makefile_value = makefile_path
        .to_str()
        .ok_or_else(|| "Makefile path must be UTF-8".to_owned())?;
    if !safe_relative_path(makefile_value) {
        return Err(format!("Unsafe Makefile path: {makefile_value}"));
    }
    if source_variables.is_empty()
        || source_variables.len() > 64
        || source_variables.iter().any(|name| {
            name.is_empty()
                || name.len() > 128
                || !name.bytes().enumerate().all(|(index, byte)| {
                    byte == b'_'
                        || byte.is_ascii_alphabetic()
                        || (index > 0 && byte.is_ascii_digit())
                })
        })
    {
        return Err("Makefile source variables are invalid".to_owned());
    }
    let mut unique_source_variables = Vec::new();
    for name in source_variables {
        push_unique(&mut unique_source_variables, name.clone());
    }
    let source_variables = unique_source_variables;
    let requested_makefile = source_root.join(makefile_path);
    if !requested_makefile.exists() {
        return Ok(MakefileAnalysisReport {
            source_root,
            makefile: None,
            source_variables,
            compile_definitions: Vec::new(),
            all_compile_definitions: Vec::new(),
            include_directories: Vec::new(),
            implementation_sources: Vec::new(),
        });
    }
    let makefile = fs::canonicalize(&requested_makefile).map_err(|error| {
        format!(
            "Cannot resolve Makefile {}: {error}",
            requested_makefile.display()
        )
    })?;
    if !makefile.starts_with(&source_root) || !makefile.is_file() {
        return Err(format!(
            "Makefile escapes its source checkout: {}",
            makefile.display()
        ));
    }
    let source = fs::read_to_string(&makefile)
        .map_err(|error| format!("Cannot read Makefile {}: {error}", makefile.display()))?;
    if source.len() > MAX_BUILD_METADATA_BYTES || source.contains('\0') {
        return Err(format!("Makefile is invalid: {}", makefile.display()));
    }
    let source = source.replace("\\\r\n", " ").replace("\\\n", " ");
    let resolution_root = makefile
        .parent()
        .ok_or_else(|| "Makefile has no parent directory".to_owned())?;
    let conditional_open = Regex::new(r"^\s*(?:ifdef|ifndef|ifeq|ifneq)\b")
        .map_err(|error| format!("Could not compile Makefile condition analysis: {error}"))?;
    let conditional_close = Regex::new(r"^\s*endif\b")
        .map_err(|error| format!("Could not compile Makefile condition analysis: {error}"))?;
    let definition_pattern =
        Regex::new(r"(?:^|\s)-D(?P<name>[A-Za-z_]\w*)(?:=(?P<value>[^\s#]+))?")
            .map_err(|error| format!("Could not compile Makefile definition analysis: {error}"))?;
    let include_pattern = Regex::new(
        r#"(?:^|\s)-I(?:\"(?P<double>[^\"]+)\"|'(?P<single>[^']+)'|(?P<plain>[^\s#]+))"#,
    )
    .map_err(|error| format!("Could not compile Makefile include analysis: {error}"))?;
    let variable_assignment =
        Regex::new(r"^\s*(?P<name>[A-Za-z_]\w*)\s*(?::|\?)?=\s*(?P<value>[^#]*)")
            .map_err(|error| format!("Could not compile Makefile variable analysis: {error}"))?;
    let source_names = source_variables
        .iter()
        .map(|name| regex::escape(name))
        .collect::<Vec<_>>()
        .join("|");
    let source_assignment = Regex::new(&format!(
        r"^\s*(?:{source_names})\s*\+?=\s*(?P<value>[^#]*)"
    ))
    .map_err(|error| format!("Could not compile Makefile source analysis: {error}"))?;
    let variable_reference = Regex::new(r"\$\((?P<name>[A-Za-z_]\w*)\)")
        .map_err(|error| format!("Could not compile Makefile expansion analysis: {error}"))?;
    let definition_values = |line: &str| {
        definition_pattern
            .captures_iter(line)
            .filter_map(|captures| {
                let name = captures.name("name")?.as_str();
                Some(captures.name("value").map_or_else(
                    || format!("-D{name}"),
                    |value| format!("-D{name}={}", value.as_str()),
                ))
            })
            .collect::<Vec<_>>()
    };
    let mut compile_definitions = Vec::new();
    let mut all_compile_definitions = Vec::new();
    let mut conditional_depth = 0usize;
    for line in source.lines() {
        for definition in definition_values(line) {
            push_unique(&mut all_compile_definitions, definition);
        }
        if conditional_open.is_match(line) {
            conditional_depth += 1;
            continue;
        }
        if conditional_close.is_match(line) {
            conditional_depth = conditional_depth.saturating_sub(1);
            continue;
        }
        if conditional_depth == 0 {
            for definition in definition_values(line) {
                push_unique(&mut compile_definitions, definition);
            }
        }
    }
    let mut include_directories = Vec::new();
    for captures in include_pattern.captures_iter(&source) {
        let token = captures
            .name("double")
            .or_else(|| captures.name("single"))
            .or_else(|| captures.name("plain"))
            .map(|value| value.as_str());
        if let Some(directory) = token
            .and_then(|value| canonical_makefile_entry(&source_root, resolution_root, value, true))
        {
            push_unique(&mut include_directories, directory);
        }
    }
    let mut variables = HashMap::new();
    for line in source.lines() {
        if let Some(captures) = variable_assignment.captures(line) {
            if let (Some(name), Some(value)) = (captures.name("name"), captures.name("value")) {
                variables.insert(name.as_str().to_owned(), value.as_str().trim().to_owned());
            }
        }
    }
    let expand = |value: &str| {
        let mut result = value.to_owned();
        for _ in 0..8 {
            let next = variable_reference
                .replace_all(&result, |captures: &regex::Captures<'_>| {
                    captures
                        .name("name")
                        .and_then(|name| variables.get(name.as_str()))
                        .cloned()
                        .unwrap_or_else(|| captures[0].to_owned())
                })
                .into_owned();
            if next == result {
                break;
            }
            result = next;
        }
        result
    };
    let mut implementation_sources = Vec::new();
    for line in source.lines() {
        let Some(value) = source_assignment
            .captures(line)
            .and_then(|captures| captures.name("value").map(|value| value.as_str()))
        else {
            continue;
        };
        for token in expand(value).split_whitespace() {
            let extension = Path::new(token)
                .extension()
                .and_then(|value| value.to_str());
            if !matches!(extension, Some("c" | "cc" | "cpp" | "cxx")) {
                continue;
            }
            if let Some(file) =
                canonical_makefile_entry(&source_root, resolution_root, token, false)
            {
                push_unique(&mut implementation_sources, file);
            }
        }
    }
    Ok(MakefileAnalysisReport {
        source_root,
        makefile: Some(makefile),
        source_variables,
        compile_definitions,
        all_compile_definitions,
        include_directories,
        implementation_sources,
    })
}

pub fn cmake_analysis(source_root: &Path) -> Result<CmakeAnalysisReport, String> {
    let source_root = fs::canonicalize(source_root).map_err(|error| {
        format!(
            "Cannot resolve source directory {}: {error}",
            source_root.display()
        )
    })?;
    if !source_root.is_dir() {
        return Err(format!(
            "Source path is not a directory: {}",
            source_root.display()
        ));
    }
    let requested_cmake_lists = source_root.join("CMakeLists.txt");
    if !requested_cmake_lists.exists() {
        return Ok(CmakeAnalysisReport {
            source_root,
            cmake_lists: None,
            compile_definitions: Vec::new(),
        });
    }
    let cmake_lists = fs::canonicalize(&requested_cmake_lists).map_err(|error| {
        format!(
            "Cannot resolve CMake metadata {}: {error}",
            requested_cmake_lists.display()
        )
    })?;
    if !cmake_lists.starts_with(&source_root) || !cmake_lists.is_file() {
        return Err(format!(
            "CMake metadata escapes its source checkout: {}",
            cmake_lists.display()
        ));
    }
    let source = fs::read_to_string(&cmake_lists).map_err(|error| {
        format!(
            "Cannot read CMake metadata {}: {error}",
            cmake_lists.display()
        )
    })?;
    if source.len() > MAX_BUILD_METADATA_BYTES || source.contains('\0') {
        return Err(format!(
            "CMake metadata is invalid: {}",
            cmake_lists.display()
        ));
    }
    let cache_definition = Regex::new(
        r"\bset\s*\(\s*(?P<name>[A-Z][A-Z0-9_]+)\s+(?P<value>[0-9]+|TRUE|FALSE)\s+CACHE\s+(?:STRING|BOOL)\b",
    )
    .map_err(|error| format!("Could not compile CMake definition analysis: {error}"))?;
    let mut compile_definitions = Vec::new();
    for captures in cache_definition.captures_iter(&source) {
        let Some(name) = captures.name("name").map(|value| value.as_str()) else {
            continue;
        };
        let Some(value) = captures.name("value").map(|value| value.as_str()) else {
            continue;
        };
        let value = match value {
            "TRUE" => "1",
            "FALSE" => "0",
            value => value,
        };
        push_unique(&mut compile_definitions, format!("-D{name}={value}"));
    }
    Ok(CmakeAnalysisReport {
        source_root,
        cmake_lists: Some(cmake_lists),
        compile_definitions,
    })
}

pub fn source_include_inventory(source_root: &Path) -> Result<SourceIncludeInventory, String> {
    let inventory = inventory(source_root)?;
    let pattern = include_directive_pattern()?;
    let mut includes = BTreeSet::new();
    for file in &inventory.source_files {
        let source = fs::read_to_string(file)
            .map_err(|error| format!("Cannot read source file {}: {error}", file.display()))?;
        if source.len() > MAX_PREPROCESS_SOURCE_BYTES {
            return Err(format!("Source file is too large: {}", file.display()));
        }
        includes.extend(
            include_directives_in_source(&source, file, &pattern)
                .into_iter()
                .map(|candidate| candidate.include),
        );
    }
    Ok(SourceIncludeInventory {
        source_root: inventory.source_root,
        includes: includes.into_iter().collect(),
    })
}

fn filtered_source_files(
    current: &Path,
    profile: &str,
    found: &mut Vec<PathBuf>,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(|error| {
        format!(
            "Cannot read dependency directory {}: {error}",
            current.display()
        )
    })? {
        let entry = entry
            .map_err(|error| format!("Cannot read an entry in {}: {error}", current.display()))?;
        let name = entry.file_name();
        let name = name
            .to_str()
            .ok_or_else(|| format!("Dependency path is not UTF-8: {}", entry.path().display()))?;
        let kind = entry
            .file_type()
            .map_err(|error| format!("Cannot inspect {}: {error}", entry.path().display()))?;
        if kind.is_dir() {
            let excluded = match profile {
                "dependency" => {
                    DEPENDENCY_EXCLUDED_DIRECTORIES.contains(&name)
                        || name.contains(".building-")
                        || (name.starts_with("STM32") && name.ends_with("StdPeriph_Driver"))
                }
                "vendor" => matches!(name, ".git" | "build" | "dist" | "node_modules"),
                _ => false,
            };
            if excluded {
                continue;
            }
            filtered_source_files(&entry.path(), profile, found)?;
        } else {
            let extension = entry
                .path()
                .extension()
                .and_then(|extension| extension.to_str())
                .map(str::to_owned);
            let included = match profile {
                "dependency" => matches!(
                    extension.as_deref(),
                    Some("c" | "cc" | "cpp" | "cxx" | "h" | "hh" | "hpp" | "inl")
                ),
                "vendor" => matches!(
                    extension.as_deref(),
                    Some("c" | "cc" | "cpp" | "cxx" | "h" | "hh" | "hpp")
                ),
                _ => false,
            };
            if included {
                found.push(entry.path());
            }
        }
    }
    Ok(())
}

pub fn dependency_file_inventory(source_root: &Path) -> Result<DependencyFileInventory, String> {
    source_file_inventory(source_root, "dependency")
}

pub fn source_file_inventory(
    source_root: &Path,
    profile: &str,
) -> Result<DependencyFileInventory, String> {
    if !matches!(profile, "dependency" | "vendor") {
        return Err(format!("Unsupported source file profile: {profile}"));
    }
    let source_root = fs::canonicalize(source_root).map_err(|error| {
        format!(
            "Cannot resolve source directory {}: {error}",
            source_root.display()
        )
    })?;
    if !source_root.is_dir() {
        return Err(format!(
            "Source path is not a directory: {}",
            source_root.display()
        ));
    }
    let mut source_files = Vec::new();
    filtered_source_files(&source_root, profile, &mut source_files)?;
    source_files.sort();
    source_files.dedup();
    Ok(DependencyFileInventory {
        source_root,
        profile: profile.to_owned(),
        source_files,
    })
}

fn firmware_libc(source_root: &Path, file: &Path) -> bool {
    file.strip_prefix(source_root).is_ok_and(|relative| {
        relative.components().any(|component| {
            matches!(
                component,
                Component::Normal(name)
                    if name == "plugin-libc" || name == "metamodule-plugin-libc"
            )
        })
    })
}

fn canonical_dependency_candidate(source_root: &Path, candidate: &Path) -> Option<PathBuf> {
    let resolved = fs::canonicalize(candidate).ok()?;
    (resolved.starts_with(source_root)
        && resolved.is_file()
        && !firmware_libc(source_root, &resolved))
    .then_some(resolved)
}

fn include_rank(source_root: &Path, file: &Path) -> (usize, String) {
    let relative = file.strip_prefix(source_root).unwrap_or(file);
    let parts = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>();
    let source = parts.iter().position(|part| *part == "src").unwrap_or(40);
    let libraries = usize::from(parts.contains(&"libs")) * 80;
    (
        source + libraries + parts.len(),
        file.to_string_lossy().into_owned(),
    )
}

fn select_include_candidate(
    source_root: &Path,
    candidates: impl IntoIterator<Item = PathBuf>,
) -> Option<PathBuf> {
    let mut ranked = candidates
        .into_iter()
        .map(|file| (include_rank(source_root, &file), file))
        .collect::<Vec<_>>();
    ranked.sort_by(|left, right| left.0.cmp(&right.0));
    if ranked.len() == 1 {
        return Some(ranked.remove(0).1);
    }
    let best_score = ranked.first()?.0 .0;
    let next_score = ranked.get(1)?.0 .0;
    (best_score < next_score).then(|| ranked.remove(0).1)
}

fn resolve_include_targets(
    source_root: &Path,
    repository_roots: &[PathBuf],
    source_files: &[PathBuf],
    directives: &mut [IncludeDirectiveCandidate],
) {
    for directive in directives {
        let normalized = directive.include.replace('\\', "/");
        let include_path = Path::new(&normalized);
        let direct = directive
            .file
            .parent()
            .into_iter()
            .map(|directory| directory.join(include_path))
            .chain(repository_roots.iter().map(|root| root.join(include_path)))
            .chain(std::iter::once(source_root.join("src").join(include_path)))
            .find_map(|candidate| canonical_dependency_candidate(source_root, &candidate));
        if direct.is_some() {
            directive.target = direct;
            continue;
        }
        let matches = source_files
            .iter()
            .filter(|file| !firmware_libc(source_root, file) && file.ends_with(include_path))
            .cloned()
            .collect::<Vec<_>>();
        let importer_repository = repository_roots
            .iter()
            .filter(|root| directive.file.starts_with(root))
            .max_by_key(|root| root.components().count());
        let repository_matches = importer_repository
            .map(|root| {
                matches
                    .iter()
                    .filter(|file| file.starts_with(root))
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        directive.target = select_include_candidate(
            source_root,
            if repository_matches.is_empty() {
                matches
            } else {
                repository_matches
            },
        );
    }
}

fn initialized_global_names(source: &str, pattern: &Regex) -> HashSet<String> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            (is_code_position(source, matched.start()))
                .then(|| captures.get(1).map(|name| name.as_str().to_owned()))
                .flatten()
        })
        .collect()
}

fn duplicates_header_globals(
    header_source: &str,
    implementation: &Path,
    pattern: &Regex,
) -> Result<bool, String> {
    let header_names = initialized_global_names(header_source, pattern);
    if header_names.is_empty() {
        return Ok(false);
    }
    let implementation_source = fs::read_to_string(implementation).map_err(|error| {
        format!(
            "Cannot read companion implementation {}: {error}",
            implementation.display()
        )
    })?;
    let implementation_names = initialized_global_names(&implementation_source, pattern);
    Ok(header_names
        .iter()
        .any(|name| implementation_names.contains(name)))
}

fn companion_implementations(
    source_root: &Path,
    source_files: &[PathBuf],
    global_pattern: &Regex,
) -> Result<Vec<CompanionImplementationCandidate>, String> {
    let mut reports = Vec::new();
    for header in source_files.iter().filter(|file| {
        matches!(
            file.extension().and_then(|extension| extension.to_str()),
            Some("h" | "hh" | "hpp" | "inl")
        ) && file.file_name().and_then(|name| name.to_str()) != Some("plugin.hpp")
    }) {
        let header_source = fs::read_to_string(header)
            .map_err(|error| format!("Cannot read source file {}: {error}", header.display()))?;
        let mut targets = Vec::new();
        for extension in ["c", "cpp", "cc", "cxx"] {
            let local = header.with_extension(extension);
            let candidates = source_files
                .iter()
                .filter(|candidate| {
                    candidate.extension().and_then(|value| value.to_str()) == Some(extension)
                        && candidate.file_stem() == header.file_stem()
                        && !candidate
                            .strip_prefix(source_root)
                            .unwrap_or(candidate)
                            .components()
                            .any(|component| {
                                matches!(
                                    component,
                                    Component::Normal(name)
                                        if matches!(name.to_str(), Some("sample" | "samples" | "test" | "tests" | "example" | "examples"))
                                )
                            })
                })
                .cloned()
                .collect::<Vec<_>>();
            let implementation = if local.is_file() {
                Some(local)
            } else if candidates.len() == 1 {
                candidates.into_iter().next()
            } else {
                None
            };
            if let Some(implementation) = implementation {
                if !duplicates_header_globals(&header_source, &implementation, global_pattern)? {
                    targets.push(implementation);
                }
            }
        }
        reports.push(CompanionImplementationCandidate {
            header: header.clone(),
            targets,
        });
    }
    Ok(reports)
}

fn raw_string_end(source: &str, start: usize) -> Option<usize> {
    let tail = &source.as_bytes()[start..];
    let prefix = [b"u8R\"".as_slice(), b"uR\"", b"UR\"", b"LR\"", b"R\""]
        .into_iter()
        .find(|prefix| tail.starts_with(prefix))?;
    let delimiter_start = start + prefix.len();
    let open = source.as_bytes()[delimiter_start..]
        .iter()
        .position(|byte| *byte == b'(')?
        + delimiter_start;
    if open - delimiter_start > 16 {
        return None;
    }
    let delimiter = &source[delimiter_start..open];
    if delimiter
        .bytes()
        .any(|byte| byte.is_ascii_whitespace() || matches!(byte, b'\\' | b')'))
    {
        return None;
    }
    let terminator = format!("){delimiter}\"");
    source[open + 1..]
        .find(&terminator)
        .map(|offset| open + 1 + offset + terminator.len())
}

fn skip_quoted(source: &str, start: usize, quote: u8) -> usize {
    let bytes = source.as_bytes();
    let mut index = start + 1;
    while index < bytes.len() {
        if bytes[index] == b'\\' {
            index = (index + 2).min(bytes.len());
        } else if bytes[index] == quote {
            return index + 1;
        } else {
            index += 1;
        }
    }
    bytes.len()
}

fn skipped_non_code(source: &str, index: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    if let Some(end) = raw_string_end(source, index) {
        return Some(end);
    }
    if bytes.get(index) == Some(&b'/') && bytes.get(index + 1) == Some(&b'/') {
        return Some(
            source[index + 2..]
                .find('\n')
                .map_or(bytes.len(), |offset| index + 2 + offset + 1),
        );
    }
    if bytes.get(index) == Some(&b'/') && bytes.get(index + 1) == Some(&b'*') {
        return Some(
            source[index + 2..]
                .find("*/")
                .map_or(bytes.len(), |offset| index + 2 + offset + 2),
        );
    }
    matches!(bytes.get(index), Some(b'\'' | b'"')).then(|| skip_quoted(source, index, bytes[index]))
}

fn include_directives_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<IncludeDirectiveCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let directive = captures.get(0)?;
            if !is_code_position(source, directive.start()) {
                return None;
            }
            let (include, angle) = captures
                .name("angle")
                .map(|include| (include, true))
                .or_else(|| captures.name("quoted").map(|include| (include, false)))?;
            Some(IncludeDirectiveCandidate {
                file: file.to_owned(),
                start: source[..include.start()].encode_utf16().count(),
                include: include.as_str().to_owned(),
                angle,
                target: None,
            })
        })
        .collect()
}

fn include_directive_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?m)^[\t ]*#[\t ]*include[\t ]*(?:<(?P<angle>[^>\r\n]+)>|\"(?P<quoted>[^\"\r\n]+)\")"#,
    )
    .map_err(|error| format!("Could not compile include-directive analysis: {error}"))
}

fn source_preprocessor_directive_pattern() -> Result<Regex, String> {
    Regex::new(r"(?m)^\s*(?P<commented>//\s*)?#(?P<kind>include|pragma|define)\b.*$")
        .map_err(|error| format!("Could not compile preprocessor-directive analysis: {error}"))
}

fn source_preprocessor_directives(
    source: &str,
    pattern: &Regex,
) -> Vec<SourcePreprocessorDirectiveCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let directive = captures.get(0)?;
            let kind = captures.name("kind")?.as_str().to_owned();
            Some(SourcePreprocessorDirectiveCandidate {
                start: source[..directive.start()].encode_utf16().count(),
                end: source[..directive.end()].encode_utf16().count(),
                kind,
                commented: captures.name("commented").is_some(),
            })
        })
        .collect()
}

fn source_macro_definition_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?m)^[\t ]*(?P<commented>//[\t ]*)?#[\t ]*define[\t ]+(?P<name>[A-Za-z_]\w*)[^\r\n]*"#,
    )
    .map_err(|error| format!("Could not compile macro-definition analysis: {error}"))
}

fn macro_continuation_pattern() -> Result<Regex, String> {
    Regex::new(r#"[\t ]*\\[\t ]*\r?\n[\t ]*"#)
        .map_err(|error| format!("Could not compile macro-continuation analysis: {error}"))
}

fn source_macro_definitions(
    source: &str,
    pattern: &Regex,
    continuation_pattern: &Regex,
) -> Vec<SourceMacroDefinitionCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let definition = captures.get(0)?;
            if !is_code_position(source, definition.start()) {
                return None;
            }
            let name_match = captures.name("name")?;
            let name = name_match.as_str().to_owned();
            let mut end = definition.end();
            let mut line_start = definition.start();
            while source[line_start..end].trim_end().ends_with('\\') {
                let next_start = if source[end..].starts_with("\r\n") {
                    end + 2
                } else if source[end..].starts_with('\n') {
                    end + 1
                } else {
                    break;
                };
                line_start = next_start;
                end = source[next_start..]
                    .bytes()
                    .position(|byte| matches!(byte, b'\r' | b'\n'))
                    .map_or(source.len(), |offset| next_start + offset);
            }
            let tail = &source[name_match.end()..end];
            let trimmed = tail.trim_start();
            let (function_like, parameters, replacement) = if let Some(arguments) =
                trimmed.strip_prefix('(').and_then(|value| {
                    value
                        .find(')')
                        .map(|end| (&value[..end], &value[end + 1..]))
                }) {
                let parameters = if arguments.0.trim().is_empty() {
                    Vec::new()
                } else {
                    top_level_parts(arguments.0, b',')
                        .into_iter()
                        .map(str::trim)
                        .map(str::to_owned)
                        .collect()
                };
                (true, parameters, arguments.1)
            } else {
                (false, Vec::new(), tail)
            };
            Some(SourceMacroDefinitionCandidate {
                start: source[..definition.start()].encode_utf16().count(),
                end: source[..end].encode_utf16().count(),
                name,
                function_like,
                parameters,
                replacement: continuation_pattern
                    .replace_all(replacement, " ")
                    .trim()
                    .to_owned(),
                commented: captures.name("commented").is_some(),
            })
        })
        .collect()
}

#[derive(Debug)]
struct RawConditionalDirective {
    start: usize,
    end: usize,
    kind: String,
    expression: String,
    simple_macro: Option<String>,
    negated: bool,
}

fn source_conditional_directive_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?m)^[\t ]*#[\t ]*(?P<kind>if|ifdef|ifndef|elif|else|endif)\b(?P<expression>[^\r\n]*)"#,
    )
    .map_err(|error| format!("Could not compile conditional-directive analysis: {error}"))
}

fn conditional_identifier(expression: &str) -> Option<String> {
    let value = expression.trim();
    (!value.is_empty()
        && value.bytes().enumerate().all(|(index, byte)| {
            byte == b'_' || byte.is_ascii_alphabetic() || (index > 0 && byte.is_ascii_digit())
        }))
    .then(|| value.to_owned())
}

fn simple_conditional_macro(kind: &str, expression: &str) -> (Option<String>, bool) {
    match kind {
        "ifdef" => (conditional_identifier(expression), false),
        "ifndef" => (conditional_identifier(expression), true),
        "if" | "elif" => {
            let expression = expression.trim();
            let (expression, negated) = expression
                .strip_prefix('!')
                .map_or((expression, false), |value| (value.trim(), true));
            (conditional_identifier(expression), negated)
        }
        _ => (None, false),
    }
}

fn source_conditional_directives(
    source: &str,
    pattern: &Regex,
    continuation_pattern: &Regex,
) -> Vec<RawConditionalDirective> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let directive = captures.get(0)?;
            if !is_code_position(source, directive.start()) {
                return None;
            }
            let kind = captures.name("kind")?.as_str().to_owned();
            let expression_start = captures.name("expression")?.start();
            let mut end = directive.end();
            let mut line_start = directive.start();
            while source[line_start..end].trim_end().ends_with('\\') {
                let next_start = if source[end..].starts_with("\r\n") {
                    end + 2
                } else if source[end..].starts_with('\n') {
                    end + 1
                } else {
                    break;
                };
                line_start = next_start;
                end = source[next_start..]
                    .bytes()
                    .position(|byte| matches!(byte, b'\r' | b'\n'))
                    .map_or(source.len(), |offset| next_start + offset);
            }
            let expression = continuation_pattern
                .replace_all(&source[expression_start..end], " ")
                .trim()
                .to_owned();
            let (simple_macro, negated) = simple_conditional_macro(&kind, &expression);
            Some(RawConditionalDirective {
                start: directive.start(),
                end,
                kind,
                expression,
                simple_macro,
                negated,
            })
        })
        .collect()
}

fn source_conditional_blocks(
    source: &str,
    conditionals: &[RawConditionalDirective],
) -> Vec<SourceConditionalBlockCandidate> {
    let mut stack = Vec::new();
    let mut closes = vec![None; conditionals.len()];
    for (index, candidate) in conditionals.iter().enumerate() {
        match candidate.kind.as_str() {
            "if" | "ifdef" | "ifndef" => stack.push(index),
            "endif" => {
                if let Some(open_index) = stack.pop() {
                    closes[open_index] = Some(index);
                }
            }
            _ => {}
        }
    }
    conditionals
        .iter()
        .enumerate()
        .filter(|(_, candidate)| matches!(candidate.kind.as_str(), "if" | "ifdef" | "ifndef"))
        .map(|(index, open)| {
            let close = closes[index].map(|close_index| &conditionals[close_index]);
            SourceConditionalBlockCandidate {
                open_start: source[..open.start].encode_utf16().count(),
                open_end: source[..open.end].encode_utf16().count(),
                close_start: close
                    .map(|candidate| source[..candidate.start].encode_utf16().count()),
                close_end: close.map(|candidate| source[..candidate.end].encode_utf16().count()),
            }
        })
        .collect()
}

fn identifier_with_optional_line_comment(value: &str) -> Option<String> {
    let value = value.trim();
    let identifier_end = value
        .bytes()
        .position(|byte| !(byte == b'_' || byte.is_ascii_alphanumeric()))
        .unwrap_or(value.len());
    let identifier = conditional_identifier(&value[..identifier_end])?;
    let suffix = value[identifier_end..].trim();
    (suffix.is_empty() || suffix.starts_with("//")).then_some(identifier)
}

fn header_guard_name(directive: &RawConditionalDirective) -> Option<String> {
    match directive.kind.as_str() {
        "ifndef" => identifier_with_optional_line_comment(&directive.expression),
        "if" => {
            let expression = directive.expression.trim().strip_prefix('!')?.trim();
            let tail = expression.strip_prefix("defined")?;
            if tail.starts_with(|character: char| {
                character == '_' || character.is_ascii_alphanumeric()
            }) {
                return None;
            }
            let tail = tail.trim_start();
            if let Some(parenthesized) = tail.strip_prefix('(') {
                let close = parenthesized.find(')')?;
                let name = conditional_identifier(parenthesized[..close].trim())?;
                let suffix = parenthesized[close + 1..].trim();
                return (suffix.is_empty() || suffix.starts_with("//")).then_some(name);
            }
            identifier_with_optional_line_comment(tail)
        }
        _ => None,
    }
}

fn source_header_guards(
    source: &str,
    conditionals: &[RawConditionalDirective],
    macros: &[SourceMacroDefinitionCandidate],
) -> Vec<SourceHeaderGuardCandidate> {
    conditionals
        .iter()
        .enumerate()
        .filter_map(|(open_index, open)| {
            let name = header_guard_name(open)?;
            let definition = macros.iter().find(|candidate| {
                if candidate.commented || candidate.name != name {
                    return false;
                }
                let start = byte_index_for_utf16(source, candidate.start);
                start >= open.end && source[open.end..start].trim().is_empty()
            })?;
            let mut depth = 0usize;
            let close = conditionals.iter().skip(open_index + 1).find(|candidate| {
                match candidate.kind.as_str() {
                    "if" | "ifdef" | "ifndef" => depth += 1,
                    "endif" if depth == 0 => return true,
                    "endif" => depth -= 1,
                    _ => {}
                }
                false
            });
            Some(SourceHeaderGuardCandidate {
                name,
                open_start: source[..open.start].encode_utf16().count(),
                open_end: source[..open.end].encode_utf16().count(),
                define_start: definition.start,
                define_end: definition.end,
                close_start: close
                    .map(|candidate| source[..candidate.start].encode_utf16().count()),
                close_end: close.map(|candidate| source[..candidate.end].encode_utf16().count()),
            })
        })
        .collect()
}

fn matching_delimiter(source: &str, open: usize, opening: u8, closing: u8) -> Option<usize> {
    let bytes = source.as_bytes();
    if bytes.get(open) != Some(&opening) {
        return None;
    }
    let mut depth = 0usize;
    let mut index = open;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index] == opening {
            depth += 1;
        } else if bytes[index] == closing {
            depth = depth.checked_sub(1)?;
            if depth == 0 {
                return Some(index);
            }
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

fn namespace_declaration_before_brace(source: &str, brace: usize) -> Option<Vec<String>> {
    let prefix = &source[..brace];
    let boundary = prefix
        .char_indices()
        .rev()
        .find(|(_, character)| matches!(character, ';' | '{' | '}' | '\n'))
        .map_or(0, |(index, character)| index + character.len_utf8());
    let mut declaration = prefix[boundary..].trim();
    if let Some(rest) = declaration.strip_prefix("inline") {
        if rest.starts_with(char::is_whitespace) {
            declaration = rest.trim_start();
        }
    }
    let name = declaration
        .strip_prefix("namespace")
        .filter(|rest| rest.is_empty() || rest.starts_with(char::is_whitespace))
        .map(str::trim)?;
    if name.is_empty() {
        return Some(Vec::new());
    }
    let parts = name.split("::").collect::<Vec<_>>();
    if parts.iter().all(|part| {
        let mut bytes = part.bytes();
        bytes
            .next()
            .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
            && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    }) {
        Some(parts.into_iter().map(str::to_owned).collect())
    } else {
        None
    }
}

fn namespace_before_brace(source: &str, brace: usize) -> Vec<String> {
    namespace_declaration_before_brace(source, brace).unwrap_or_default()
}

fn extern_c_declaration_before_brace(source: &str, brace: usize) -> bool {
    let mut prefix_start = 0usize;
    let mut cursor = 0usize;
    while cursor < brace {
        if let Some(end) = skipped_non_code(source, cursor) {
            cursor = end;
            continue;
        }
        let Some(character) = source[cursor..].chars().next() else {
            break;
        };
        if matches!(character, ';' | '{' | '}' | '\n') {
            prefix_start = cursor + character.len_utf8();
        }
        cursor += character.len_utf8();
    }
    source_without_comments_preserving_literals(&source[prefix_start..brace])
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        == r#"extern "C""#
}

fn namespace_scope_at(source: &str, target: usize) -> bool {
    let bytes = source.as_bytes();
    let mut namespace_braces = Vec::new();
    let mut index = 0usize;
    while index < target.min(bytes.len()) {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index] == b'{' {
            namespace_braces.push(
                namespace_declaration_before_brace(source, index).is_some()
                    || extern_c_declaration_before_brace(source, index),
            );
        } else if bytes[index] == b'}' {
            namespace_braces.pop();
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    namespace_braces.iter().all(|namespace| *namespace)
}

fn c_linkage_at(source: &str, target: usize) -> bool {
    let bytes = source.as_bytes();
    let mut frames = Vec::new();
    let mut index = 0usize;
    while index < target.min(bytes.len()) {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index] == b'{' {
            frames.push(extern_c_declaration_before_brace(source, index));
        } else if bytes[index] == b'}' {
            frames.pop();
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    frames.into_iter().any(|frame| frame)
}

fn namespace_at(source: &str, target: usize) -> Vec<String> {
    let bytes = source.as_bytes();
    let mut namespace = Vec::new();
    let mut frames = Vec::new();
    let mut index = 0usize;
    while index < target.min(bytes.len()) {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index] == b'{' {
            let names = namespace_declaration_before_brace(source, index);
            if let Some(names) = &names {
                namespace.extend(names.iter().cloned());
            }
            frames.push(names.map_or(0, |names| names.len()));
        } else if bytes[index] == b'}' {
            if let Some(names) = frames.pop() {
                namespace.truncate(namespace.len().saturating_sub(names));
            }
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    namespace
}

fn top_level_parts(source: &str, separator: u8) -> Vec<&str> {
    let bytes = source.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut angles = 0usize;
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut braces = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        match bytes[index] {
            b'<' => angles += 1,
            b'>' => angles = angles.saturating_sub(1),
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' => braces += 1,
            b'}' => braces = braces.saturating_sub(1),
            byte if byte == separator
                && angles == 0
                && parentheses == 0
                && brackets == 0
                && braces == 0 =>
            {
                parts.push(&source[start..index]);
                start = index + 1;
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    parts.push(&source[start..]);
    parts
}

fn template_parameter_name(parameter: &str) -> Option<String> {
    let declaration = top_level_parts(parameter, b'=')
        .first()
        .copied()
        .unwrap_or(parameter)
        .trim_end();
    let bytes = declaration.as_bytes();
    let end = bytes
        .iter()
        .rposition(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')?
        + 1;
    let start = bytes[..end]
        .iter()
        .rposition(|byte| !byte.is_ascii_alphanumeric() && *byte != b'_')
        .map_or(0, |index| index + 1);
    let name = &declaration[start..end];
    let mut characters = name.bytes();
    if !characters
        .next()
        .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        || !characters.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        || matches!(
            name,
            "class"
                | "typename"
                | "struct"
                | "union"
                | "bool"
                | "char"
                | "short"
                | "int"
                | "long"
                | "float"
                | "double"
                | "signed"
                | "unsigned"
                | "auto"
        )
    {
        return None;
    }
    Some(name.to_owned())
}

fn inheritance_source(tail: &str) -> Option<&str> {
    let bytes = tail.as_bytes();
    let mut angles = 0usize;
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(tail, index) {
            index = end;
            continue;
        }
        match bytes[index] {
            b'<' => angles += 1,
            b'>' => angles = angles.saturating_sub(1),
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b':' if angles == 0
                && parentheses == 0
                && brackets == 0
                && bytes.get(index.wrapping_sub(1)) != Some(&b':')
                && bytes.get(index + 1) != Some(&b':') =>
            {
                return Some(&tail[index + 1..]);
            }
            _ => {}
        }
        index += tail[index..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

fn normalized_base(source: &str) -> String {
    let mut value = source.trim();
    loop {
        let mut changed = false;
        for keyword in ["public", "protected", "private", "virtual"] {
            if let Some(rest) = value.strip_prefix(keyword) {
                if rest.starts_with(char::is_whitespace) {
                    value = rest.trim_start();
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            break;
        }
    }
    value.trim().to_owned()
}

fn type_declaration_before_brace(
    source: &str,
    brace: usize,
    pattern: &Regex,
) -> Option<ParsedTypeDeclaration> {
    let mut prefix_start = 0usize;
    let mut cursor = 0usize;
    while cursor < brace {
        if let Some(end) = skipped_non_code(source, cursor) {
            cursor = end;
            continue;
        }
        let character = source[cursor..].chars().next()?;
        if matches!(character, ';' | '{' | '}') {
            prefix_start = cursor + character.len_utf8();
        }
        cursor += character.len_utf8();
    }
    let declaration = &source[prefix_start..brace];
    let captures = pattern.captures(declaration)?;
    let name = captures.name("name")?;
    let kind = captures.name("kind")?;
    let declaration_start = captures.name("template").map_or(kind.start(), |template| {
        declaration[..template.start()]
            .rfind("template")
            .unwrap_or(kind.start())
    });
    let template_source = captures
        .name("template")
        .map(|parameters| parameters.as_str().trim().to_owned());
    let template_parameters = captures
        .name("template")
        .map(|parameters| {
            top_level_parts(parameters.as_str(), b',')
                .into_iter()
                .filter_map(template_parameter_name)
                .collect()
        })
        .unwrap_or_default();
    let bases = captures
        .name("tail")
        .and_then(|tail| inheritance_source(tail.as_str()))
        .map(|inheritance| {
            top_level_parts(inheritance, b',')
                .into_iter()
                .map(normalized_base)
                .filter(|base| !base.is_empty())
                .collect()
        })
        .unwrap_or_default();
    Some(ParsedTypeDeclaration {
        start: prefix_start + name.start(),
        declaration_start: prefix_start + declaration_start,
        owner: TypeOwnerCandidate {
            name: name.as_str().to_owned(),
            template_parameters,
        },
        kind: kind.as_str().to_owned(),
        template_source,
        bases,
    })
}

fn type_before_brace(source: &str, brace: usize, pattern: &Regex) -> Option<TypeOwnerCandidate> {
    type_declaration_before_brace(source, brace, pattern).map(|declaration| declaration.owner)
}

fn type_declarations_in_source(
    source: &str,
    file: &Path,
    type_pattern: &Regex,
) -> Vec<TypeDeclarationCandidate> {
    struct ScopeFrame {
        namespaces: usize,
        owner: bool,
    }

    let bytes = source.as_bytes();
    let mut candidates = Vec::new();
    let mut namespace = Vec::new();
    let mut owners = Vec::new();
    let mut frames = Vec::new();
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index] == b'{' {
            let names = namespace_before_brace(source, index);
            let declaration = if names.is_empty() {
                type_declaration_before_brace(source, index, type_pattern)
            } else {
                None
            };
            let has_owner = declaration.is_some();
            if let Some(declaration) = declaration {
                if let Some(close) = matching_delimiter(source, index, b'{', b'}') {
                    let mut declaration_end = close + 1;
                    while source[declaration_end..]
                        .chars()
                        .next()
                        .is_some_and(char::is_whitespace)
                    {
                        declaration_end += source[declaration_end..]
                            .chars()
                            .next()
                            .map_or(1, char::len_utf8);
                    }
                    if source.as_bytes().get(declaration_end) == Some(&b';') {
                        declaration_end += 1;
                    }
                    candidates.push(TypeDeclarationCandidate {
                        file: file.to_owned(),
                        start: source[..declaration.start].encode_utf16().count(),
                        declaration_start: source[..declaration.declaration_start]
                            .encode_utf16()
                            .count(),
                        declaration_end: source[..declaration_end].encode_utf16().count(),
                        body_start: source[..index + 1].encode_utf16().count(),
                        body_end: source[..close].encode_utf16().count(),
                        name: declaration.owner.name.clone(),
                        kind: declaration.kind,
                        namespace: namespace.clone(),
                        namespace_scope: namespace_scope_at(source, declaration.start),
                        owners: owners.clone(),
                        template_source: declaration.template_source,
                        template_parameters: declaration.owner.template_parameters.clone(),
                        bases: declaration.bases,
                    });
                }
                owners.push(declaration.owner);
            }
            namespace.extend(names.iter().cloned());
            frames.push(ScopeFrame {
                namespaces: names.len(),
                owner: has_owner,
            });
        } else if bytes[index] == b'}' {
            if let Some(frame) = frames.pop() {
                namespace.truncate(namespace.len().saturating_sub(frame.namespaces));
                if frame.owner {
                    owners.pop();
                }
            }
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    candidates
}

fn anonymous_typedef_declarations_in_source(
    source: &str,
    file: &Path,
    type_pattern: &Regex,
) -> Vec<AnonymousTypedefDeclarationCandidate> {
    let bytes = source.as_bytes();
    let mut candidates = Vec::new();
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        let Some(mut cursor) = keyword_end(source, index, "typedef") else {
            index += source[index..].chars().next().map_or(1, char::len_utf8);
            continue;
        };
        cursor = skip_space_and_comments(source, cursor);
        let Some((kind, kind_end)) = ["struct", "class", "union", "enum"]
            .into_iter()
            .find_map(|kind| keyword_end(source, cursor, kind).map(|end| (kind, end)))
        else {
            index = cursor.saturating_add(1);
            continue;
        };
        cursor = skip_space_and_comments(source, kind_end);
        if bytes.get(cursor) != Some(&b'{') {
            index = cursor.saturating_add(1);
            continue;
        }
        let open = cursor;
        let Some(close) = matching_delimiter(source, open, b'{', b'}') else {
            index = open + 1;
            continue;
        };
        let name_start = skip_space_and_comments(source, close + 1);
        let Some(name_end) = identifier_end(source, name_start) else {
            index = close + 1;
            continue;
        };
        let end = skip_space_and_comments(source, name_end);
        if bytes.get(end) != Some(&b';') {
            index = close + 1;
            continue;
        }
        let declaration_end = end + 1;
        let (namespace, owners) = lexical_scope_at(source, index, type_pattern);
        candidates.push(AnonymousTypedefDeclarationCandidate {
            file: file.to_owned(),
            start: source[..index].encode_utf16().count(),
            end: source[..declaration_end].encode_utf16().count(),
            body_start: source[..open + 1].encode_utf16().count(),
            body_end: source[..close].encode_utf16().count(),
            name_start: source[..name_start].encode_utf16().count(),
            name: source[name_start..name_end].to_owned(),
            kind: kind.to_owned(),
            namespace,
            namespace_scope: namespace_scope_at(source, index),
            owners,
        });
        index = declaration_end;
    }
    candidates
}

fn identifier_end(source: &str, start: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    if !bytes
        .get(start)
        .is_some_and(|byte| byte.is_ascii_alphabetic() || *byte == b'_')
    {
        return None;
    }
    let mut end = start + 1;
    while bytes
        .get(end)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        end += 1;
    }
    Some(end)
}

fn keyword_end(source: &str, start: usize, keyword: &str) -> Option<usize> {
    let end = start.checked_add(keyword.len())?;
    if source.get(start..end)? != keyword
        || source
            .as_bytes()
            .get(start.wrapping_sub(1))
            .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
        || source
            .as_bytes()
            .get(end)
            .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        return None;
    }
    Some(end)
}

fn skip_space_and_comments(source: &str, mut index: usize) -> usize {
    let bytes = source.as_bytes();
    loop {
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        let comment = (bytes.get(index) == Some(&b'/')
            && matches!(bytes.get(index + 1), Some(b'/' | b'*')))
        .then(|| skipped_non_code(source, index))
        .flatten();
        if let Some(end) = comment {
            index = end;
        } else {
            return index;
        }
    }
}

fn enum_raw_source(source: &str) -> String {
    let bytes = source.as_bytes();
    let mut result = String::with_capacity(source.len());
    let mut index = 0usize;
    while index < bytes.len() {
        if bytes[index] == b'/' && matches!(bytes.get(index + 1), Some(b'/' | b'*')) {
            let end = skipped_non_code(source, index).unwrap_or(bytes.len());
            if bytes.get(index + 1) == Some(&b'/') && source[index..end].ends_with('\n') {
                result.push('\n');
            }
            index = end;
            continue;
        }
        if let Some(end) = raw_string_end(source, index) {
            result.push_str(&source[index..end]);
            index = end;
            continue;
        }
        if matches!(bytes[index], b'\'' | b'"') {
            let end = skip_quoted(source, index, bytes[index]);
            result.push_str(&source[index..end]);
            index = end;
            continue;
        }
        let character = source[index..]
            .chars()
            .next()
            .expect("source has a character");
        result.push(character);
        index += character.len_utf8();
    }
    result.trim().to_owned()
}

fn enum_template_close(source: &str, open: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    if bytes.get(open) != Some(&b'<') || matches!(bytes.get(open + 1), Some(b'<' | b'=')) {
        return None;
    }
    let mut depth = 0usize;
    let mut index = open;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        match bytes[index] {
            b'<' if bytes.get(index + 1) != Some(&b'<') => depth += 1,
            b'>' if bytes.get(index + 1) != Some(&b'=') => {
                depth = depth.checked_sub(1)?;
                if depth == 0 {
                    let after = skip_space_and_comments(source, index + 1);
                    let suffix = &source[after..];
                    if after == bytes.len()
                        || suffix.starts_with("::")
                        || matches!(bytes.get(after), Some(b'(' | b'{' | b'[' | b','))
                    {
                        return Some(index);
                    }
                    return None;
                }
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

fn enum_top_level_parts(source: &str) -> Vec<&str> {
    let bytes = source.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut angles = 0usize;
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut braces = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        match bytes[index] {
            b'<' if enum_template_close(source, index).is_some() => angles += 1,
            b'>' if angles > 0 => angles -= 1,
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' => braces += 1,
            b'}' => braces = braces.saturating_sub(1),
            b',' if angles == 0 && parentheses == 0 && brackets == 0 && braces == 0 => {
                parts.push(&source[start..index]);
                start = index + 1;
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    parts.push(&source[start..]);
    parts
}

fn parse_enum_body(
    raw: &str,
    macro_pattern: &Regex,
    identifier_pattern: &Regex,
) -> (Vec<EnumIdentifierCandidate>, BTreeMap<String, String>, bool) {
    let mut identifiers = Vec::new();
    let mut assignments = BTreeMap::new();
    let mut complete = !raw.lines().any(|line| line.trim_start().starts_with('#'));
    for part in enum_top_level_parts(raw) {
        let token = part.trim();
        if token.is_empty() {
            continue;
        }
        if let Some(captures) = macro_pattern.captures(token) {
            let macro_name = captures.name("macro").map(|value| value.as_str());
            let arguments = captures
                .name("arguments")
                .map(|value| enum_top_level_parts(value.as_str()))
                .unwrap_or_default();
            let base = arguments.first().map(|value| value.trim()).unwrap_or("");
            let count = arguments.get(1).map(|value| value.trim()).unwrap_or("");
            if identifier_end(base, 0) == Some(base.len()) {
                let count =
                    match macro_name {
                        Some(
                            "ENUMS" | "MULTIPLE" | "PER_CHANNEL" | "PER_STEP" | "ONE_PER_STEP",
                        ) if !count.is_empty() => Some(count.to_owned()),
                        Some("TWO_PER_STEP") if !count.is_empty() => Some(format!("({count}) * 2")),
                        Some("PER_INPUT") => Some("input_count".to_owned()),
                        Some("TWO_OF") => Some("2".to_owned()),
                        _ => None,
                    };
                if let Some(count) = count {
                    identifiers.push(EnumIdentifierCandidate::Repeated {
                        base: base.to_owned(),
                        count,
                    });
                }
                continue;
            }
        }
        if let Some(captures) = identifier_pattern.captures(token) {
            let name = captures
                .name("name")
                .expect("enum identifier pattern has a name")
                .as_str()
                .to_owned();
            identifiers.push(EnumIdentifierCandidate::Name(name.clone()));
            if let Some(expression) = captures.name("expression") {
                assignments.insert(name, expression.as_str().trim().to_owned());
            }
        } else {
            complete = false;
        }
    }
    (identifiers, assignments, complete)
}

fn enum_declarations_in_source(
    source: &str,
    file: &Path,
    type_pattern: &Regex,
    macro_pattern: &Regex,
    identifier_pattern: &Regex,
) -> Vec<EnumDeclarationCandidate> {
    let bytes = source.as_bytes();
    let mut candidates = Vec::new();
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        let Some(mut cursor) = keyword_end(source, index, "enum") else {
            index += source[index..].chars().next().map_or(1, char::len_utf8);
            continue;
        };
        let declaration_start = index;
        cursor = skip_space_and_comments(source, cursor);
        let mut scoped = false;
        for keyword in ["class", "struct"] {
            if let Some(end) = keyword_end(source, cursor, keyword) {
                scoped = true;
                cursor = skip_space_and_comments(source, end);
                break;
            }
        }
        let name = identifier_end(source, cursor).map(|end| {
            let name = source[cursor..end].to_owned();
            cursor = skip_space_and_comments(source, end);
            name
        });
        let mut open = None;
        while cursor < bytes.len() {
            if let Some(end) = skipped_non_code(source, cursor) {
                cursor = end;
                continue;
            }
            match bytes[cursor] {
                b'{' => {
                    open = Some(cursor);
                    break;
                }
                b';' | b'}' => break,
                _ => {
                    cursor += source[cursor..].chars().next().map_or(1, char::len_utf8);
                }
            }
        }
        let Some(open) = open else {
            index = cursor.saturating_add(1);
            continue;
        };
        let Some(close) = matching_delimiter(source, open, b'{', b'}') else {
            index = open + 1;
            continue;
        };
        let mut end = skip_space_and_comments(source, close + 1);
        if bytes.get(end) == Some(&b';') {
            end += 1;
        } else {
            end = close + 1;
        }
        let raw = enum_raw_source(&source[open + 1..close]);
        let (identifiers, assignments, complete) =
            parse_enum_body(&raw, macro_pattern, identifier_pattern);
        let (namespace, owners) = lexical_scope_at(source, declaration_start, type_pattern);
        candidates.push(EnumDeclarationCandidate {
            file: file.to_owned(),
            start: source[..declaration_start].encode_utf16().count(),
            end: source[..end].encode_utf16().count(),
            body_start: source[..open + 1].encode_utf16().count(),
            body_end: source[..close].encode_utf16().count(),
            name,
            scoped,
            namespace,
            namespace_scope: namespace_scope_at(source, declaration_start),
            owners,
            raw,
            identifiers,
            assignments,
            complete,
        });
        index = close + 1;
    }
    candidates
}

#[derive(Clone, Debug)]
struct ParsedConfigLoop {
    start: usize,
    end: usize,
    body_start: usize,
    body_end: usize,
    variable: String,
    start_expression: String,
    end_expression: String,
}

fn config_loops_in_source(source: &str, pattern: &Regex) -> Vec<ParsedConfigLoop> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            if !is_code_position(source, matched.start()) {
                return None;
            }
            let variable = captures.name("variable")?;
            let condition_variable = captures.name("condition_variable")?;
            if variable.as_str() != condition_variable.as_str() {
                return None;
            }
            let open = source[matched.start()..matched.end()]
                .rfind('{')
                .map(|offset| matched.start() + offset)?;
            let close = matching_delimiter(source, open, b'{', b'}')?;
            Some(ParsedConfigLoop {
                start: matched.start(),
                end: close + 1,
                body_start: open + 1,
                body_end: close,
                variable: variable.as_str().to_owned(),
                start_expression: captures.name("start")?.as_str().trim().to_owned(),
                end_expression: captures.name("end")?.as_str().trim().to_owned(),
            })
        })
        .collect()
}

fn byte_index_for_utf16(source: &str, target: usize) -> usize {
    let mut units = 0usize;
    for (index, character) in source.char_indices() {
        if units >= target {
            return index;
        }
        units += character.len_utf16();
    }
    source.len()
}

fn config_string_bindings(
    source: &str,
    start: usize,
    end: usize,
    pattern: &Regex,
) -> Vec<ConfigStringBindingCandidate> {
    pattern
        .captures_iter(&source[start..end])
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            let absolute_start = start + matched.start();
            if !is_code_position(source, absolute_start) {
                return None;
            }
            let absolute_end = start + matched.end();
            Some(ConfigStringBindingCandidate {
                start: source[..absolute_start].encode_utf16().count(),
                end: source[..absolute_end].encode_utf16().count(),
                name: captures.name("name")?.as_str().to_owned(),
                expression: captures.name("expression")?.as_str().trim().to_owned(),
            })
        })
        .collect()
}

fn config_context_at(
    source: &str,
    index: usize,
    source_loops: &[ParsedConfigLoop],
    binding_pattern: &Regex,
) -> (Vec<ConfigLoopCandidate>, Vec<ConfigStringBindingCandidate>) {
    let start_utf16 = source[..index].encode_utf16().count();
    let enclosing_loops = source_loops
        .iter()
        .filter(|candidate| candidate.body_start <= index && candidate.body_end > index)
        .cloned()
        .collect::<Vec<_>>();
    let binding_start = enclosing_loops.last().map_or_else(
        || byte_index_for_utf16(source, start_utf16.saturating_sub(2_000)),
        |candidate| candidate.body_start,
    );
    let string_bindings = config_string_bindings(source, binding_start, index, binding_pattern);
    let loops = enclosing_loops
        .into_iter()
        .map(|candidate| ConfigLoopCandidate {
            start: source[..candidate.start].encode_utf16().count(),
            end: source[..candidate.end].encode_utf16().count(),
            body_start: source[..candidate.body_start].encode_utf16().count(),
            body_end: source[..candidate.body_end].encode_utf16().count(),
            variable: candidate.variable,
            start_expression: candidate.start_expression,
            end_expression: candidate.end_expression,
        })
        .collect();
    (loops, string_bindings)
}

fn config_calls_in_source(
    source: &str,
    file: &Path,
    type_pattern: &Regex,
    loop_pattern: &Regex,
    binding_pattern: &Regex,
    snap_patterns: &[Regex; 2],
) -> Vec<ConfigCallCandidate> {
    let bytes = source.as_bytes();
    let source_loops = config_loops_in_source(source, loop_pattern);
    let mut candidates = Vec::new();
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        let Some(name_end) = identifier_end(source, index) else {
            index += source[index..].chars().next().map_or(1, char::len_utf8);
            continue;
        };
        let name = &source[index..name_end];
        if !CONFIG_CALL_NAMES.contains(&name) {
            index = name_end;
            continue;
        }
        let mut cursor = skip_space_and_comments(source, name_end);
        let template_source = if bytes.get(cursor) == Some(&b'<') {
            let Some(close) = matching_delimiter(source, cursor, b'<', b'>') else {
                index = name_end;
                continue;
            };
            let value = source[cursor + 1..close].trim().to_owned();
            cursor = skip_space_and_comments(source, close + 1);
            Some(value)
        } else {
            None
        };
        if bytes.get(cursor) != Some(&b'(') {
            index = name_end;
            continue;
        }
        let Some(close) = matching_delimiter(source, cursor, b'(', b')') else {
            index = name_end;
            continue;
        };
        let arguments_source = source[cursor + 1..close].trim().to_owned();
        let arguments = top_level_parts(&arguments_source, b',')
            .into_iter()
            .map(str::trim)
            .filter(|argument| !argument.is_empty())
            .map(str::to_owned)
            .collect();
        let (loops, string_bindings) =
            config_context_at(source, index, &source_loops, binding_pattern);
        let (namespace, owners) = lexical_scope_at(source, index, type_pattern);
        candidates.push(ConfigCallCandidate {
            file: file.to_owned(),
            start: source[..index].encode_utf16().count(),
            end: source[..close + 1].encode_utf16().count(),
            name: name.to_owned(),
            template_source,
            arguments_source,
            arguments,
            namespace,
            owners,
            loops,
            string_bindings,
            synthetic: false,
        });
        index = name_end;
    }
    for pattern in snap_patterns {
        for captures in pattern.captures_iter(source) {
            let Some(matched) = captures.get(0) else {
                continue;
            };
            if !is_code_position(source, matched.start()) {
                continue;
            }
            let Some(argument) = captures.name("argument") else {
                continue;
            };
            let arguments_source = argument.as_str().trim().to_owned();
            if arguments_source.is_empty() {
                continue;
            }
            let (loops, string_bindings) =
                config_context_at(source, matched.start(), &source_loops, binding_pattern);
            let (namespace, owners) = lexical_scope_at(source, matched.start(), type_pattern);
            candidates.push(ConfigCallCandidate {
                file: file.to_owned(),
                start: source[..matched.start()].encode_utf16().count(),
                end: source[..matched.end()].encode_utf16().count(),
                name: "rackWebSnapParam".to_owned(),
                template_source: None,
                arguments_source: arguments_source.clone(),
                arguments: vec![arguments_source],
                namespace,
                owners,
                loops,
                string_bindings,
                synthetic: true,
            });
        }
    }
    candidates.sort_by_key(|candidate| candidate.start);
    candidates
}

fn owner_chain_before_final_scope(source: &str) -> Option<Vec<String>> {
    let final_scope = source.rfind("::")?;
    let prefix = source[..final_scope].trim();
    let bytes = prefix.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut angle_depth = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        match bytes[index] {
            b'<' => angle_depth += 1,
            b'>' => angle_depth = angle_depth.saturating_sub(1),
            b':' if angle_depth == 0 && bytes.get(index + 1) == Some(&b':') => {
                parts.push(&prefix[start..index]);
                index += 1;
                start = index + 1;
            }
            _ => {}
        }
        index += 1;
    }
    parts.push(&prefix[start..]);
    let owners = parts
        .into_iter()
        .filter_map(|part| {
            let value = part.trim().strip_prefix("template ").unwrap_or(part.trim());
            let base = value.rsplit_once('<').map_or(value, |(name, _)| name);
            let end = base
                .char_indices()
                .rev()
                .find(|(_, character)| character.is_ascii_alphanumeric() || *character == '_')
                .map(|(index, character)| index + character.len_utf8())?;
            let start = base[..end]
                .char_indices()
                .rev()
                .find(|(_, character)| !character.is_ascii_alphanumeric() && *character != '_')
                .map_or(0, |(index, character)| index + character.len_utf8());
            let name = &base[start..end];
            let mut bytes = name.bytes();
            (bytes
                .next()
                .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
                && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_'))
            .then(|| name.to_owned())
        })
        .collect::<Vec<_>>();
    (!owners.is_empty()).then_some(owners)
}

fn member_after_final_scope(source: &str) -> Option<&str> {
    source.rsplit_once("::").map(|(_, member)| member.trim())
}

fn terminal_callable_identifier(member: &str) -> &str {
    let member = member.trim().trim_start_matches('~');
    member
        .split_once('<')
        .map_or(member, |(name, _)| name)
        .trim()
}

fn out_of_line_callable_kind(
    source: &str,
    definition_start: usize,
    qualified_start: usize,
    owner: &str,
    member: &str,
) -> String {
    if member.trim_start().starts_with('~') && terminal_callable_identifier(member) == owner {
        return "destructor".to_owned();
    }
    if terminal_callable_identifier(member) != owner {
        return "function".to_owned();
    }
    let Some(prefix) = source.get(definition_start..qualified_start) else {
        return "function".to_owned();
    };
    let prefix = source_without_comments_preserving_literals(prefix);
    let mut cursor = 0usize;
    loop {
        cursor = skip_space_and_comments(&prefix, cursor);
        let Some(rest) = prefix.get(cursor..) else {
            break;
        };
        let Some(after_template) = rest.strip_prefix("template") else {
            break;
        };
        if after_template
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            break;
        }
        cursor += "template".len();
        cursor = skip_space_and_comments(&prefix, cursor);
        if prefix.as_bytes().get(cursor) != Some(&b'<') {
            break;
        }
        let Some(close) = matching_delimiter(&prefix, cursor, b'<', b'>') else {
            break;
        };
        cursor = close + 1;
    }
    let remaining = prefix.get(cursor..).unwrap_or_default();
    let has_return_type = remaining.split_whitespace().any(|token| {
        !matches!(
            token,
            "inline" | "constexpr" | "consteval" | "explicit" | "friend" | "virtual"
        )
    });
    if has_return_type {
        "function".to_owned()
    } else {
        "constructor".to_owned()
    }
}

fn source_without_comments_preserving_literals(source: &str) -> String {
    let bytes = source.as_bytes();
    let mut output = bytes.to_vec();
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = raw_string_end(source, index) {
            index = end;
            continue;
        }
        if bytes.get(index) == Some(&b'/') && bytes.get(index + 1) == Some(&b'/') {
            let end = source[index + 2..]
                .find('\n')
                .map_or(bytes.len(), |offset| index + 2 + offset);
            for byte in &mut output[index..end] {
                *byte = b' ';
            }
            index = end;
            continue;
        }
        if bytes.get(index) == Some(&b'/') && bytes.get(index + 1) == Some(&b'*') {
            let end = source[index + 2..]
                .find("*/")
                .map_or(bytes.len(), |offset| index + 2 + offset + 2);
            for (offset, byte) in output[index..end].iter_mut().enumerate() {
                if !matches!(bytes[index + offset], b'\n' | b'\r') {
                    *byte = b' ';
                }
            }
            index = end;
            continue;
        }
        if matches!(bytes.get(index), Some(b'\'' | b'"')) {
            index = skip_quoted(source, index, bytes[index]);
            continue;
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    String::from_utf8(output).expect("comment replacement preserves UTF-8")
}

fn canonical_out_of_line_signature(
    source: &str,
    start: usize,
    body_start: usize,
    prefix_pattern: &Regex,
) -> Option<String> {
    let signature = normalized_definition_signature(source, start, body_start)?;
    let canonical = prefix_pattern.replace(&signature, "").trim().to_owned();
    (!canonical.is_empty()).then_some(canonical)
}

fn normalized_definition_signature(
    source: &str,
    start: usize,
    body_start: usize,
) -> Option<String> {
    let signature = source_without_comments_preserving_literals(source.get(start..body_start)?)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    (!signature.is_empty()).then_some(signature)
}

fn out_of_line_definition_start(
    source: &str,
    match_start: usize,
    detached_return_pattern: &Regex,
    template_pattern: &Regex,
) -> usize {
    let line_start = source[..match_start]
        .rfind('\n')
        .map_or(0, |index| index + 1);
    let mut start = line_start;
    let previous_end = line_start.saturating_sub(1);
    let previous_start = source[..previous_end]
        .rfind('\n')
        .map_or(0, |index| index + 1);
    if previous_start < previous_end
        && detached_return_pattern.is_match(&source[previous_start..previous_end])
    {
        start = previous_start;
    }
    let template_end = start.saturating_sub(1);
    let template_start = source[..template_end]
        .rfind('\n')
        .map_or(0, |index| index + 1);
    if template_start < template_end
        && template_pattern.is_match(&source[template_start..template_end])
    {
        start = template_start;
    }
    let namespace_body_start = {
        let bytes = source.as_bytes();
        let mut frames = Vec::new();
        let mut index = 0usize;
        while index < match_start.min(bytes.len()) {
            if let Some(end) = skipped_non_code(source, index) {
                index = end;
                continue;
            }
            if bytes[index] == b'{' {
                frames.push(namespace_declaration_before_brace(source, index).map(|_| index + 1));
            } else if bytes[index] == b'}' {
                frames.pop();
            }
            index += source[index..].chars().next().map_or(1, char::len_utf8);
        }
        frames.into_iter().rev().flatten().next()
    };
    if let Some(namespace_body_start) = namespace_body_start.filter(|body| *body > start) {
        start = namespace_body_start;
        while source[start..]
            .chars()
            .next()
            .is_some_and(char::is_whitespace)
        {
            start += source[start..].chars().next().map_or(1, char::len_utf8);
        }
    }
    start
}

fn out_of_line_definitions_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
    detached_return_pattern: &Regex,
    template_pattern: &Regex,
    signature_prefix_pattern: &Regex,
) -> Vec<OutOfLineDefinitionCandidate> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    for captures in pattern.captures_iter(source) {
        let Some(matched) = captures.get(0) else {
            continue;
        };
        let Some(qualified) = captures.name("qualified") else {
            continue;
        };
        if !is_code_position(source, matched.start())
            || !namespace_scope_at(source, matched.start())
        {
            continue;
        }
        let Some(owner_chain) = owner_chain_before_final_scope(qualified.as_str()) else {
            continue;
        };
        let owner = owner_chain.last().cloned().unwrap_or_default();
        let Some(member) = member_after_final_scope(qualified.as_str()).map(str::to_owned) else {
            continue;
        };
        let line_start = source[..matched.start()]
            .rfind('\n')
            .map_or(0, |index| index + 1);
        if source[line_start..matched.start()]
            .bytes()
            .any(|byte| matches!(byte, b'=' | b'(' | b'.'))
        {
            continue;
        }
        let Some(mut open) = source[matched.start()..]
            .find('{')
            .map(|offset| matched.start() + offset)
        else {
            continue;
        };
        if source[matched.start()..open].contains(';') {
            continue;
        }
        for _ in 0..16 {
            let Some(candidate_close) = matching_delimiter(source, open, b'{', b'}') else {
                break;
            };
            let mut cursor = candidate_close + 1;
            while source[cursor..]
                .chars()
                .next()
                .is_some_and(char::is_whitespace)
            {
                cursor += source[cursor..].chars().next().map_or(1, char::len_utf8);
            }
            if !matches!(source.as_bytes().get(cursor), Some(b'{' | b',')) {
                break;
            }
            let Some(next_open) = source[candidate_close + 1..]
                .find('{')
                .map(|offset| candidate_close + 1 + offset)
            else {
                break;
            };
            open = next_open;
        }
        let Some(close) = matching_delimiter(source, open, b'{', b'}') else {
            continue;
        };
        let start = out_of_line_definition_start(
            source,
            matched.start(),
            detached_return_pattern,
            template_pattern,
        );
        let end = close + 1;
        let callable_kind =
            out_of_line_callable_kind(source, start, qualified.start(), &owner, &member);
        let signature =
            canonical_out_of_line_signature(source, start, open, signature_prefix_pattern);
        if signature.is_some() && seen.insert((start, end, owner.clone())) {
            candidates.push(OutOfLineDefinitionCandidate {
                file: file.to_owned(),
                start: source[..start].encode_utf16().count(),
                end: source[..end].encode_utf16().count(),
                body_start: Some(source[..open + 1].encode_utf16().count()),
                body_end: Some(source[..close].encode_utf16().count()),
                owner,
                owner_chain,
                kind: "function".to_owned(),
                namespace: namespace_at(source, matched.start()),
                member: Some(member),
                callable_kind: Some(callable_kind),
                signature,
            });
        }
    }
    candidates
}

fn inline_member_definitions_in_source(
    source: &str,
    declarations: &[TypeDeclarationCandidate],
    pattern: &Regex,
) -> Vec<SourceInlineMemberDefinitionCandidate> {
    let bytes = source.as_bytes();
    let mut candidates = Vec::new();
    for declaration in declarations {
        let body_start = byte_index_for_utf16(source, declaration.body_start);
        let body_end = byte_index_for_utf16(source, declaration.body_end);
        let mut statement_start = body_start;
        let mut index = body_start;
        while index < body_end {
            if let Some(end) = skipped_non_code(source, index) {
                index = end.min(body_end);
                continue;
            }
            if bytes[index] == b';' {
                statement_start = index + 1;
                index += 1;
                continue;
            }
            if bytes[index] != b'{' {
                index += source[index..].chars().next().map_or(1, char::len_utf8);
                continue;
            }
            let Some(close) = matching_delimiter(source, index, b'{', b'}') else {
                break;
            };
            if close > body_end {
                break;
            }
            let prefix = source_without_comments_preserving_literals(
                source.get(statement_start..index).unwrap_or_default(),
            );
            if let Some(captures) = pattern.captures(&prefix) {
                let member = captures
                    .name("member")
                    .or_else(|| captures.name("special_member"));
                if let (Some(signature), Some(member)) = (captures.name("signature"), member) {
                    let start = statement_start + signature.start();
                    let normalized_signature = source_without_comments_preserving_literals(
                        source.get(start..index).unwrap_or_default(),
                    )
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
                    let mut owner_chain = declaration
                        .owners
                        .iter()
                        .map(|owner| owner.name.clone())
                        .collect::<Vec<_>>();
                    owner_chain.push(declaration.name.clone());
                    let callable_kind = if member.as_str().starts_with('~') {
                        "destructor"
                    } else if member.as_str() == declaration.name {
                        "constructor"
                    } else {
                        "function"
                    };
                    candidates.push(SourceInlineMemberDefinitionCandidate {
                        start: source[..start].encode_utf16().count(),
                        end: source[..close + 1].encode_utf16().count(),
                        body_start: source[..index + 1].encode_utf16().count(),
                        body_end: source[..close].encode_utf16().count(),
                        owner: declaration.name.clone(),
                        owner_chain,
                        namespace: declaration.namespace.clone(),
                        member: member.as_str().to_owned(),
                        callable_kind: callable_kind.to_owned(),
                        signature: normalized_signature,
                    });
                }
            }
            index = close + 1;
            statement_start = index;
        }
    }
    candidates.sort_by_key(|candidate| candidate.start);
    candidates
}

fn defaulted_definitions_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<OutOfLineDefinitionCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            let qualified = captures.name("qualified")?;
            if !is_code_position(source, matched.start())
                || !namespace_scope_at(source, matched.start())
            {
                return None;
            }
            let owner_chain = owner_chain_before_final_scope(qualified.as_str())?;
            let owner = owner_chain.last()?.clone();
            let member = member_after_final_scope(qualified.as_str())?
                .trim_start_matches('~')
                .trim();
            if member != owner {
                return None;
            }
            Some(OutOfLineDefinitionCandidate {
                file: file.to_owned(),
                start: source[..matched.start()].encode_utf16().count(),
                end: source[..matched.end()].encode_utf16().count(),
                body_start: None,
                body_end: None,
                owner,
                owner_chain,
                kind: "defaulted".to_owned(),
                namespace: namespace_at(source, matched.start()),
                member: None,
                callable_kind: None,
                signature: None,
            })
        })
        .collect()
}

fn namespace_statement_end(source: &str, start: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut braces = 0usize;
    let mut index = start;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        match bytes[index] {
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' => braces += 1,
            b'}' => {
                if braces == 0 {
                    return None;
                }
                braces -= 1;
            }
            b';' if parentheses == 0 && brackets == 0 && braces == 0 => {
                return Some(index + 1);
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

fn static_definitions_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<OutOfLineDefinitionCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            let qualified = captures.name("qualified")?;
            if !is_code_position(source, matched.start())
                || !namespace_scope_at(source, matched.start())
            {
                return None;
            }
            let owner_chain = owner_chain_before_final_scope(qualified.as_str())?;
            let owner = owner_chain.last()?.clone();
            if member_after_final_scope(qualified.as_str())?.starts_with("operator") {
                return None;
            }
            let end = namespace_statement_end(source, qualified.end())?;
            Some(OutOfLineDefinitionCandidate {
                file: file.to_owned(),
                start: source[..matched.start()].encode_utf16().count(),
                end: source[..end].encode_utf16().count(),
                body_start: None,
                body_end: None,
                owner,
                owner_chain,
                kind: "static".to_owned(),
                namespace: namespace_at(source, matched.start()),
                member: None,
                callable_kind: None,
                signature: None,
            })
        })
        .collect()
}

fn free_function_references(source: &str) -> Vec<String> {
    let bytes = source.as_bytes();
    let mut references = Vec::new();
    let mut seen = HashSet::new();
    let mut index = 0usize;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index].is_ascii_alphabetic() || bytes[index] == b'_' {
            let start = index;
            index += 1;
            while index < bytes.len()
                && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'_')
            {
                index += 1;
            }
            let name = &source[start..index];
            let mut next = index;
            while bytes.get(next).is_some_and(u8::is_ascii_whitespace) {
                next += 1;
            }
            if bytes.get(next) == Some(&b'<') {
                if let Some(close) = matching_delimiter(source, next, b'<', b'>') {
                    next = close + 1;
                    while bytes.get(next).is_some_and(u8::is_ascii_whitespace) {
                        next += 1;
                    }
                }
            }
            if matches!(
                bytes.get(next),
                Some(b'(' | b',' | b')' | b';' | b'}' | b']')
            ) && seen.insert(name.to_owned())
            {
                references.push(name.to_owned());
            }
            continue;
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    references
}

fn free_function_declaration_end(source: &str, start: usize) -> Option<usize> {
    let bytes = source.as_bytes();
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut index = start;
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        match bytes[index] {
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' | b'}' if parentheses == 0 && brackets == 0 => return None,
            b';' if parentheses == 0 && brackets == 0 => {
                return Some(index + 1);
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

#[derive(Debug)]
struct DefaultedFreeFunctionSignature {
    start: usize,
    signature_end: usize,
    name: String,
    namespace: Vec<String>,
    default_argument_ranges: Vec<(usize, usize)>,
}

#[derive(Debug)]
struct FreeFunctionMatchCandidate {
    start: usize,
    open_parenthesis: usize,
    name: String,
}

fn free_function_matches(source: &str, pattern: &Regex) -> Vec<FreeFunctionMatchCandidate> {
    let mut boundaries = Vec::with_capacity(source.len() / 32 + 1);
    boundaries.push(0usize);
    boundaries.extend(source.bytes().enumerate().filter_map(|(index, byte)| {
        matches!(byte, b'\n' | b';' | b'{' | b'}').then_some(index + 1)
    }));
    let candidates = boundaries
        .into_iter()
        .filter_map(|boundary| {
            let captures = pattern.captures(source.get(boundary..)?)?;
            let declaration = captures.name("declaration")?;
            let matched = captures.get(0)?;
            let name = captures.name("name")?;
            let start = boundary.checked_add(declaration.start())?;
            if !is_code_position(source, start) || !namespace_scope_at(source, start) {
                return None;
            }
            Some(FreeFunctionMatchCandidate {
                start,
                open_parenthesis: boundary.checked_add(matched.end().checked_sub(1)?)?,
                name: name.as_str().to_owned(),
            })
        })
        .collect::<Vec<_>>();
    let mut selected = Vec::<FreeFunctionMatchCandidate>::new();
    for candidate in candidates {
        if selected.last().is_some_and(|previous| {
            candidate.start > previous.start && candidate.start < previous.open_parenthesis
        }) {
            continue;
        }
        selected.push(candidate);
    }
    selected
}

fn default_argument_range_in_parameter(
    source: &str,
    parameter_start: usize,
    parameter_end: usize,
) -> Option<(usize, usize)> {
    let bytes = source.as_bytes();
    let mut angles = 0usize;
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut braces = 0usize;
    let mut index = parameter_start;
    while index < parameter_end {
        if let Some(end) = skipped_non_code(source, index) {
            index = end.min(parameter_end);
            continue;
        }
        match bytes[index] {
            b'<' => angles += 1,
            b'>' => angles = angles.saturating_sub(1),
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' => braces += 1,
            b'}' => braces = braces.saturating_sub(1),
            b'=' if angles == 0
                && parentheses == 0
                && brackets == 0
                && braces == 0
                && !matches!(
                    bytes.get(index.wrapping_sub(1)),
                    Some(b'=' | b'!' | b'<' | b'>')
                )
                && bytes.get(index + 1) != Some(&b'=') =>
            {
                let mut start = index;
                while start > parameter_start && bytes[start - 1].is_ascii_whitespace() {
                    start -= 1;
                }
                let mut end = parameter_end;
                while end > index + 1 && bytes[end - 1].is_ascii_whitespace() {
                    end -= 1;
                }
                return Some((start, end));
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

fn top_level_default_argument_ranges(
    source: &str,
    parameters_start: usize,
    parameters_end: usize,
) -> Vec<(usize, usize)> {
    let bytes = source.as_bytes();
    let mut ranges = Vec::new();
    let mut parameter_start = parameters_start;
    let mut angles = 0usize;
    let mut parentheses = 0usize;
    let mut brackets = 0usize;
    let mut braces = 0usize;
    let mut index = parameters_start;
    while index < parameters_end {
        if let Some(end) = skipped_non_code(source, index) {
            index = end.min(parameters_end);
            continue;
        }
        match bytes[index] {
            b'<' => angles += 1,
            b'>' => angles = angles.saturating_sub(1),
            b'(' => parentheses += 1,
            b')' => parentheses = parentheses.saturating_sub(1),
            b'[' => brackets += 1,
            b']' => brackets = brackets.saturating_sub(1),
            b'{' => braces += 1,
            b'}' => braces = braces.saturating_sub(1),
            b',' if angles == 0 && parentheses == 0 && brackets == 0 && braces == 0 => {
                if let Some(range) =
                    default_argument_range_in_parameter(source, parameter_start, index)
                {
                    ranges.push(range);
                }
                parameter_start = index + 1;
            }
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    if let Some(range) =
        default_argument_range_in_parameter(source, parameter_start, parameters_end)
    {
        ranges.push(range);
    }
    ranges
}

fn function_signature_without_defaults(
    source: &str,
    start: usize,
    end: usize,
    default_argument_ranges: &[(usize, usize)],
) -> Option<String> {
    let mut stripped = String::with_capacity(end.checked_sub(start)?);
    let mut cursor = start;
    for &(range_start, range_end) in default_argument_ranges {
        if range_start < cursor || range_end < range_start || range_end > end {
            return None;
        }
        stripped.push_str(source.get(cursor..range_start)?);
        cursor = range_end;
    }
    stripped.push_str(source.get(cursor..end)?);
    Some(stripped.trim().to_owned())
}

fn canonical_function_signature_without_defaults(
    source: &str,
    start: usize,
    end: usize,
    default_argument_ranges: &[(usize, usize)],
) -> Option<String> {
    let signature =
        function_signature_without_defaults(source, start, end, default_argument_ranges)?;
    let collapsed = source_without_comments_preserving_literals(&signature)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let mut canonical = String::with_capacity(collapsed.len());
    for character in collapsed.chars() {
        let punctuation = matches!(character, '(' | ')' | ',' | '*' | '&' | '<' | '>');
        if punctuation {
            while canonical.ends_with(' ') {
                canonical.pop();
            }
            canonical.push(character);
        } else if character != ' '
            || !canonical
                .chars()
                .last()
                .is_some_and(|previous| matches!(previous, '(' | ')' | ',' | '*' | '&' | '<' | '>'))
        {
            canonical.push(character);
        }
    }
    let canonical = canonical.trim().to_owned();
    (!canonical.is_empty()).then_some(canonical)
}

fn repeated_default_argument_ranges_in_source(
    source: &str,
    pattern: &Regex,
) -> Vec<SourceTextRangeCandidate> {
    let mut declarations = Vec::new();
    let mut definitions = Vec::new();
    for matched in free_function_matches(source, pattern) {
        let open_parenthesis = matched.open_parenthesis;
        let Some(close_parenthesis) = matching_delimiter(source, open_parenthesis, b'(', b')')
        else {
            continue;
        };
        let default_argument_ranges =
            top_level_default_argument_ranges(source, open_parenthesis + 1, close_parenthesis);
        if default_argument_ranges.is_empty() {
            continue;
        }
        let namespace = namespace_at(source, matched.start);
        if let Some(end) = free_function_declaration_end(source, close_parenthesis + 1) {
            declarations.push(DefaultedFreeFunctionSignature {
                start: matched.start,
                signature_end: end - 1,
                name: matched.name.clone(),
                namespace,
                default_argument_ranges,
            });
            continue;
        }
        let Some(open) = source[close_parenthesis + 1..]
            .find('{')
            .map(|offset| close_parenthesis + 1 + offset)
        else {
            continue;
        };
        if source[close_parenthesis + 1..open].contains(';') {
            continue;
        }
        definitions.push(DefaultedFreeFunctionSignature {
            start: matched.start,
            signature_end: open,
            name: matched.name,
            namespace,
            default_argument_ranges,
        });
    }

    let mut ranges = Vec::new();
    for definition in definitions {
        let Some(expected) = canonical_function_signature_without_defaults(
            source,
            definition.start,
            definition.signature_end,
            &definition.default_argument_ranges,
        ) else {
            continue;
        };
        let declared = declarations.iter().any(|declaration| {
            declaration.start < definition.start
                && declaration.name == definition.name
                && declaration.namespace == definition.namespace
                && canonical_function_signature_without_defaults(
                    source,
                    declaration.start,
                    declaration.signature_end,
                    &declaration.default_argument_ranges,
                )
                .is_some_and(|candidate| candidate == expected)
        });
        if !declared {
            continue;
        }
        ranges.extend(
            definition
                .default_argument_ranges
                .into_iter()
                .map(|(start, end)| SourceTextRangeCandidate {
                    start: source[..start].encode_utf16().count(),
                    end: source[..end].encode_utf16().count(),
                }),
        );
    }
    ranges.sort_by_key(|range| range.start);
    ranges
}

fn free_function_declarations_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<FreeFunctionDeclarationCandidate> {
    free_function_matches(source, pattern)
        .into_iter()
        .filter_map(|matched| {
            let open_parenthesis = matched.open_parenthesis;
            let close_parenthesis = matching_delimiter(source, open_parenthesis, b'(', b')')?;
            let end = free_function_declaration_end(source, close_parenthesis + 1)?;
            Some(FreeFunctionDeclarationCandidate {
                file: file.to_owned(),
                start: source[..matched.start].encode_utf16().count(),
                end: source[..end].encode_utf16().count(),
                name: matched.name,
                namespace: namespace_at(source, matched.start),
            })
        })
        .collect()
}

fn free_function_definitions_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<FreeFunctionDefinitionCandidate> {
    free_function_matches(source, pattern)
        .into_iter()
        .filter_map(|matched| {
            let open_parenthesis = matched.open_parenthesis;
            let close_parenthesis = matching_delimiter(source, open_parenthesis, b'(', b')')?;
            let open = source[close_parenthesis + 1..]
                .find('{')
                .map(|offset| close_parenthesis + 1 + offset)?;
            if source[close_parenthesis + 1..open].contains(';') {
                return None;
            }
            let close = matching_delimiter(source, open, b'{', b'}')?;
            let definition = &source[matched.start..close + 1];
            let signature = normalized_definition_signature(source, matched.start, open)?;
            let default_argument_ranges =
                top_level_default_argument_ranges(source, open_parenthesis + 1, close_parenthesis);
            let declaration_signature = function_signature_without_defaults(
                source,
                matched.start,
                open,
                &default_argument_ranges,
            )?;
            Some(FreeFunctionDefinitionCandidate {
                file: file.to_owned(),
                start: source[..matched.start].encode_utf16().count(),
                end: source[..close + 1].encode_utf16().count(),
                name: matched.name,
                namespace: namespace_at(source, matched.start),
                signature,
                declaration_signature,
                references: free_function_references(definition),
            })
        })
        .collect()
}

fn lexical_scope_at(
    source: &str,
    target: usize,
    type_pattern: &Regex,
) -> (Vec<String>, Vec<TypeOwnerCandidate>) {
    struct ScopeFrame {
        namespaces: usize,
        owner: bool,
    }

    let bytes = source.as_bytes();
    let mut namespace = Vec::new();
    let mut owners = Vec::new();
    let mut frames = Vec::new();
    let mut index = 0usize;
    while index < target.min(bytes.len()) {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index] == b'{' {
            let names = namespace_before_brace(source, index);
            let owner = if names.is_empty() {
                type_before_brace(source, index, type_pattern)
            } else {
                None
            };
            let has_owner = owner.is_some();
            namespace.extend(names.iter().cloned());
            if let Some(owner) = owner {
                owners.push(owner);
            }
            frames.push(ScopeFrame {
                namespaces: names.len(),
                owner: has_owner,
            });
        } else if bytes[index] == b'}' {
            if let Some(frame) = frames.pop() {
                namespace.truncate(namespace.len().saturating_sub(frame.namespaces));
                if frame.owner {
                    owners.pop();
                }
            }
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    (namespace, owners)
}

fn candidates_in_source(source: &str, file: &Path) -> Vec<ModelFactoryCandidate> {
    let bytes = source.as_bytes();
    let mut candidates = Vec::new();
    let mut index = 0;
    let mut namespace = Vec::<String>::new();
    let mut braces = Vec::<Vec<String>>::new();
    while index < bytes.len() {
        if let Some(end) = skipped_non_code(source, index) {
            index = end;
            continue;
        }
        if bytes[index].is_ascii_alphabetic() || bytes[index] == b'_' {
            let start = index;
            index += 1;
            while index < bytes.len()
                && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'_')
            {
                index += 1;
            }
            let identifier = &source[start..index];
            let mut next = index;
            while bytes.get(next).is_some_and(u8::is_ascii_whitespace) {
                next += 1;
            }
            if identifier.starts_with("create")
                && identifier.ends_with("Model")
                && identifier["create".len()..identifier.len() - "Model".len()]
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
                && bytes.get(next) == Some(&b'<')
            {
                if let Some(template_close) = matching_delimiter(source, next, b'<', b'>') {
                    let mut call_open = template_close + 1;
                    while bytes.get(call_open).is_some_and(u8::is_ascii_whitespace) {
                        call_open += 1;
                    }
                    if let Some(call_close) = matching_delimiter(source, call_open, b'(', b')') {
                        let template_source = &source[next + 1..template_close];
                        let call_source = &source[call_open + 1..call_close];
                        candidates.push(ModelFactoryCandidate {
                            file: file.to_owned(),
                            start: source[..start].encode_utf16().count(),
                            factory: identifier.to_owned(),
                            template_source: template_source.to_owned(),
                            call_source: call_source.to_owned(),
                            template_arguments: top_level_parts(template_source, b',')
                                .into_iter()
                                .map(str::trim)
                                .filter(|argument| !argument.is_empty())
                                .map(str::to_owned)
                                .collect(),
                            call_arguments: top_level_parts(call_source, b',')
                                .into_iter()
                                .map(str::trim)
                                .filter(|argument| !argument.is_empty())
                                .map(str::to_owned)
                                .collect(),
                            namespace: namespace.clone(),
                            registered_module_type: None,
                            widget_namespace: Vec::new(),
                            context_files: vec![file.to_owned()],
                        });
                    }
                }
            }
            continue;
        }
        if bytes[index] == b'{' {
            let names = namespace_before_brace(source, index);
            namespace.extend(names.iter().cloned());
            braces.push(names);
        } else if bytes[index] == b'}' {
            if let Some(names) = braces.pop() {
                namespace.truncate(namespace.len().saturating_sub(names.len()));
            }
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    candidates
}

fn registration_context_files(
    file: &Path,
    directives: &[IncludeDirectiveCandidate],
) -> Vec<PathBuf> {
    let mut by_file = HashMap::<PathBuf, Vec<PathBuf>>::new();
    for directive in directives {
        if directive.angle {
            continue;
        }
        if let Some(target) = &directive.target {
            by_file
                .entry(directive.file.clone())
                .or_default()
                .push(target.clone());
        }
    }
    let mut files = Vec::new();
    let mut queue = VecDeque::from([file.to_owned()]);
    let mut seen = HashSet::new();
    while let Some(current) = queue.pop_front() {
        if files.len() >= 256 || !seen.insert(current.clone()) {
            continue;
        }
        files.push(current.clone());
        queue.extend(by_file.get(&current).into_iter().flatten().cloned());
    }
    files
}

fn type_terminal(source: &str) -> Option<&str> {
    let before_template = source.split('<').next()?.trim();
    before_template
        .rsplit("::")
        .next()
        .map(str::trim)
        .filter(|name| !name.is_empty())
}

fn widget_module_type(base: &str) -> Option<String> {
    let open = base.find('<')?;
    let close = matching_delimiter(base, open, b'<', b'>')?;
    let widget_base = type_terminal(&base[..open])?;
    let mut bytes = widget_base.bytes();
    if !bytes
        .next()
        .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        || !bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        || !widget_base.contains("Widget")
    {
        return None;
    }
    top_level_parts(&base[open + 1..close], b',')
        .first()
        .map(|module| module.trim().to_owned())
        .filter(|module| !module.is_empty())
}

fn resolve_widget_model_candidates(
    candidates: &mut [ModelFactoryCandidate],
    declarations: &[TypeDeclarationCandidate],
    directives: &[IncludeDirectiveCandidate],
) {
    for candidate in candidates {
        candidate.context_files = registration_context_files(&candidate.file, directives);
        if candidate.template_arguments.len() == 2 {
            candidate.registered_module_type = candidate.template_arguments.first().cloned();
            continue;
        }
        let Some(widget_type) = candidate.template_arguments.first() else {
            continue;
        };
        let Some(widget_terminal) = type_terminal(widget_type) else {
            continue;
        };
        let explicit_scope = widget_type
            .split('<')
            .next()
            .unwrap_or(widget_type)
            .trim_start_matches("::")
            .split("::")
            .collect::<Vec<_>>();
        let explicit_scope = &explicit_scope[..explicit_scope.len().saturating_sub(1)];
        let reachable = candidate
            .context_files
            .iter()
            .enumerate()
            .map(|(index, file)| (file, index))
            .collect::<HashMap<_, _>>();
        let mut matches = declarations
            .iter()
            .filter(|declaration| {
                declaration.name == widget_terminal
                    && declaration.owners.is_empty()
                    && reachable.contains_key(&declaration.file)
            })
            .collect::<Vec<_>>();
        matches.sort_by_key(|declaration| reachable[&declaration.file]);
        let expected_relative = candidate
            .namespace
            .iter()
            .map(String::as_str)
            .chain(explicit_scope.iter().copied())
            .collect::<Vec<_>>();
        let declaration = matches
            .iter()
            .copied()
            .find(|declaration| {
                !explicit_scope.is_empty()
                    && declaration
                        .namespace
                        .iter()
                        .map(String::as_str)
                        .eq(explicit_scope.iter().copied())
            })
            .or_else(|| {
                matches.iter().copied().find(|declaration| {
                    !explicit_scope.is_empty()
                        && declaration
                            .namespace
                            .iter()
                            .map(String::as_str)
                            .eq(expected_relative.iter().copied())
                })
            })
            .or_else(|| (matches.len() == 1).then(|| matches[0]));
        let Some(declaration) = declaration else {
            continue;
        };
        candidate.registered_module_type = declaration
            .bases
            .iter()
            .find_map(|base| widget_module_type(base));
        candidate.widget_namespace = declaration.namespace.clone();
    }
}

fn first_code_capture_in_range(
    source: &str,
    start: usize,
    end: usize,
    pattern: &Regex,
    name: &str,
) -> Option<String> {
    pattern
        .captures_iter(source.get(start..end)?)
        .find_map(|captures| {
            let whole = captures.get(0)?;
            is_code_position(source, start + whole.start())
                .then(|| {
                    captures
                        .name(name)
                        .map(|value| value.as_str().trim().to_owned())
                })
                .flatten()
        })
}

struct CustomModelPatterns<'a> {
    assignment: &'a Regex,
    new_type: &'a Regex,
    slug: &'a Regex,
    create_module: &'a Regex,
    widget_factory: &'a Regex,
}

fn custom_model_candidates_in_source(
    source: &str,
    file: &Path,
    declarations: &[TypeDeclarationCandidate],
    patterns: &CustomModelPatterns<'_>,
) -> Vec<CustomModelFactoryCandidate> {
    let mut candidates = Vec::new();
    for captures in patterns.assignment.captures_iter(source) {
        let Some(assignment) = captures.get(0) else {
            continue;
        };
        if !is_code_position(source, assignment.start()) {
            continue;
        }
        let lambda_open = assignment.end().saturating_sub(1);
        let Some(lambda_close) = matching_delimiter(source, lambda_open, b'{', b'}') else {
            continue;
        };
        let Some(variable_slug) = captures
            .name("variable")
            .map(|value| value.as_str().to_owned())
        else {
            continue;
        };
        let Some(model_type) = first_code_capture_in_range(
            source,
            lambda_open + 1,
            lambda_close,
            patterns.new_type,
            "type",
        ) else {
            continue;
        };
        let parts = model_type.split("::").collect::<Vec<_>>();
        let Some(terminal) = parts.last().copied() else {
            continue;
        };
        let registration_namespace = namespace_at(source, assignment.start());
        let explicit_scope = &parts[..parts.len().saturating_sub(1)];
        let declaration = declarations
            .iter()
            .filter(|candidate| candidate.name == terminal && candidate.owners.is_empty())
            .find(|candidate| {
                !explicit_scope.is_empty()
                    && candidate
                        .namespace
                        .iter()
                        .map(String::as_str)
                        .eq(explicit_scope.iter().copied())
            })
            .or_else(|| {
                declarations.iter().find(|candidate| {
                    candidate.name == terminal
                        && candidate.owners.is_empty()
                        && candidate.namespace == registration_namespace
                })
            })
            .or_else(|| {
                declarations
                    .iter()
                    .find(|candidate| candidate.name == terminal && candidate.owners.is_empty())
            });
        let Some(declaration) = declaration else {
            continue;
        };
        let declaration_body_start = byte_index_for_utf16(source, declaration.body_start);
        let declaration_body_end = byte_index_for_utf16(source, declaration.body_end);
        let create_module = patterns
            .create_module
            .find_iter(
                source
                    .get(declaration_body_start..declaration_body_end)
                    .unwrap_or_default(),
            )
            .find(|candidate| is_code_position(source, declaration_body_start + candidate.start()));
        let Some(create_module) = create_module else {
            continue;
        };
        let create_open = declaration_body_start + create_module.end().saturating_sub(1);
        let Some(create_close) = matching_delimiter(source, create_open, b'{', b'}') else {
            continue;
        };
        let Some(module_type) = first_code_capture_in_range(
            source,
            create_open + 1,
            create_close,
            patterns.new_type,
            "type",
        ) else {
            continue;
        };
        let widget_class = patterns
            .widget_factory
            .captures_iter(
                source
                    .get(declaration_body_start..declaration_body_end)
                    .unwrap_or_default(),
            )
            .find_map(|widget| {
                let whole = widget.get(0)?;
                let absolute = declaration_body_start + whole.start();
                if !is_code_position(source, absolute) {
                    return None;
                }
                let factory = widget.name("factory")?.as_str();
                (factory != "createModuleWidget")
                    .then(|| factory.strip_prefix("create").map(str::to_owned))
                    .flatten()
            });
        candidates.push(CustomModelFactoryCandidate {
            file: file.to_owned(),
            start: source[..assignment.start()].encode_utf16().count(),
            variable_slug,
            slug_source: first_code_capture_in_range(
                source,
                lambda_open + 1,
                lambda_close,
                patterns.slug,
                "expression",
            ),
            model_type,
            module_type,
            widget_class,
            namespace: registration_namespace,
        });
    }
    candidates
}

fn meta_module_candidates_in_source(
    source: &str,
    file: &Path,
    generic_pattern: &Regex,
    tail_pattern: &Regex,
    variable_pattern: &Regex,
) -> Vec<MetaModuleFactoryCandidate> {
    let mut candidates = Vec::new();
    for generic in generic_pattern.find_iter(source) {
        if !is_code_position(source, generic.start()) {
            continue;
        }
        let template_open = generic.end().saturating_sub(1);
        let Some(template_close) = matching_delimiter(source, template_open, b'<', b'>') else {
            continue;
        };
        let Some(tail) = tail_pattern.find(source.get(template_close + 1..).unwrap_or_default())
        else {
            continue;
        };
        let prefix_start = generic.start().saturating_sub(160);
        let prefix = &source[prefix_start..generic.start()];
        let Some(variable) = variable_pattern
            .captures(prefix)
            .and_then(|captures| captures.name("variable"))
        else {
            continue;
        };
        let template_source = &source[template_open + 1..template_close];
        let template_arguments = top_level_parts(template_source, b',')
            .into_iter()
            .map(str::trim)
            .filter(|argument| !argument.is_empty())
            .map(str::to_owned)
            .collect::<Vec<_>>();
        if !matches!(template_arguments.len(), 1 | 2) {
            continue;
        }
        let _end = template_close + 1 + tail.end();
        candidates.push(MetaModuleFactoryCandidate {
            file: file.to_owned(),
            start: source[..generic.start()].encode_utf16().count(),
            variable_slug: variable.as_str().to_owned(),
            template_source: template_source.to_owned(),
            template_arguments,
            namespace: namespace_at(source, generic.start()),
        });
    }
    candidates
}

fn is_code_position(source: &str, target: usize) -> bool {
    let mut index = 0;
    while index < target {
        if let Some(end) = skipped_non_code(source, index) {
            if target < end {
                return false;
            }
            index = end;
        } else {
            index += source[index..].chars().next().map_or(1, char::len_utf8);
        }
    }
    true
}

fn string_constants_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<StringConstantCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            if !is_code_position(source, matched.start()) {
                return None;
            }
            let name = captures.get(1)?;
            let expression = captures.get(2)?;
            let expression_source = expression.as_str();
            let normalized = expression_source
                .trim()
                .strip_prefix('{')
                .and_then(|value| value.strip_suffix('}'))
                .map(str::trim)
                .unwrap_or(expression_source);
            Some(StringConstantCandidate {
                file: file.to_owned(),
                start: source[..name.start()].encode_utf16().count(),
                name: name.as_str().to_owned(),
                expression: expression_source.to_owned(),
                value: evaluate_static_string(normalized),
            })
        })
        .collect()
}

fn numeric_constant_values(constants: &BTreeMap<String, Value>) -> BTreeMap<String, f64> {
    constants
        .iter()
        .filter_map(|(name, value)| {
            value
                .as_f64()
                .filter(|value| value.is_finite())
                .map(|value| (name.clone(), value))
        })
        .collect()
}

fn insert_numeric_constant(
    constants: &mut BTreeMap<String, Value>,
    numbers: &mut BTreeMap<String, f64>,
    name: &str,
    value: i64,
) {
    constants.insert(name.to_owned(), Value::from(value));
    numbers.insert(name.to_owned(), value as f64);
}

fn record_enum_constants(
    declaration: &EnumDeclarationCandidate,
    constants: &mut BTreeMap<String, Value>,
    numbers: &mut BTreeMap<String, f64>,
    mut record: impl FnMut(&str, i64),
) {
    let mut value = 0i64;
    for identifier in &declaration.identifiers {
        match identifier {
            EnumIdentifierCandidate::Name(name) => {
                if let Some(expression) = declaration.assignments.get(name) {
                    value = numeric_expression(expression, numbers).unwrap_or(value);
                }
                if value >= 0 {
                    record(name, value);
                    if declaration.name.is_some() {
                        insert_numeric_constant(constants, numbers, name, value);
                    }
                }
                value = value.saturating_add(1);
            }
            EnumIdentifierCandidate::Repeated { base, count } => {
                if value >= 0 {
                    record(base, value);
                    if declaration.name.is_some() {
                        insert_numeric_constant(constants, numbers, base, value);
                    }
                }
                let repeated = numeric_expression(count, numbers).unwrap_or(0).max(0);
                value = value.saturating_add(repeated);
            }
        }
    }
}

fn brace_depth_at(source: &str, target: usize) -> usize {
    let bytes = source.as_bytes();
    let mut depth = 0usize;
    let mut index = 0usize;
    while index < target.min(bytes.len()) {
        if let Some(end) = skipped_non_code(source, index) {
            index = end.min(target);
            continue;
        }
        match bytes[index] {
            b'{' => depth = depth.saturating_add(1),
            b'}' => depth = depth.saturating_sub(1),
            _ => {}
        }
        index += source[index..].chars().next().map_or(1, char::len_utf8);
    }
    depth
}

fn record_member_array_constants(
    source: &str,
    owner: &str,
    pattern: &Regex,
    string_pattern: &Regex,
    constants: &mut BTreeMap<String, Value>,
    numbers: &mut BTreeMap<String, f64>,
) {
    for captures in pattern.captures_iter(source) {
        let Some(matched) = captures.get(0) else {
            continue;
        };
        if !is_code_position(source, matched.start())
            || brace_depth_at(source, matched.start()) != 0
        {
            continue;
        }
        let Some(name) = captures.get(1).map(|value| value.as_str()) else {
            continue;
        };
        let Some(relative_open) = matched.as_str().rfind('{') else {
            continue;
        };
        let open = matched.start() + relative_open;
        let Some(close) = matching_delimiter(source, open, b'{', b'}') else {
            continue;
        };
        let items = enum_top_level_parts(&source[open + 1..close])
            .into_iter()
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>();
        let size_name = format!("{owner}::{name}.size()");
        if !constants.contains_key(&size_name) {
            constants.insert(size_name.clone(), Value::from(items.len()));
            numbers.insert(size_name, items.len() as f64);
        }
        for (index, item) in items.into_iter().enumerate() {
            let Some(literal) = string_pattern.find(item) else {
                continue;
            };
            let Ok(value) = serde_json::from_str::<String>(literal.as_str()) else {
                continue;
            };
            constants
                .entry(format!("{owner}::{name}[{index}].name"))
                .or_insert_with(|| Value::from(value));
        }
    }
}

pub fn numeric_constants(
    request: &NumericConstantRequest,
) -> Result<NumericConstantReport, String> {
    if request.source.len() > 64 * 1024 * 1024 || request.source.contains('\0') {
        return Err("Numeric-constant source is invalid".to_owned());
    }
    if request.initial.len() > 65_536
        || request
            .initial
            .keys()
            .any(|name| name.is_empty() || name.len() > 4_096 || name.contains('\0'))
    {
        return Err("Numeric-constant initial values are invalid".to_owned());
    }
    if request.owner.as_ref().is_some_and(|owner| {
        owner.is_empty()
            || owner.len() > 4_096
            || !owner.bytes().enumerate().all(|(index, byte)| {
                byte == b'_' || byte.is_ascii_alphabetic() || (index > 0 && byte.is_ascii_digit())
            })
    }) {
        return Err("Numeric-constant owner is invalid".to_owned());
    }
    let source = &request.source;
    let mut constants = BTreeMap::from([("PORT_MAX_CHANNELS".to_owned(), Value::from(16))]);
    constants.extend(request.initial.clone());
    if Regex::new(r"\bn_osc_params\b")
        .expect("oscillator constant pattern should compile")
        .is_match(source)
    {
        constants.insert("n_osc_params".to_owned(), Value::from(7));
    }
    let mut numbers = numeric_constant_values(&constants);
    let object_pattern = Regex::new(r"(?m)^[\t ]*#define[\t ]+([A-Za-z_]\w*)([^\n\\]*)[\t ]*$")
        .map_err(|error| format!("Could not compile numeric macro analysis: {error}"))?;
    let macros = object_macro_definitions(source, &object_pattern);
    let type_pattern = Regex::new(
        r"(?s)^\s*(?:(?:\#[^\n]*|//[^\n]*|/\*.*?\*/)\s*)*(?:template\s*<(?P<template>[^{};]*)>\s*)?(?P<kind>struct|class|union)\s+(?P<name>[A-Za-z_]\w*)\b(?P<tail>[^{};]*)$",
    )
    .map_err(|error| format!("Could not compile numeric type analysis: {error}"))?;
    let enum_macro_pattern = Regex::new(
        r"(?s)^(?P<macro>ENUMS|MULTIPLE|PER_CHANNEL|PER_STEP|ONE_PER_STEP|TWO_PER_STEP|PER_INPUT|TWO_OF)\s*\((?P<arguments>.*)\)$",
    )
    .map_err(|error| format!("Could not compile numeric enum-macro analysis: {error}"))?;
    let enum_identifier_pattern =
        Regex::new(r"(?s)^(?P<name>[A-Za-z_]\w*)(?:\s*=\s*(?P<expression>.+))?$")
            .map_err(|error| format!("Could not compile numeric enum analysis: {error}"))?;
    let enum_source = preprocess_conditionals(source, &HashMap::new())?;
    let enumerations = enum_declarations_in_source(
        &enum_source,
        Path::new("<numeric-constants>"),
        &type_pattern,
        &enum_macro_pattern,
        &enum_identifier_pattern,
    );
    let member_array_pattern = Regex::new(
        r#"\b(?:(?:inline|static|constexpr)\s+)*auto\s+([A-Za-z_]\w*)\s*=\s*std::array(?:\s*<[^;{}]+>)?\s*\{"#,
    )
    .map_err(|error| format!("Could not compile member-array analysis: {error}"))?;
    let string_literal_pattern = Regex::new(r#""(?:\\.|[^"\\])*""#)
        .map_err(|error| format!("Could not compile member-array label analysis: {error}"))?;
    for declaration in
        type_declarations_in_source(source, Path::new("<numeric-constants>"), &type_pattern)
    {
        let body_start = byte_index_for_utf16(source, declaration.body_start);
        let body_end = byte_index_for_utf16(source, declaration.body_end);
        record_member_array_constants(
            &source[body_start..body_end],
            &declaration.name,
            &member_array_pattern,
            &string_literal_pattern,
            &mut constants,
            &mut numbers,
        );
    }
    if let Some(owner) = request.owner.as_deref() {
        record_member_array_constants(
            source,
            owner,
            &member_array_pattern,
            &string_literal_pattern,
            &mut constants,
            &mut numbers,
        );
    }
    let scalar_pattern = Regex::new(
        r"\b(?:(?:static\s+)?auto\s+constexpr|constexpr\s+static|static\s+constexpr|static\s+const|const\s+static|constexpr|const)\s+(?:(?:(?:std::)?size_t|int|unsigned(?:\s+int)?)\s+)?([A-Za-z_]\w*)\s*(?:=\s*([^;]+)|\{\s*([^{};]+)\s*\})\s*;",
    )
    .map_err(|error| format!("Could not compile numeric scalar analysis: {error}"))?;
    let multiple_pattern = Regex::new(
        r"\b(?:(?:constexpr\s+static|static\s+constexpr|static\s+const|const\s+static|constexpr|const)\s+)(?:(?:std::)?size_t|int|long|unsigned(?:\s+(?:int|long))?)\s+([^;]+)\s*;",
    )
    .map_err(|error| format!("Could not compile numeric declaration analysis: {error}"))?;
    let multiple_item_pattern =
        Regex::new(r"(?s)^\s*([A-Za-z_]\w*)\s*(?:=\s*(.+)|\{\s*([^{}]+)\s*\})\s*$")
            .map_err(|error| format!("Could not compile numeric item analysis: {error}"))?;
    let global_pattern = Regex::new(
        r"\b(?:int|long|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;{}]+)\s*;",
    )
    .map_err(|error| format!("Could not compile numeric global analysis: {error}"))?;

    for _ in 0..4 {
        for (name, expression) in &macros {
            if let Some(value) =
                numeric_expression(expression, &numbers).filter(|value| *value >= 0)
            {
                insert_numeric_constant(&mut constants, &mut numbers, name, value);
            }
        }
        for declaration in enumerations
            .iter()
            .filter(|declaration| declaration.name.is_some())
        {
            record_enum_constants(
                declaration,
                &mut constants,
                &mut numbers,
                |_name, _value| {},
            );
        }
        let mut anonymous = HashMap::<String, HashSet<i64>>::new();
        for declaration in enumerations
            .iter()
            .filter(|declaration| declaration.name.is_none())
        {
            record_enum_constants(declaration, &mut constants, &mut numbers, |name, value| {
                anonymous.entry(name.to_owned()).or_default().insert(value);
            });
        }
        for (name, values) in anonymous {
            if values.len() == 1 && !constants.contains_key(&name) {
                insert_numeric_constant(
                    &mut constants,
                    &mut numbers,
                    &name,
                    *values.iter().next().unwrap_or(&0),
                );
            }
        }
        for captures in scalar_pattern.captures_iter(source) {
            let Some(name) = captures.get(1).map(|value| value.as_str()) else {
                continue;
            };
            let expression = captures
                .get(2)
                .or_else(|| captures.get(3))
                .map(|value| value.as_str())
                .unwrap_or("");
            if let Some(value) =
                numeric_expression(expression, &numbers).filter(|value| *value >= 0)
            {
                insert_numeric_constant(&mut constants, &mut numbers, name, value);
            }
        }
        for captures in multiple_pattern.captures_iter(source) {
            let Some(declaration) = captures.get(1).map(|value| value.as_str()) else {
                continue;
            };
            for item in enum_top_level_parts(declaration) {
                let Some(item) = multiple_item_pattern.captures(item) else {
                    continue;
                };
                let name = item.get(1).map(|value| value.as_str()).unwrap_or("");
                let expression = item
                    .get(2)
                    .or_else(|| item.get(3))
                    .map(|value| value.as_str())
                    .unwrap_or("");
                if let Some(value) =
                    numeric_expression(expression, &numbers).filter(|value| *value >= 0)
                {
                    insert_numeric_constant(&mut constants, &mut numbers, name, value);
                }
            }
        }
        for captures in global_pattern.captures_iter(source) {
            let Some(matched) = captures.get(0) else {
                continue;
            };
            if !namespace_scope_at(source, matched.start()) {
                continue;
            }
            let name = captures.get(1).map(|value| value.as_str()).unwrap_or("");
            let expression = captures.get(2).map(|value| value.as_str()).unwrap_or("");
            if let Some(value) =
                numeric_expression(expression, &numbers).filter(|value| *value >= 0)
            {
                insert_numeric_constant(&mut constants, &mut numbers, name, value);
            }
        }
    }
    let string_array_pattern = Regex::new(
        r#"\b(?:(?:static|constexpr)\s+)*(?:(?:std::)?string|(?:const\s+)?char\s*\*)\s+([A-Za-z_]\w*)\s*\[[^\]]*\]\s*=\s*\{([^{};]+)\}\s*;"#,
    )
    .map_err(|error| format!("Could not compile string-array analysis: {error}"))?;
    for captures in string_array_pattern.captures_iter(source) {
        let name = captures.get(1).map(|value| value.as_str()).unwrap_or("");
        let values = captures.get(2).map(|value| value.as_str()).unwrap_or("");
        for (index, item) in enum_top_level_parts(values).into_iter().enumerate() {
            if let Ok(value) = serde_json::from_str::<String>(item.trim()) {
                constants.insert(format!("{name}_{index}"), Value::from(value));
            }
        }
    }
    Ok(NumericConstantReport { constants })
}

fn type_aliases_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
    type_pattern: &Regex,
) -> Vec<TypeAliasCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            if !is_code_position(source, matched.start()) {
                return None;
            }
            let (name, target, kind) =
                if let (Some(name), Some(target)) = (captures.get(1), captures.get(2)) {
                    (name, target, "using")
                } else {
                    (captures.get(4)?, captures.get(3)?, "typedef")
                };
            if kind == "typedef" && target.as_str().contains(['{', '}']) {
                return None;
            }
            let (namespace, owners) = lexical_scope_at(source, matched.start(), type_pattern);
            Some(TypeAliasCandidate {
                file: file.to_owned(),
                start: source[..name.start()].encode_utf16().count(),
                declaration_start: source[..matched.start()].encode_utf16().count(),
                declaration_end: source[..matched.end()].encode_utf16().count(),
                name: name.as_str().to_owned(),
                target: target.as_str().trim().to_owned(),
                kind: kind.to_owned(),
                namespace,
                namespace_scope: namespace_scope_at(source, matched.start()),
                owners,
            })
        })
        .collect()
}

fn namespace_constant_declarations_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<NamespaceConstantDeclarationCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            let name = captures.name("name")?;
            if !is_code_position(source, matched.start())
                || !namespace_scope_at(source, matched.start())
            {
                return None;
            }
            Some(NamespaceConstantDeclarationCandidate {
                file: file.to_owned(),
                start: source[..matched.start()].encode_utf16().count(),
                end: source[..matched.end()].encode_utf16().count(),
                name: name.as_str().to_owned(),
                namespace: namespace_at(source, matched.start()),
            })
        })
        .collect()
}

fn namespace_variable_declarations_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<NamespaceVariableDeclarationCandidate> {
    const EXCLUDED_PREFIXES: [&str; 8] = [
        "struct",
        "class",
        "enum",
        "union",
        "namespace",
        "using",
        "typedef",
        "template",
    ];
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let declaration = captures.name("declaration")?;
            let name = captures.name("name")?;
            if !is_code_position(source, declaration.start())
                || !namespace_scope_at(source, declaration.start())
            {
                return None;
            }
            let raw_prefix = declaration.as_str().trim_start();
            let first = raw_prefix.split_whitespace().next()?;
            if EXCLUDED_PREFIXES.contains(&first) {
                return None;
            }
            let cursor = skip_space_and_comments(source, declaration.end());
            let initializer = *source.as_bytes().get(cursor)?;
            if !matches!(initializer, b'=' | b'{' | b';') {
                return None;
            }
            let end = namespace_statement_end(source, cursor)?;
            let initialized = initializer != b';';
            let mut type_source = source[declaration.start()..name.start()].trim().to_owned();
            if let Some(rest) = type_source.strip_prefix("extern") {
                if rest.starts_with(char::is_whitespace) {
                    type_source = rest.trim_start().to_owned();
                }
            }
            if type_source.is_empty() {
                return None;
            }
            Some(NamespaceVariableDeclarationCandidate {
                file: file.to_owned(),
                start: source[..declaration.start()].encode_utf16().count(),
                end: source[..end].encode_utf16().count(),
                name_start: source[..name.start()].encode_utf16().count(),
                declarator_end: source[..declaration.end()].encode_utf16().count(),
                name: name.as_str().to_owned(),
                namespace: namespace_at(source, declaration.start()),
                type_source,
                array_extent: source[name.end()..declaration.end()].trim().to_owned(),
                c_linkage: c_linkage_at(source, declaration.start()),
                initialized,
                extern_declaration: first == "extern" && !initialized,
            })
        })
        .collect()
}

fn namespace_using_declarations_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<NamespaceUsingDeclarationCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            let target = captures.name("target")?;
            if !is_code_position(source, matched.start())
                || !namespace_scope_at(source, matched.start())
            {
                return None;
            }
            Some(NamespaceUsingDeclarationCandidate {
                file: file.to_owned(),
                start: source[..matched.start()].encode_utf16().count(),
                end: source[..matched.end()].encode_utf16().count(),
                target: target.as_str().to_owned(),
                namespace: namespace_at(source, matched.start()),
            })
        })
        .collect()
}

fn namespace_using_directives_in_source(
    source: &str,
    file: &Path,
    pattern: &Regex,
) -> Vec<NamespaceUsingDirectiveCandidate> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let matched = captures.get(0)?;
            let target = captures.name("target")?;
            if !is_code_position(source, matched.start())
                || !namespace_scope_at(source, matched.start())
            {
                return None;
            }
            Some(NamespaceUsingDirectiveCandidate {
                file: file.to_owned(),
                start: source[..matched.start()].encode_utf16().count(),
                end: source[..matched.end()].encode_utf16().count(),
                target: target.as_str().to_owned(),
                namespace: namespace_at(source, matched.start()),
            })
        })
        .collect()
}

fn type_declaration_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?s)^\s*(?:(?:\#[^\n]*|//[^\n]*|/\*.*?\*/)\s*)*(?:template\s*<(?P<template>[^{};]*)>\s*)?(?P<kind>struct|class|union)\s+(?P<name>[A-Za-z_]\w*)\b(?P<tail>[^{};]*)$"#,
    )
    .map_err(|error| format!("Could not compile type-scope analysis: {error}"))
}

fn enum_macro_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?s)^(?P<macro>ENUMS|MULTIPLE|PER_CHANNEL|PER_STEP|ONE_PER_STEP|TWO_PER_STEP|PER_INPUT|TWO_OF)\s*\((?P<arguments>.*)\)$"#,
    )
    .map_err(|error| format!("Could not compile enum-macro analysis: {error}"))
}

fn enum_identifier_pattern() -> Result<Regex, String> {
    Regex::new(r#"(?s)^(?P<name>[A-Za-z_]\w*)(?:\s*=\s*(?P<expression>.+))?$"#)
        .map_err(|error| format!("Could not compile enum-identifier analysis: {error}"))
}

fn config_loop_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"\bfor\s*\(\s*(?:int|long|auto|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+(?P<variable>[A-Za-z_]\w*)\s*=\s*(?P<start>[^;]+)\s*;\s*(?P<condition_variable>[A-Za-z_]\w*)\s*<\s*(?P<end>[^;]+)\s*;[^)]*\)\s*\{"#,
    )
    .map_err(|error| format!("Could not compile config-loop analysis: {error}"))
}

fn config_binding_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"\b(?:auto|(?:std::)?string)\s+(?P<name>[A-Za-z_]\w*)\s*=\s*(?P<expression>[^;]+)\s*;"#,
    )
    .map_err(|error| format!("Could not compile config-binding analysis: {error}"))
}

fn config_snap_patterns() -> Result<[Regex; 2], String> {
    let quantity = Regex::new(
        r#"\bparamQuantities\s*\[\s*(?P<argument>[^\]]+?)\s*\]\s*->\s*snapEnabled\s*=\s*true\s*;"#,
    )
    .map_err(|error| format!("Could not compile parameter-snap analysis: {error}"))?;
    let getter = Regex::new(
        r#"\b(?:[A-Za-z_]\w*\s*->\s*)?getParamQuantity\s*\(\s*(?P<argument>[^)]+?)\s*\)\s*->\s*snapEnabled\s*=\s*true\s*;"#,
    )
    .map_err(|error| format!("Could not compile parameter-snap analysis: {error}"))?;
    Ok([quantity, getter])
}

fn type_alias_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"\b(?:using\s+([A-Za-z_]\w*)\s*=\s*([^;]+?)|typedef\s+([^;]+?)\s+([A-Za-z_]\w*))\s*;"#,
    )
    .map_err(|error| format!("Could not compile type-alias analysis: {error}"))
}

fn namespace_constant_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?m)^[\t ]*(?:(?:inline|static)\s+)*(?:constexpr\s+|const\s+)[^\n;{}=]+?\s+(?P<name>[A-Za-z_]\w*)\s*=\s*[^;{}]+;"#,
    )
    .map_err(|error| format!("Could not compile namespace-constant analysis: {error}"))
}

fn namespace_variable_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?m)(?:^|[;{}])(?P<declaration>[\t ]*(?:(?:extern|static|inline|constexpr|const|volatile|thread_local|unsigned|signed|long|short)\s+)*(?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+>)?)(?:\s*[*&]\s*|\s+)(?P<name>[A-Za-z_]\w*)\s*(?:\[[^\]\n]*\]\s*)*)"#,
    )
    .map_err(|error| format!("Could not compile namespace-variable analysis: {error}"))
}

fn namespace_using_pattern() -> Result<Regex, String> {
    Regex::new(r#"(?m)^[\t ]*using\s+(?P<target>[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+)\s*;"#)
        .map_err(|error| format!("Could not compile namespace-using analysis: {error}"))
}

fn namespace_using_directive_pattern() -> Result<Regex, String> {
    Regex::new(r#"\busing\s+namespace\s+(?P<target>[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*;"#)
        .map_err(|error| format!("Could not compile namespace-using-directive analysis: {error}"))
}

fn out_of_line_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?x)
        \b(?P<qualified>
            [A-Za-z_]\w*(?:\s*<[^;{}]+?>)?
            (?:\s*::\s*[A-Za-z_]\w*(?:\s*<[^;{}]+?>)?)*
            \s*::\s*
            (?:~?[A-Za-z_]\w*(?:\s*<[^;{}]+?>)?|operator\s*(?:\[\]|\(\)|[+*/%<>=!&|^~-]+))
        )\s*\("#,
    )
    .map_err(|error| format!("Could not compile out-of-line analysis: {error}"))
}

fn inline_member_definition_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?xs)
        (?P<signature>
            (?:(?:inline|static|virtual|constexpr|consteval|friend|explicit)\s+)*
            (?:(?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+>)?(?:\s*[*&]\s*|\s+))+
                (?P<member>[A-Za-z_]\w*)|(?P<special_member>~?[A-Za-z_]\w*))
            \s*\([^;{}]*\)\s*
            (?:const\s*)?(?:noexcept(?:\s*\([^;{}]*\))?\s*)?
            (?:override\s*)?(?:final\s*)?
        )$"#,
    )
    .map_err(|error| format!("Could not compile inline-member analysis: {error}"))
}

fn out_of_line_signature_prefix_pattern() -> Result<Regex, String> {
    Regex::new(r#"^(?:(?:inline|static|constexpr|virtual|[A-Z][A-Z0-9_]*)\s+)+"#)
        .map_err(|error| format!("Could not compile out-of-line signature analysis: {error}"))
}

fn defaulted_member_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?m)^[\t ]*(?:template\s*<[^;{}]+>\s*)?(?P<qualified>[A-Za-z_]\w*(?:\s*<[^;{}]+?>)?(?:\s*::\s*[A-Za-z_]\w*(?:\s*<[^;{}]+?>)?)*\s*::\s*~?[A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:noexcept\s*)?=\s*(?:default|delete)\s*;"#,
    )
    .map_err(|error| format!("Could not compile defaulted-member analysis: {error}"))
}

fn static_definition_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?xm)
        ^[\t ]*
        (?:template\s*<[^;{}]+>\s*)?
        (?:(?:constexpr|const|volatile|inline|static|unsigned|signed|long|short)\s+)*
        (?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+?>)?)
        [*&\s]+
        (?P<qualified>
            [A-Za-z_]\w*(?:\s*<[^;{}]+?>)?
            (?:\s*::\s*[A-Za-z_]\w*(?:\s*<[^;{}]+?>)?)*
            \s*::\s*[A-Za-z_]\w*(?:\s*\[[^\]]*\])*
        )\s*(?:\{|=|;)
        "#,
    )
    .map_err(|error| format!("Could not compile static-member analysis: {error}"))
}

fn detached_return_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"^\s*(?:(?:const|static|inline|constexpr|virtual)\s+)*(?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}\n]+>)?)(?:\s*[*&])?\s*$"#,
    )
    .map_err(|error| format!("Could not compile detached-return analysis: {error}"))
}

fn template_prefix_pattern() -> Result<Regex, String> {
    Regex::new(r#"^\s*template\s*<[^>{}]*>\s*$"#)
        .map_err(|error| format!("Could not compile template-prefix analysis: {error}"))
}

fn free_function_pattern() -> Result<Regex, String> {
    Regex::new(
        r#"(?x)
        \A
        (?P<declaration>
            [\t\x20]*
            (?:template\s*<[^>]*>\s*)?
            (?:(?:inline|static|constexpr|consteval|const|volatile|unsigned|signed|long|short)\s+)*
            (?:
                [A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+?>)?
                [*&\s]+
            )+
            (?P<name>[A-Za-z_]\w*)
            (?:\s*<[^;{}]+?>)?\s*\(
        )
        "#,
    )
    .map_err(|error| format!("Could not compile free-function analysis: {error}"))
}

pub fn source_declarations(
    request: &SourceDeclarationRequest,
) -> Result<SourceDeclarationReport, String> {
    if request.source.len() > MAX_PREPROCESS_SOURCE_BYTES || request.source.contains('\0') {
        return Err("Declaration-analysis source is invalid".to_owned());
    }
    let type_pattern = type_declaration_pattern()?;
    let include_pattern = include_directive_pattern()?;
    let preprocessor_directive_pattern = source_preprocessor_directive_pattern()?;
    let macro_definition_pattern = source_macro_definition_pattern()?;
    let macro_continuation_pattern = macro_continuation_pattern()?;
    let conditional_directive_pattern = source_conditional_directive_pattern()?;
    let type_alias_pattern = type_alias_pattern()?;
    let namespace_constant_pattern = namespace_constant_pattern()?;
    let namespace_variable_pattern = namespace_variable_pattern()?;
    let namespace_using_pattern = namespace_using_pattern()?;
    let namespace_using_directive_pattern = namespace_using_directive_pattern()?;
    let enum_macro_pattern = enum_macro_pattern()?;
    let enum_identifier_pattern = enum_identifier_pattern()?;
    let config_loop_pattern = config_loop_pattern()?;
    let config_binding_pattern = config_binding_pattern()?;
    let config_snap_patterns = config_snap_patterns()?;
    let inline_member_pattern = inline_member_definition_pattern()?;
    let out_of_line_pattern = out_of_line_pattern()?;
    let out_of_line_signature_prefix_pattern = out_of_line_signature_prefix_pattern()?;
    let defaulted_member_pattern = defaulted_member_pattern()?;
    let static_definition_pattern = static_definition_pattern()?;
    let detached_return_pattern = detached_return_pattern()?;
    let template_prefix_pattern = template_prefix_pattern()?;
    let free_function_pattern = free_function_pattern()?;
    let file = Path::new("<source-declarations>");
    let raw_type_declarations = type_declarations_in_source(&request.source, file, &type_pattern);
    let inline_member_definitions = inline_member_definitions_in_source(
        &request.source,
        &raw_type_declarations,
        &inline_member_pattern,
    );
    let type_declarations = raw_type_declarations
        .into_iter()
        .map(|candidate| SourceTypeDeclarationCandidate {
            start: candidate.start,
            declaration_start: candidate.declaration_start,
            declaration_end: candidate.declaration_end,
            body_start: candidate.body_start,
            body_end: candidate.body_end,
            name: candidate.name,
            kind: candidate.kind,
            namespace: candidate.namespace,
            namespace_scope: candidate.namespace_scope,
            owners: candidate.owners,
            template_source: candidate.template_source,
            template_parameters: candidate.template_parameters,
            bases: candidate.bases,
        })
        .collect();
    let anonymous_typedef_declarations =
        anonymous_typedef_declarations_in_source(&request.source, file, &type_pattern)
            .into_iter()
            .map(|candidate| SourceAnonymousTypedefDeclarationCandidate {
                start: candidate.start,
                end: candidate.end,
                body_start: candidate.body_start,
                body_end: candidate.body_end,
                name_start: candidate.name_start,
                name: candidate.name,
                kind: candidate.kind,
                namespace: candidate.namespace,
                namespace_scope: candidate.namespace_scope,
                owners: candidate.owners,
            })
            .collect();
    let type_aliases =
        type_aliases_in_source(&request.source, file, &type_alias_pattern, &type_pattern)
            .into_iter()
            .map(|candidate| SourceTypeAliasCandidate {
                start: candidate.start,
                declaration_start: candidate.declaration_start,
                declaration_end: candidate.declaration_end,
                name: candidate.name,
                target: candidate.target,
                kind: candidate.kind,
                namespace: candidate.namespace,
                namespace_scope: candidate.namespace_scope,
                owners: candidate.owners,
            })
            .collect();
    let enum_declarations = enum_declarations_in_source(
        &request.source,
        file,
        &type_pattern,
        &enum_macro_pattern,
        &enum_identifier_pattern,
    )
    .into_iter()
    .map(|candidate| SourceEnumDeclarationCandidate {
        start: candidate.start,
        end: candidate.end,
        body_start: candidate.body_start,
        body_end: candidate.body_end,
        name: candidate.name,
        scoped: candidate.scoped,
        namespace: candidate.namespace,
        namespace_scope: candidate.namespace_scope,
        owners: candidate.owners,
        raw: candidate.raw,
        identifiers: candidate.identifiers,
        assignments: candidate.assignments,
        complete: candidate.complete,
    })
    .collect();
    let namespace_constant_declarations = namespace_constant_declarations_in_source(
        &request.source,
        file,
        &namespace_constant_pattern,
    )
    .into_iter()
    .map(|candidate| SourceNamespaceConstantDeclarationCandidate {
        start: candidate.start,
        end: candidate.end,
        name: candidate.name,
        namespace: candidate.namespace,
    })
    .collect();
    let namespace_variable_declarations = namespace_variable_declarations_in_source(
        &request.source,
        file,
        &namespace_variable_pattern,
    )
    .into_iter()
    .map(|candidate| SourceNamespaceVariableDeclarationCandidate {
        start: candidate.start,
        end: candidate.end,
        name_start: candidate.name_start,
        declarator_end: candidate.declarator_end,
        name: candidate.name,
        namespace: candidate.namespace,
        type_source: candidate.type_source,
        array_extent: candidate.array_extent,
        c_linkage: candidate.c_linkage,
        initialized: candidate.initialized,
        extern_declaration: candidate.extern_declaration,
    })
    .collect();
    let namespace_using_declarations =
        namespace_using_declarations_in_source(&request.source, file, &namespace_using_pattern)
            .into_iter()
            .map(|candidate| SourceNamespaceUsingDeclarationCandidate {
                start: candidate.start,
                end: candidate.end,
                target: candidate.target,
                namespace: candidate.namespace,
            })
            .collect();
    let namespace_using_directives = namespace_using_directives_in_source(
        &request.source,
        file,
        &namespace_using_directive_pattern,
    )
    .into_iter()
    .map(|candidate| SourceNamespaceUsingDirectiveCandidate {
        start: candidate.start,
        end: candidate.end,
        target: candidate.target,
        namespace: candidate.namespace,
    })
    .collect();
    let config_calls = config_calls_in_source(
        &request.source,
        file,
        &type_pattern,
        &config_loop_pattern,
        &config_binding_pattern,
        &config_snap_patterns,
    )
    .into_iter()
    .map(|candidate| SourceConfigCallCandidate {
        start: candidate.start,
        end: candidate.end,
        name: candidate.name,
        template_source: candidate.template_source,
        arguments_source: candidate.arguments_source,
        arguments: candidate.arguments,
        namespace: candidate.namespace,
        owners: candidate.owners,
        loops: candidate.loops,
        string_bindings: candidate.string_bindings,
        synthetic: candidate.synthetic,
    })
    .collect();
    let out_of_line_definitions = out_of_line_definitions_in_source(
        &request.source,
        file,
        &out_of_line_pattern,
        &detached_return_pattern,
        &template_prefix_pattern,
        &out_of_line_signature_prefix_pattern,
    )
    .into_iter()
    .chain(defaulted_definitions_in_source(
        &request.source,
        file,
        &defaulted_member_pattern,
    ))
    .chain(static_definitions_in_source(
        &request.source,
        file,
        &static_definition_pattern,
    ))
    .map(|candidate| SourceOutOfLineDefinitionCandidate {
        start: candidate.start,
        end: candidate.end,
        body_start: candidate.body_start,
        body_end: candidate.body_end,
        owner: candidate.owner,
        owner_chain: candidate.owner_chain,
        kind: candidate.kind,
        namespace: candidate.namespace,
        member: candidate.member,
        callable_kind: candidate.callable_kind,
        signature: candidate.signature,
    })
    .collect();
    let free_function_declarations =
        free_function_declarations_in_source(&request.source, file, &free_function_pattern)
            .into_iter()
            .map(|candidate| SourceFreeFunctionDeclarationCandidate {
                start: candidate.start,
                end: candidate.end,
                name: candidate.name,
                namespace: candidate.namespace,
            })
            .collect();
    let free_function_definitions =
        free_function_definitions_in_source(&request.source, file, &free_function_pattern)
            .into_iter()
            .map(|candidate| SourceFreeFunctionDefinitionCandidate {
                start: candidate.start,
                end: candidate.end,
                name: candidate.name,
                namespace: candidate.namespace,
                signature: candidate.signature,
                declaration_signature: candidate.declaration_signature,
                references: candidate.references,
            })
            .collect();
    let repeated_default_argument_ranges =
        repeated_default_argument_ranges_in_source(&request.source, &free_function_pattern);
    let include_directives = include_directives_in_source(
        &request.source,
        Path::new("<declaration-source>"),
        &include_pattern,
    )
    .into_iter()
    .map(|candidate| SourceIncludeDirectiveCandidate {
        start: candidate.start,
        include: candidate.include,
        angle: candidate.angle,
    })
    .collect();
    let preprocessor_directives =
        source_preprocessor_directives(&request.source, &preprocessor_directive_pattern);
    let macro_definitions = source_macro_definitions(
        &request.source,
        &macro_definition_pattern,
        &macro_continuation_pattern,
    );
    let raw_conditional_directives = source_conditional_directives(
        &request.source,
        &conditional_directive_pattern,
        &macro_continuation_pattern,
    );
    let header_guards = source_header_guards(
        &request.source,
        &raw_conditional_directives,
        &macro_definitions,
    );
    let conditional_blocks =
        source_conditional_blocks(&request.source, &raw_conditional_directives);
    let conditional_directives = raw_conditional_directives
        .into_iter()
        .map(|candidate| SourceConditionalDirectiveCandidate {
            start: request.source[..candidate.start].encode_utf16().count(),
            end: request.source[..candidate.end].encode_utf16().count(),
            kind: candidate.kind,
            expression: candidate.expression,
            simple_macro: candidate.simple_macro,
            negated: candidate.negated,
        })
        .collect();
    Ok(SourceDeclarationReport {
        include_directives,
        preprocessor_directives,
        macro_definitions,
        conditional_directives,
        conditional_blocks,
        header_guards,
        type_declarations,
        anonymous_typedef_declarations,
        type_aliases,
        enum_declarations,
        namespace_constant_declarations,
        namespace_variable_declarations,
        namespace_using_declarations,
        namespace_using_directives,
        config_calls,
        inline_member_definitions,
        out_of_line_definitions,
        free_function_declarations,
        free_function_definitions,
        repeated_default_argument_ranges,
    })
}

pub fn model_candidates(source_root: &Path) -> Result<ModelCandidateReport, String> {
    let inventory = inventory(source_root)?;
    let mut candidates = Vec::new();
    let mut custom_model_candidates = Vec::new();
    let mut meta_module_candidates = Vec::new();
    let mut string_constants = Vec::new();
    let mut type_aliases = Vec::new();
    let mut type_declarations = Vec::new();
    let mut anonymous_typedef_declarations = Vec::new();
    let mut enum_declarations = Vec::new();
    let mut namespace_constant_declarations = Vec::new();
    let mut namespace_variable_declarations = Vec::new();
    let mut namespace_using_declarations = Vec::new();
    let mut namespace_using_directives = Vec::new();
    let mut config_calls = Vec::new();
    let mut out_of_line_definitions = Vec::new();
    let mut free_function_declarations = Vec::new();
    let mut free_function_definitions = Vec::new();
    let mut include_directives = Vec::new();
    let string_pattern = Regex::new(
        r#"\b(?:(?:inline|static)\s+)*(?:constexpr|const)\s+(?:auto|(?:std::)?string|(?:(?:const\s+)?char\s*(?:const\s*)?\*?))\s+([A-Za-z_]\w*)\s*(?:\[\s*\])?\s*(?:=\s*)?(\{\s*"(?:\\.|[^"\\])*"\s*\}|"(?:\\.|[^"\\])*")\s*;"#,
    )
    .map_err(|error| format!("Could not compile string-constant analysis: {error}"))?;
    let alias_pattern = type_alias_pattern()?;
    let namespace_constant_pattern = namespace_constant_pattern()?;
    let namespace_variable_pattern = namespace_variable_pattern()?;
    let namespace_using_pattern = namespace_using_pattern()?;
    let namespace_using_directive_pattern = namespace_using_directive_pattern()?;
    let type_pattern = type_declaration_pattern()?;
    let enum_macro_pattern = enum_macro_pattern()?;
    let enum_identifier_pattern = enum_identifier_pattern()?;
    let config_loop_pattern = config_loop_pattern()?;
    let config_binding_pattern = config_binding_pattern()?;
    let config_snap_patterns = config_snap_patterns()?;
    let include_pattern = include_directive_pattern()?;
    let custom_model_assignment_pattern = Regex::new(
        r#"\b(?:plugin::)?Model\s*\*\s*model(?P<variable>[A-Za-z0-9_-]+)\s*=\s*\[\s*\]\s*\(\s*\)\s*\{"#,
    )
    .map_err(|error| format!("Could not compile custom-model analysis: {error}"))?;
    let new_type_pattern = Regex::new(r#"\bnew\s+(?P<type>[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\b"#)
        .map_err(|error| format!("Could not compile custom-model new-type analysis: {error}"))?;
    let model_slug_pattern =
        Regex::new(r#"\bmodel\s*->\s*slug\s*=\s*(?P<expression>[^;]+)\s*;"#)
            .map_err(|error| format!("Could not compile custom-model slug analysis: {error}"))?;
    let create_module_pattern = Regex::new(
        r#"\b(?:engine::)?Module\s*\*\s*createModule\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept(?:\s*\([^;{}]*\))?\s*)?(?:override\s*)?\{"#,
    )
    .map_err(|error| format!("Could not compile custom-model module analysis: {error}"))?;
    let widget_factory_pattern = Regex::new(r#"\b(?P<factory>create[A-Za-z_]\w*Widget)\s*\("#)
        .map_err(|error| format!("Could not compile custom-model widget analysis: {error}"))?;
    let meta_module_pattern = Regex::new(r#"\bGenericModule\s*<"#)
        .map_err(|error| format!("Could not compile MetaModule analysis: {error}"))?;
    let meta_module_tail_pattern = Regex::new(r#"^\s*::\s*create\s*\(\s*\)"#)
        .map_err(|error| format!("Could not compile MetaModule call analysis: {error}"))?;
    let meta_module_variable_pattern = Regex::new(r#"\bmodel(?P<variable>[A-Za-z0-9_-]+)\s*=\s*$"#)
        .map_err(|error| format!("Could not compile MetaModule variable analysis: {error}"))?;
    let custom_model_patterns = CustomModelPatterns {
        assignment: &custom_model_assignment_pattern,
        new_type: &new_type_pattern,
        slug: &model_slug_pattern,
        create_module: &create_module_pattern,
        widget_factory: &widget_factory_pattern,
    };
    let out_of_line_pattern = out_of_line_pattern()?;
    let out_of_line_signature_prefix_pattern = out_of_line_signature_prefix_pattern()?;
    let defaulted_pattern = defaulted_member_pattern()?;
    let static_definition_pattern = static_definition_pattern()?;
    let free_function_pattern = free_function_pattern()?;
    let detached_return_pattern = detached_return_pattern()?;
    let template_pattern = template_prefix_pattern()?;
    let initialized_global_pattern = Regex::new(
        r#"(?m)^(?:const|constexpr|static)\s+(?:[A-Za-z_]\w*(?:::\w+)*(?:\s*[*&])?\s+)+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*="#,
    )
    .map_err(|error| format!("Could not compile companion analysis: {error}"))?;
    for file in &inventory.source_files {
        let source = fs::read_to_string(file)
            .map_err(|error| format!("Cannot read source file {}: {error}", file.display()))?;
        candidates.extend(candidates_in_source(&source, file));
        let source_type_declarations = type_declarations_in_source(&source, file, &type_pattern);
        custom_model_candidates.extend(custom_model_candidates_in_source(
            &source,
            file,
            &source_type_declarations,
            &custom_model_patterns,
        ));
        meta_module_candidates.extend(meta_module_candidates_in_source(
            &source,
            file,
            &meta_module_pattern,
            &meta_module_tail_pattern,
            &meta_module_variable_pattern,
        ));
        string_constants.extend(string_constants_in_source(&source, file, &string_pattern));
        type_aliases.extend(type_aliases_in_source(
            &source,
            file,
            &alias_pattern,
            &type_pattern,
        ));
        type_declarations.extend(source_type_declarations);
        anonymous_typedef_declarations.extend(anonymous_typedef_declarations_in_source(
            &source,
            file,
            &type_pattern,
        ));
        enum_declarations.extend(enum_declarations_in_source(
            &source,
            file,
            &type_pattern,
            &enum_macro_pattern,
            &enum_identifier_pattern,
        ));
        namespace_constant_declarations.extend(namespace_constant_declarations_in_source(
            &source,
            file,
            &namespace_constant_pattern,
        ));
        namespace_variable_declarations.extend(namespace_variable_declarations_in_source(
            &source,
            file,
            &namespace_variable_pattern,
        ));
        namespace_using_declarations.extend(namespace_using_declarations_in_source(
            &source,
            file,
            &namespace_using_pattern,
        ));
        namespace_using_directives.extend(namespace_using_directives_in_source(
            &source,
            file,
            &namespace_using_directive_pattern,
        ));
        config_calls.extend(config_calls_in_source(
            &source,
            file,
            &type_pattern,
            &config_loop_pattern,
            &config_binding_pattern,
            &config_snap_patterns,
        ));
        out_of_line_definitions.extend(out_of_line_definitions_in_source(
            &source,
            file,
            &out_of_line_pattern,
            &detached_return_pattern,
            &template_pattern,
            &out_of_line_signature_prefix_pattern,
        ));
        out_of_line_definitions.extend(defaulted_definitions_in_source(
            &source,
            file,
            &defaulted_pattern,
        ));
        out_of_line_definitions.extend(static_definitions_in_source(
            &source,
            file,
            &static_definition_pattern,
        ));
        free_function_declarations.extend(free_function_declarations_in_source(
            &source,
            file,
            &free_function_pattern,
        ));
        free_function_definitions.extend(free_function_definitions_in_source(
            &source,
            file,
            &free_function_pattern,
        ));
    }
    let mut dependency_files = Vec::new();
    filtered_source_files(&inventory.source_root, "dependency", &mut dependency_files)?;
    dependency_files.sort();
    dependency_files.dedup();
    for file in &dependency_files {
        let source = fs::read_to_string(file)
            .map_err(|error| format!("Cannot read source file {}: {error}", file.display()))?;
        include_directives.extend(include_directives_in_source(
            &source,
            file,
            &include_pattern,
        ));
    }
    resolve_include_targets(
        &inventory.source_root,
        &inventory.repository_roots,
        &dependency_files,
        &mut include_directives,
    );
    resolve_widget_model_candidates(&mut candidates, &type_declarations, &include_directives);
    let companion_implementations = companion_implementations(
        &inventory.source_root,
        &dependency_files,
        &initialized_global_pattern,
    )?;
    Ok(ModelCandidateReport {
        source_root: inventory.source_root,
        candidates,
        custom_model_candidates,
        meta_module_candidates,
        string_constants,
        type_aliases,
        type_declarations,
        anonymous_typedef_declarations,
        enum_declarations,
        namespace_constant_declarations,
        namespace_variable_declarations,
        namespace_using_declarations,
        namespace_using_directives,
        config_calls,
        out_of_line_definitions,
        free_function_declarations,
        free_function_definitions,
        include_directives,
        companion_implementations,
    })
}

fn header_file(file: &Path) -> bool {
    matches!(
        file.extension().and_then(|extension| extension.to_str()),
        Some("h" | "hh" | "hpp" | "inl")
    )
}

fn implementation_file(file: &Path) -> bool {
    matches!(
        file.extension().and_then(|extension| extension.to_str()),
        Some("c" | "cc" | "cpp" | "cxx")
    )
}

fn nonstandard_angle_include(include: &str) -> bool {
    include.contains('/')
        || include
            .chars()
            .any(|character| character.is_ascii_uppercase())
        || include
            .strip_prefix("lib")
            .and_then(|tail| tail.chars().next())
            .is_some_and(|character| character.is_ascii_uppercase())
}

fn object_macro_definitions(source: &str, pattern: &Regex) -> HashMap<String, String> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| {
            let name = captures.get(1)?.as_str().to_owned();
            let remainder = captures.get(2).map_or("", |value| value.as_str());
            if remainder.starts_with('(') {
                return None;
            }
            let mut value = remainder.trim_start().to_owned();
            if let Some(comment) = value.find("//") {
                if value[..comment]
                    .chars()
                    .next_back()
                    .is_some_and(char::is_whitespace)
                {
                    value.truncate(comment);
                }
            }
            Some((name, value.trim().to_owned()))
        })
        .collect()
}

fn macro_boolean(name: &str, definitions: &HashMap<String, String>) -> bool {
    if matches!(
        name,
        "TEST" | "VCV" | "NDEBUG" | "__EMSCRIPTEN__" | "__cplusplus"
    ) {
        return true;
    }
    let Some(value) = definitions.get(name) else {
        return false;
    };
    let value = value.trim();
    if value.is_empty() {
        return true;
    }
    let unsigned = value.strip_prefix('-').unwrap_or(value);
    let unsigned = unsigned.strip_prefix('+').unwrap_or(unsigned);
    let parsed = unsigned
        .strip_prefix("0x")
        .or_else(|| unsigned.strip_prefix("0X"))
        .and_then(|digits| u128::from_str_radix(digits, 16).ok())
        .or_else(|| unsigned.parse::<u128>().ok());
    parsed != Some(0)
}

fn conditional_value(
    command: &str,
    argument: &str,
    definitions: &HashMap<String, String>,
    defined_pattern: &Regex,
    not_defined_pattern: &Regex,
    identifier_pattern: &Regex,
    negated_pattern: &Regex,
) -> Option<bool> {
    let always_defined = |name: &str| {
        definitions.contains_key(name)
            || matches!(
                name,
                "TEST" | "VCV" | "NDEBUG" | "__EMSCRIPTEN__" | "__cplusplus"
            )
    };
    if command == "ifdef" {
        return Some(always_defined(argument));
    }
    if command == "ifndef" {
        return Some(!always_defined(argument));
    }
    if let Some(name) = defined_pattern
        .captures(argument)
        .and_then(|captures| captures.get(1))
    {
        return Some(always_defined(name.as_str()));
    }
    if let Some(name) = not_defined_pattern
        .captures(argument)
        .and_then(|captures| captures.get(1))
    {
        return Some(!always_defined(name.as_str()));
    }
    if let Some(name) = identifier_pattern
        .captures(argument)
        .and_then(|captures| captures.get(1))
    {
        return Some(macro_boolean(name.as_str(), definitions));
    }
    negated_pattern
        .captures(argument)
        .and_then(|captures| captures.get(1))
        .map(|name| !macro_boolean(name.as_str(), definitions))
}

struct ConditionalFrame {
    managed: bool,
    active: bool,
    matched: bool,
    outer: bool,
}

fn preprocess_conditionals_with_definitions(
    source: &str,
    initial_definitions: &HashMap<String, String>,
) -> Result<(String, HashMap<String, String>), String> {
    let directive_pattern = Regex::new(
        r#"^[\t ]*#\s*(ifdef|ifndef|if|elif|else|endif|define|undef)\b(?:[\t ]+(.*))?$"#,
    )
    .map_err(|error| format!("Could not compile conditional directive analysis: {error}"))?;
    let defined_pattern =
        Regex::new(r#"^defined\s*\(\s*([A-Za-z_]\w*)\s*\)$"#).map_err(|error| error.to_string())?;
    let not_defined_pattern = Regex::new(r#"^!\s*defined\s*\(\s*([A-Za-z_]\w*)\s*\)$"#)
        .map_err(|error| error.to_string())?;
    let identifier_pattern =
        Regex::new(r#"^([A-Za-z_]\w*)$"#).map_err(|error| error.to_string())?;
    let negated_pattern =
        Regex::new(r#"^!\s*([A-Za-z_]\w*)$"#).map_err(|error| error.to_string())?;
    let define_pattern = Regex::new(r#"^([A-Za-z_]\w*)([\s\S]*)$"#)
        .map_err(|error| format!("Could not compile conditional macro analysis: {error}"))?;
    let block_comment_pattern = Regex::new(r#"/\*[\s\S]*?\*/"#)
        .map_err(|error| format!("Could not compile macro-comment analysis: {error}"))?;
    let continuation_pattern = Regex::new(r#"\\\s*\n"#)
        .map_err(|error| format!("Could not compile macro-continuation analysis: {error}"))?;
    let mut definitions = initial_definitions.clone();
    let mut stack = Vec::<ConditionalFrame>::new();
    let mut output = Vec::new();
    let lines = source.replace("\r\n", "\n").replace('\r', "\n");
    let lines = lines.split('\n').collect::<Vec<_>>();
    let parent_active = |stack: &[ConditionalFrame]| stack.iter().all(|frame| frame.active);
    let mut index = 0usize;
    while index < lines.len() {
        let line = lines[index];
        let Some(directive) = directive_pattern.captures(line) else {
            if parent_active(&stack) {
                output.push(line.to_owned());
            }
            index += 1;
            continue;
        };
        let command = directive.get(1).map_or("", |value| value.as_str());
        let argument = directive.get(2).map_or("", |value| value.as_str()).trim();
        if matches!(command, "ifdef" | "ifndef" | "if") {
            let value = conditional_value(
                command,
                argument,
                &definitions,
                &defined_pattern,
                &not_defined_pattern,
                &identifier_pattern,
                &negated_pattern,
            );
            if let Some(value) = value {
                let outer = parent_active(&stack);
                stack.push(ConditionalFrame {
                    managed: true,
                    active: outer && value,
                    matched: value,
                    outer,
                });
            } else {
                stack.push(ConditionalFrame {
                    managed: false,
                    active: true,
                    matched: false,
                    outer: true,
                });
                if parent_active(&stack) {
                    output.push(line.to_owned());
                }
            }
            index += 1;
            continue;
        }
        if command == "elif" {
            let unmanaged = stack.last().is_none_or(|frame| !frame.managed);
            if unmanaged {
                if parent_active(&stack) {
                    output.push(line.to_owned());
                }
            } else {
                let value = conditional_value(
                    command,
                    argument,
                    &definitions,
                    &defined_pattern,
                    &not_defined_pattern,
                    &identifier_pattern,
                    &negated_pattern,
                )
                .unwrap_or(false);
                if let Some(frame) = stack.last_mut() {
                    frame.active = frame.outer && !frame.matched && value;
                    frame.matched |= value;
                }
            }
            index += 1;
            continue;
        }
        if command == "else" {
            let unmanaged = stack.last().is_none_or(|frame| !frame.managed);
            if unmanaged {
                if parent_active(&stack) {
                    output.push(line.to_owned());
                }
            } else if let Some(frame) = stack.last_mut() {
                frame.active = frame.outer && !frame.matched;
                frame.matched = true;
            }
            index += 1;
            continue;
        }
        if command == "endif" {
            let frame = stack.pop();
            if frame.is_none_or(|frame| !frame.managed) && parent_active(&stack) {
                output.push(line.to_owned());
            }
            index += 1;
            continue;
        }
        if command == "define" {
            let mut physical = vec![line.to_owned()];
            while physical
                .last()
                .is_some_and(|line| line.trim_end().ends_with('\\'))
                && index + 1 < lines.len()
            {
                index += 1;
                physical.push(lines[index].to_owned());
            }
            if parent_active(&stack) {
                let logical = physical
                    .iter()
                    .enumerate()
                    .map(|(physical_index, value)| {
                        if physical_index == 0 {
                            argument
                        } else {
                            value.as_str()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                let logical = continuation_pattern.replace_all(&logical, "\n");
                if let Some(macro_definition) = define_pattern.captures(logical.trim()) {
                    if let Some(name) = macro_definition.get(1) {
                        let remainder = macro_definition.get(2).map_or("", |value| value.as_str());
                        if !remainder.trim_start().starts_with('(') {
                            let without_blocks = block_comment_pattern.replace_all(remainder, " ");
                            let value = without_blocks
                                .lines()
                                .map(|line| line.split_once("//").map_or(line, |(value, _)| value))
                                .collect::<Vec<_>>()
                                .join("\n");
                            definitions.insert(name.as_str().to_owned(), value.trim().to_owned());
                        }
                    }
                }
                output.extend(physical);
            }
            index += 1;
            continue;
        }
        if command == "undef" {
            if parent_active(&stack) {
                definitions.remove(argument);
            }
            index += 1;
            continue;
        }
        index += 1;
    }
    Ok((output.join("\n"), definitions))
}

fn preprocess_conditionals(
    source: &str,
    initial_definitions: &HashMap<String, String>,
) -> Result<String, String> {
    preprocess_conditionals_with_definitions(source, initial_definitions).map(|(source, _)| source)
}

fn preprocess_output_size(size: usize) -> Result<(), String> {
    if size > MAX_PREPROCESS_SOURCE_BYTES {
        return Err("Preprocessed source is too large".to_owned());
    }
    Ok(())
}

fn replace_identifiers_outside_comments(
    source: &str,
    definitions: &HashMap<String, String>,
) -> Result<String, String> {
    let bytes = source.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0usize;
    while index < bytes.len() {
        let current = bytes[index];
        let next = bytes.get(index + 1).copied();
        if current == b'/' && next == Some(b'/') {
            let limit = bytes[index..]
                .iter()
                .position(|byte| *byte == b'\n')
                .map_or(bytes.len(), |offset| index + offset + 1);
            output.extend_from_slice(&bytes[index..limit]);
            index = limit;
        } else if current == b'/' && next == Some(b'*') {
            let limit = bytes[index + 2..]
                .windows(2)
                .position(|pair| pair == b"*/")
                .map_or(bytes.len(), |offset| index + 2 + offset + 2);
            output.extend_from_slice(&bytes[index..limit]);
            index = limit;
        } else if matches!(current, b'"' | b'\'') {
            let quote = current;
            let start = index;
            index += 1;
            while index < bytes.len() {
                if bytes[index] == b'\\' {
                    index = (index + 2).min(bytes.len());
                    continue;
                }
                let value = bytes[index];
                index += 1;
                if value == quote {
                    break;
                }
            }
            output.extend_from_slice(&bytes[start..index]);
        } else if current.is_ascii_alphabetic() || current == b'_' {
            let start = index;
            index += 1;
            while bytes
                .get(index)
                .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
            {
                index += 1;
            }
            let name = std::str::from_utf8(&bytes[start..index])
                .map_err(|error| format!("Invalid macro identifier: {error}"))?;
            if let Some(value) = definitions.get(name).filter(|value| !value.is_empty()) {
                output.extend_from_slice(value.as_bytes());
            } else {
                output.extend_from_slice(&bytes[start..index]);
            }
        } else {
            output.push(current);
            index += 1;
        }
        preprocess_output_size(output.len())?;
    }
    String::from_utf8(output).map_err(|error| format!("Invalid preprocessed source: {error}"))
}

fn replace_object_macros(
    source: &str,
    definitions: &HashMap<String, String>,
) -> Result<String, String> {
    let definition_pattern = Regex::new(r#"(?m)^[\t ]*#\s*define\b(?:[^\n]*\\\s*\n)*[^\n]*"#)
        .map_err(|error| format!("Could not compile macro-definition protection: {error}"))?;
    let token_pattern = Regex::new(r#"__RACK_WEB_MACRO_DEFINITION_(\d+)__"#)
        .map_err(|error| format!("Could not compile macro-definition restoration: {error}"))?;
    let mut protected = Vec::new();
    let mut result = String::with_capacity(source.len());
    let mut cursor = 0usize;
    for found in definition_pattern.find_iter(source) {
        result.push_str(&source[cursor..found.start()]);
        result.push_str(&format!(
            "__RACK_WEB_MACRO_DEFINITION_{}__",
            protected.len()
        ));
        protected.push(found.as_str().to_owned());
        cursor = found.end();
    }
    result.push_str(&source[cursor..]);
    for _ in 0..16 {
        let next = replace_identifiers_outside_comments(&result, definitions)?;
        if next == result {
            break;
        }
        result = next;
    }
    let mut restored = String::with_capacity(source.len().max(result.len()));
    cursor = 0;
    for captures in token_pattern.captures_iter(&result) {
        let Some(found) = captures.get(0) else {
            continue;
        };
        restored.push_str(&result[cursor..found.start()]);
        let index = captures
            .get(1)
            .and_then(|value| value.as_str().parse::<usize>().ok());
        restored.push_str(
            index
                .and_then(|index| protected.get(index))
                .map(String::as_str)
                .unwrap_or(""),
        );
        cursor = found.end();
    }
    restored.push_str(&result[cursor..]);
    preprocess_output_size(restored.len())?;
    Ok(restored)
}

pub fn preprocess_source(request: &PreprocessRequest) -> Result<PreprocessReport, String> {
    if request.source.len() > MAX_PREPROCESS_SOURCE_BYTES {
        return Err("Preprocessor source is too large".to_owned());
    }
    if request.source.contains('\0') {
        return Err("Preprocessor source contains NUL".to_owned());
    }
    if request.initial_definitions.len() > MAX_PREPROCESS_DEFINITIONS {
        return Err("Preprocessor definition table is too large".to_owned());
    }
    let identifier_pattern = Regex::new(r#"^[A-Za-z_][A-Za-z0-9_]*$"#)
        .map_err(|error| format!("Could not compile macro-identifier validation: {error}"))?;
    let mut request_size = request.source.len();
    for (name, value) in &request.initial_definitions {
        if !identifier_pattern.is_match(name) || name.contains('\0') || value.contains('\0') {
            return Err(format!("Invalid preprocessor definition: {name}"));
        }
        if value.len() > MAX_PREPROCESS_DEFINITION_BYTES {
            return Err(format!("Preprocessor definition is too large: {name}"));
        }
        request_size = request_size
            .checked_add(name.len())
            .and_then(|size| size.checked_add(value.len()))
            .ok_or_else(|| "Preprocessor request is too large".to_owned())?;
        if request_size > MAX_PREPROCESS_SOURCE_BYTES {
            return Err("Preprocessor request is too large".to_owned());
        }
    }
    let initial_definitions = request
        .initial_definitions
        .iter()
        .map(|(name, value)| (name.clone(), value.clone()))
        .collect::<HashMap<_, _>>();
    let (active_source, definitions) =
        preprocess_conditionals_with_definitions(&request.source, &initial_definitions)?;
    let source = if request.expand_object_macros {
        replace_object_macros(&active_source, &definitions)?
    } else {
        active_source
    };
    preprocess_output_size(source.len())?;
    let include_pattern = include_directive_pattern()?;
    let include_directives = include_directives_in_source(
        &source,
        Path::new("<preprocessed-source>"),
        &include_pattern,
    )
    .into_iter()
    .map(|candidate| SourceIncludeDirectiveCandidate {
        start: candidate.start,
        include: candidate.include,
        angle: candidate.angle,
    })
    .collect();
    Ok(PreprocessReport {
        source,
        definitions: definitions.into_iter().collect(),
        include_directives,
    })
}

fn include_names(source: &str, pattern: &Regex) -> Vec<String> {
    pattern
        .captures_iter(source)
        .filter_map(|captures| captures.get(1).map(|value| value.as_str().to_owned()))
        .collect()
}

fn pruning_include_target(
    source_root: &Path,
    importer: &Path,
    include: &str,
    found: &HashSet<PathBuf>,
    by_basename: &HashMap<String, Vec<PathBuf>>,
) -> Option<PathBuf> {
    let normalized = include.replace('\\', "/");
    let include_path = Path::new(&normalized);
    let direct = importer
        .parent()
        .into_iter()
        .map(|directory| directory.join(include_path))
        .chain(std::iter::once(source_root.join("src").join(include_path)))
        .chain(std::iter::once(source_root.join(include_path)))
        .find_map(|candidate| {
            fs::canonicalize(candidate)
                .ok()
                .filter(|candidate| found.contains(candidate))
        });
    if direct.is_some() {
        return direct;
    }
    let basename = include_path.file_name()?.to_str()?;
    let matches = by_basename
        .get(basename)?
        .iter()
        .filter(|file| file.ends_with(include_path))
        .cloned()
        .collect::<Vec<_>>();
    (matches.len() == 1).then(|| matches[0].clone())
}

fn prune_inactive_dependencies(
    source_root: &Path,
    files: Vec<PathBuf>,
) -> Result<Vec<PathBuf>, String> {
    let headers = files
        .iter()
        .filter(|file| header_file(file))
        .cloned()
        .collect::<Vec<_>>();
    let condition_pattern = Regex::new(r#"(?m)^\s*#\s*(?:if|elif)\s*!?\s*([A-Za-z_]\w*)\s*$"#)
        .map_err(|error| format!("Could not compile condition-name analysis: {error}"))?;
    let object_pattern =
        Regex::new(r#"(?m)^[\t ]*#define[\t ]+([A-Za-z_]\w*)([^\n\\]*)[\t ]*$"#)
            .map_err(|error| format!("Could not compile object-macro analysis: {error}"))?;
    let include_pattern = Regex::new(r#"(?m)^\s*#\s*include\s+[<\"]([^>\"]+)[>\"]"#)
        .map_err(|error| format!("Could not compile pruning include analysis: {error}"))?;
    let mut sources = HashMap::new();
    let mut condition_names = HashSet::new();
    for file in &headers {
        let source = fs::read_to_string(file)
            .map_err(|error| format!("Cannot read source file {}: {error}", file.display()))?;
        condition_names.extend(
            condition_pattern
                .captures_iter(&source)
                .filter_map(|captures| captures.get(1).map(|name| name.as_str().to_owned())),
        );
        sources.insert(file.clone(), source);
    }
    let mut values = HashMap::<String, HashSet<String>>::new();
    for source in sources.values() {
        for (name, value) in object_macro_definitions(source, &object_pattern) {
            if condition_names.contains(&name) {
                values.entry(name).or_default().insert(value);
            }
        }
    }
    let definitions = values
        .into_iter()
        .filter_map(|(name, values)| {
            (values.len() == 1).then(|| (name, values.into_iter().next().unwrap_or_default()))
        })
        .collect::<HashMap<_, _>>();
    if definitions.is_empty() {
        return Ok(files);
    }
    let found = files.iter().cloned().collect::<HashSet<_>>();
    let mut by_basename = HashMap::<String, Vec<PathBuf>>::new();
    for file in &files {
        if let Some(name) = file.file_name().and_then(|name| name.to_str()) {
            by_basename
                .entry(name.to_owned())
                .or_default()
                .push(file.clone());
        }
    }
    let mut inactive_candidates = HashSet::new();
    let mut active_targets = HashSet::new();
    for file in &headers {
        let raw = sources.get(file).map(String::as_str).unwrap_or("");
        let active = preprocess_conditionals(raw, &definitions)?;
        let raw_targets = include_names(raw, &include_pattern)
            .into_iter()
            .filter_map(|include| {
                pruning_include_target(source_root, file, &include, &found, &by_basename)
            })
            .collect::<HashSet<_>>();
        let active_targets_for_file = include_names(&active, &include_pattern)
            .into_iter()
            .filter_map(|include| {
                pruning_include_target(source_root, file, &include, &found, &by_basename)
            })
            .collect::<HashSet<_>>();
        active_targets.extend(active_targets_for_file.iter().cloned());
        inactive_candidates.extend(raw_targets.difference(&active_targets_for_file).cloned());
    }
    let inactive = inactive_candidates
        .difference(&active_targets)
        .cloned()
        .collect::<HashSet<_>>();
    let inactive_stems = inactive
        .iter()
        .filter(|file| header_file(file))
        .map(|file| file.with_extension(""))
        .collect::<HashSet<_>>();
    Ok(files
        .into_iter()
        .filter(|file| {
            !inactive.contains(file)
                && !(implementation_file(file) && inactive_stems.contains(&file.with_extension("")))
        })
        .collect())
}

pub fn dependency_closure(
    source_root: &Path,
    roots: &[PathBuf],
) -> Result<DependencyClosureReport, String> {
    if roots.is_empty() {
        return Err("analyze dependencies requires at least one --entry".to_owned());
    }
    let analysis = model_candidates(source_root)?;
    let source_root = analysis.source_root.clone();
    let roots = roots
        .iter()
        .map(|root| {
            fs::canonicalize(root).map_err(|error| {
                format!(
                    "Cannot resolve dependency entry {}: {error}",
                    root.display()
                )
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    if roots
        .iter()
        .any(|root| !root.starts_with(&source_root) || !root.is_file())
    {
        return Err("Dependency entries must be files inside the source checkout".to_owned());
    }
    let mut directives = HashMap::<PathBuf, Vec<&IncludeDirectiveCandidate>>::new();
    for directive in &analysis.include_directives {
        directives
            .entry(directive.file.clone())
            .or_default()
            .push(directive);
    }
    let companions = analysis
        .companion_implementations
        .iter()
        .map(|candidate| (candidate.header.clone(), candidate.targets.clone()))
        .collect::<HashMap<_, _>>();
    let mut queue = VecDeque::from(roots.clone());
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    while let Some(file) = queue.pop_front() {
        if !seen.insert(file.clone()) || !file.is_file() {
            continue;
        }
        found.push(file.clone());
        for directive in directives.get(&file).into_iter().flatten() {
            if Path::new(&directive.include)
                .file_name()
                .and_then(|name| name.to_str())
                == Some("rack.hpp")
                || (directive.angle && !nonstandard_angle_include(&directive.include))
            {
                continue;
            }
            if let Some(target) = &directive.target {
                if !seen.contains(target) {
                    queue.push_back(target.clone());
                }
            }
        }
        for target in companions.get(&file).into_iter().flatten() {
            if !seen.contains(target) {
                queue.push_back(target.clone());
            }
        }
    }
    let pruned = prune_inactive_dependencies(&source_root, found.clone())?;
    let retained = pruned.iter().cloned().collect::<HashSet<_>>();
    let pruned_files = found
        .iter()
        .filter(|file| !retained.contains(*file))
        .cloned()
        .collect();
    Ok(DependencyClosureReport {
        source_root,
        roots,
        files: pruned,
        pruned_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_function_analysis_accepts_compact_namespace_definitions() {
        let source = "namespace compact { extern short compactValue; float compactHelper(float value) { return value; } }";
        let pattern = free_function_pattern().expect("free-function pattern should compile");
        let boundary = source
            .find("; float compactHelper")
            .expect("compact helper boundary should exist")
            + 1;
        assert!(pattern.is_match(&source[boundary..]));
        assert!(is_code_position(source, boundary));
        assert!(namespace_scope_at(source, boundary));
        let matches = free_function_matches(source, &pattern);
        assert_eq!(matches.len(), 1, "{matches:#?}");
        assert_eq!(matches[0].name, "compactHelper");
        let definitions =
            free_function_definitions_in_source(source, Path::new("compact.cpp"), &pattern);
        assert_eq!(definitions.len(), 1, "{definitions:#?}");
        assert_eq!(definitions[0].namespace, ["compact"]);
    }
}
