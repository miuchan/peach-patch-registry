# Rust migration boundaries

The registry is migrating its Node.js maintenance tools to Rust without changing
the browser ABI, package schema, source provenance, or Emscripten compiler
backend. Each migration step must replace one bounded owner and keep its public
contract executable throughout the transition.

## Ownership boundaries

| Boundary | Stable input | Stable output or side effect | Current owner | Target owner |
| --- | --- | --- | --- | --- |
| Registry schema | `index.json`, package manifests | Typed package records | `src/registry.rs` | Rust |
| Consumer commands | CLI arguments, registry URL or path | `list`, `search`, `info`, atomic `install`, `verify` | `src/consumer.rs` | Rust |
| Repository verification | Repository root | Validated paths, identities, sizes, SHA-256 digests, and catalog totals | `src/repository.rs` via `scripts/verify-registry.mjs` | Rust; Node is a compatibility shim |
| Publication | Reviewed catalog and staged WASM | Versioned package, manifest, digest, and index update | `src/publisher.rs` via `scripts/publish-registry.mjs` | Rust; Node is a compatibility shim |
| Discovery | Immutable VCV Library index and current catalog | Open-source module queue with compiled/pending totals | `src/discovery.rs` via `scripts/discover-open-source-modules.mjs` | Rust; Node is a compatibility shim |
| Build scheduling | Discovery queue, filters, and source-adapter process | Build state, staged WASM/assets, and catalog records | `src/scheduler.rs` via `scripts/build-open-source-modules.mjs` | Rust; Node is a compatibility shim |
| Source acquisition | Library URL, locked revision, source cache | Immutable checkout and provenance record | `src/source.rs` via `peach-registry source prepare` | Rust; Node consumes the structured result |
| Source analysis | Immutable checkout or checkout-confined source subtree | Canonical C/C++ paths, the filtered recursive dependency-file inventory, nested-repository roots, direct include directives and uniquely resolved targets, safe companion implementation bindings, conservatively pruned dependency closures, lexical model factories and argument lists, registration constants, namespace-scope constant declaration and `using namespace ns;` directive ranges, scoped type aliases, namespace/type-owner stacks and explicit namespace-scope markers, complete general type, anonymous C typedef, and enum declarations, parsed enum items/assignments/repeats with completeness markers, bounded Rack `config*` call expressions and synthetic snap-parameter assignments with argument/enclosing-counted-loop/local-string-binding facts, and raw class/free-function declaration and implementation facts with UTF-16 definition/body ranges plus member terminal/callable-kind facts, normalized member/free-function implementation signatures, and default-free free-function declaration signatures | `src/analysis.rs` via `peach-registry analyze inventory`, `analyze files`, `analyze model-candidates`, and `analyze dependencies` | Rust is authoritative for the standard immutable-checkout inventory and its raw structural facts; Node validates, selects, slices, and assembles those facts |
| Build metadata inputs | Immutable checkout root, checkout-relative Makefile, and selected source variables | Makefile unconditional and all conditional `-D` definitions, checkout-confined canonical `-I` directories, variable-expanded checkout-confined C/C++ source lists, and bounded CMake cache definitions | `src/analysis.rs` via `peach-registry analyze makefile` and `analyze cmake` | Rust owns generic root/nested Makefile and CMake discovery plus path safety; Node retains source-family selection policy and compile-plan assembly |
| Conditional preprocessing | C/C++ source, initial object definitions, and expansion mode | Normalized active source, final object-definition table, and active angle/quoted include directives with UTF-16 offsets; unknown complex conditions remain intact | `src/analysis.rs` via `peach-registry analyze preprocess` | Rust only; compatibility expectations live in `tests/analysis_contract.rs` |
| Active-source declarations | Preprocessed or synthesized C++ source | Scoped type bodies/bases/templates, namespace-scope classification, namespace-scope constant and variable statement/name/declarator ranges with type source, array extent, initialization/pure-`extern`, and C-linkage facts, qualified `using ns::Name;` declaration and `using namespace ns;` directive ranges with enclosing namespaces, scoped aliases, structured raw object/function macro definitions with parameters, normalized continuation bodies, comment state, and exact ranges, structured conditional directives with simple-macro facts and general opening/closing block pairs, paired or open header guards with exact opening/definition/closing ranges, anonymous C typedef bodies/names, enum bodies/items/assignments/repeats, conservative inline-member definition/body ranges with constructor/function/destructor callable kinds, out-of-line member definition/body ranges, terminal names/callable kinds, and namespace-scope free-function definitions with normalized and default-free forward-declaration signatures, free-function declarations and reference edges, repeated default-argument removal ranges for matching prior declarations, and bounded `config*` calls with loop/binding context and UTF-16 ranges | `src/analysis.rs` via `peach-registry analyze declarations` | Rust is authoritative for transformed structural discovery and configuration calls; incomplete enum syntax remains an explicit unsupported result |
| Numeric constant discovery | Synthesized or transformed C++ source plus an initial typed constant table and optional concrete owner | Validated macro, named/anonymous enum, scalar/comma declaration, namespace-global, string-array, and owner-scoped `std::array` size/label constants | `src/analysis.rs` via `peach-registry analyze constants` | Rust only; compatibility expectations live in `tests/analysis_contract.rs` |
| Rack source adaptation | Locked source and compatibility headers | `adapter.cpp`, `adapter.json`, `runtime.json` | `scaffold-library-module.mjs` | Incremental Rust components |
| Configuration expansion | Structured raw or active-source `config*` call facts, constants, counted loops, and local string bindings | Ordered expanded argument strings | `src/abi.rs` via `peach-registry abi config-expansions` | Rust only; the legacy Node call scanner and model-report call cache have been removed |
| Port enum layout | Structured parameter/input/output/light enum items and constants | Validated counts and ordered runtime IDs, including assignments, repeats, and terminal count enumerators | `src/abi.rs` via `peach-registry abi layout` | Rust-only layout; Node retains only incomplete/custom or explicitly unindexed enum-discovery compatibility and explicit overrides |
| Integer expression evaluation | Validated constants and bounded configuration/count expressions | Safe integers or explicit unsupported values | `src/abi.rs` via `peach-registry abi integers` | Rust only for the structured batch boundary |
| Finite number evaluation | Validated constants and bounded parameter metadata expressions | Finite numbers or explicit unsupported values | `src/abi.rs` via `peach-registry abi numbers` | Rust only for the structured batch boundary |
| String expression evaluation | Validated constants and bounded configuration-name expressions | Static strings or explicit unsupported values | `src/abi.rs` via `peach-registry abi strings` | Rust only for the structured batch boundary |
| Shared ABI tail | Validated module type and parameter/input/output/light counts | Byte-compatible `RackWebModuleTraits` specialization and `RACK_WEB_EXPORTS` invocation | `src/abi.rs` via `peach-registry abi wrapper` | Rust only; the frozen byte contract is covered independently in `tests/abi_contract.rs` |
| Compilation | Generated C/C++, ordered source units, include roots, and structured standard/optimization/definition/SIMD/LTO/memory options | Standalone `module.wasm` with the fixed `rack_web_*` export allowlist | `src/compiler.rs` via `peach-registry compile wasm`; Emscripten `emcc`/`em++` remains the compiler backend | Rust-only plan validation, ABI allowlist, canonical flag construction, process orchestration, and cleanup; Emscripten code generation |

The source adapter is not one boundary. Source locking, syntax discovery,
dependency selection, browser compatibility transforms, enum-layout evaluation,
module-specific ABI assembly, and compiler invocation must be separated before
their implementations are changed. Special-case transforms stay behind the same
generated-file contract until a fixture proves the replacement.

## Compatibility contracts

The following behavior is migration-blocking:

- Registry schema version `1` and browser ABI `0.3` remain readable by existing
  consumers.
- A package key remains `<plugin>/<model>` and its versioned artifact and
  manifest remain under `packages/<plugin>/<model>/<version>/`.
- Index and manifest identity, paths, artifact byte length, and SHA-256 digest
  agree. Catalog `packageCount` and `totalBytes` agree with package records.
- The consumer CLI retains case-insensitive lookup, local paths, `file:` URLs,
  HTTP(S), `PEACH_PATCH_REGISTRY`, atomic installation, and digest verification.
- `source:scaffold` retains its JSON stdout result and generated
  `adapter.cpp`/`adapter.json`/`runtime.json` files. Unsupported source remains a
  structured assessment rather than a false successful build.
- Rust analysis paths and the Node checkout root use the same canonical file
  identity before include traversal, dependency selection, or deduplication.
- Batch scheduling retains plugin-group checkout reuse, bounded concurrency,
  adapter timeouts, failure assessments, state/catalog persistence, staged WASM
  and component assets, and optional source/build cache retention.
- Emscripten output retains the documented `rack_web_*` ABI and observable DSP,
  state, asset, MIDI, capture, and geometry behavior protected by fixtures.

Rust compatibility tests use the deterministic registry under
`tests/fixtures/registry/`. They exercise the installed `peach` binary instead
of calling implementation functions, so argument parsing, filesystem layout,
manifest installation, and failure messages remain covered. Repository tests
independently reject artifact tampering, manifest drift, and path drift. The full
checkout verifier then applies the same Rust contract to every published
package.

## Migration sequence

1. **Repository verification:** complete. The Rust maintenance binary owns the
   implementation; the old Node entrypoint only forwards existing callers.
2. **Publication:** complete. `peach-registry publish` owns safe package paths,
   digest generation, manifest assembly, atomic file replacement, and index
   totals. The Node entrypoint remains as a tested release compatibility shim.
3. **Discovery:** complete. Rust snapshots an exact Library Git revision,
   filters open-source manifests, rejects unsafe slugs, and writes the queue
   atomically. The existing Node command is a tested compatibility shim.
4. **Build scheduling:** complete. Rust owns queue/state validation, plugin-group
   concurrency, bounded adapter output and process-group timeouts, structured
   failures, artifact/component staging, and cleanup. The Node source adapter
   remains an explicit, fixture-backed subprocess contract.
5. **Source acquisition:** complete. `peach-registry source prepare` owns URL
   normalization, official Library gitlink/tag resolution, immutable cache
   checkout, interrupted-clone recovery, nested gitlink validation, and source
   provenance. The Node adapter consumes one structured result and retains only
   fixture-mode source setup for its isolated transformation tests.
6. **Source adaptation:** in progress. Rust now owns the source-file/nested
   repository inventory, code-aware templated, custom `Model` lambda, and
   MetaModule `GenericModule<...>::create()` registration scanning, nested
   template and call argument splitting, registration string constants with evaluated static
   values, and single-widget registration resolution through Rust-resolved include
   context plus widget inheritance facts, scoped `using`/`typedef` aliases, direct
   include directives and deterministic target resolution across importer
   directories, repository roots, `src/`, and unique ranked suffixes, plus
   same-stem companion implementation selection with duplicate initialized-global
   rejection. `peach-registry analyze dependencies`
   now owns transitive closure and removes only include branches proven inactive
   by unambiguous object-macro values; unknown expressions preserve every branch.
   Every standard scaffold CLI invocation, including fixture-mode builds, enables
   this Rust inventory/model/dependency path by default. The explicitly reviewed
   Neil nested-source selection remains a compatibility exception. The former Node
   directory walkers, nested-repository discovery, include-closure traversal,
   companion selection, and duplicate-global checks have been removed; the
   historical `--use-rust-analysis` argument is accepted only for command
   compatibility. The Node model adapter validates and caches the Rust report's
   file-keyed raw include directives, UTF-16 offsets, delimiter kinds, and optional
   canonical targets before any standard immutable-checkout consumer can use them.
   `peach-registry analyze preprocess` now owns newline normalization, supported
   `#if`/`#ifdef`/`#ifndef` branch selection, active object `#define`/`#undef`
   tracking, and bounded recursive object-macro expansion outside definition
   blocks, comments, and string/character literals. The same report now carries
   active angle and quoted include directives, so Node applies browser-system-header
   and external-path policy without rescanning preprocessed C++ directives.
   Conditional dependency pruning, dependency system-header re-emission, directly
   included `.cpp` recursion, its nested header selection, class-body header
   lookup, model-definition lookup, vendored dependency traversal,
   dependency-header ordering, UI-header recursion, DMA support lookup, and widget
   support traversal, adapter include metadata, and source-specific compiler
   include/quote-root discovery consume the structured active or raw directive
   lists. Registration lookup preserves the Rust-reported quoted-directive order:
   canonical directive targets choose the preferred module definition and the
   headers that precede it. Only a directive without a canonical target, or an
   explicitly unindexed compatibility source, uses the source-root-confined path
   fallback. Recursive class-body header expansion consumes raw directives from
   the same Rust declaration report, while Node retains exact-line validation,
   indentation, bounded recursion, macro-state threading, and source-root path
   policy. That report also carries exact UTF-16 ranges, directive kinds, and
   comment status for raw `include`/`pragma`/`define` lines. Module-prelude and
   dependency-source cleanup apply those Rust ranges while preserving active
   defines; UI-header removal, browser-asset dependency selection, and removal of
   already-inlined dependency includes, plus Airwindows unity-build aggregation,
   use the Rust include candidates with Node retaining only whole-line validation,
   absolute-path emission, and browser policy. The
   all-branch side of inactive-dependency comparison also consumes the batch raw
   map for indexed files. Pre-analysis source acquisition uses the Rust
   `analyze includes` batch inventory, while arbitrary unindexed source uses the
   Rust declaration report on demand; the general Node raw include scanner has
   been removed.
   Unknown complex conditions
   and all of their directives remain conservative source. Rust is now the sole
   preprocessor for this boundary; the previous Node implementation has been
   removed, while byte-for-byte source and definition-table expectations remain
   in `tests/analysis_contract.rs` and macro-configured fixture tests.
   The declaration report also owns raw object-like and function-like macro
   discovery: it reports names, parameter lists, normalized continuation bodies,
   comment status, and exact UTF-16 ranges while excluding block-comment,
   string, and raw-string false positives. Registration-macro expansion,
   dependency reachability, and decoration semantics remain Node policy, but
   their macro candidates no longer come from independent JavaScript scanners.
   Conditional-directive and header-guard discovery also comes from this report.
   It distinguishes direct `#if FLAG`/`#elif FLAG` facts used for conservative
   dependency pruning from `#ifndef` and `#if !defined(...)` include guards, and
   reports the matching `#endif` range when present. The same report pairs every
   general conditional opening with its closing directive, including incomplete
   blocks. Node retains value-selection, dependency-removal, exact source-edit,
   `extern "C"` flattening, and source-specific conditional-include policy without
   rescanning directive grammar.
   `peach-registry analyze declarations` consumes that active source boundary and
   reports scoped type/template/base and alias facts, namespace-scope constant
   and variable statement/name/declarator ranges with exact type source, array
   extent, initialized/pure-`extern`, and enclosing `extern "C"` linkage facts,
   qualified namespace `using` declaration and namespace `using` directive
   ranges with their enclosing namespace stacks, enum/item ranges, raw
   out-of-line members, namespace-scope free-function declarations, definitions,
   their repeated default-argument removal ranges, and their reference edges,
   and bounded `config*` call ranges, including enclosing counted loops and
   preceding local string bindings, using UTF-16 offsets.
   Macro-configured declarations and classes whose raw braces become balanced only
   after branch selection now use those Rust facts directly. Transformed type syntax
   outside the supported declaration grammar is rejected at this boundary instead
   of silently switching to an independent Node body parser.
   `peach-registry analyze constants` accepts the synthesized source boundary used
   by the adapter and evaluates object macros, preprocessed named/anonymous enums,
   scalar and comma declarations, namespace globals, static string arrays, and
   concrete-owner `std::array` sizes plus indexed `.name` labels over four
   compatibility passes. The owner-scoped facts are available before inherited
   template constants are evaluated. Rust is now the sole typed-table producer;
   the former Node constant scanner has been removed from production and its
   compatibility cases remain in `tests/analysis_contract.rs`.
   Complete declaration/body, anonymous C `typedef struct`/`union`/`enum`
   declaration/name/body, scoped type-alias, raw out-of-line member-function, defaulted-member,
   static-data, and namespace-scope free-function ranges use JavaScript-compatible
   UTF-16 offsets, so Node now slices raw module and inherited DSP bodies, their
   direct class implementations, referenced free helpers, and their preceding
   support prelude from Rust facts instead of independently locating declarations
   and matching braces. Anonymous typedef facts are normalized into the same
   selection model in Node; the former anonymous-body brace scanner and its broad
   typedef-name fallback have been removed. They now carry an explicit
   `namespaceScope` fact as well, so local anonymous C typedefs cannot enter a
   reusable dependency closure. Rust also reports code-level free-function reference edges,
   which replace Node's recursive rescanning for indexed raw sources. Out-of-line
   function facts also carry a comment-insensitive normalized signature. Generated
   adapter deduplication now groups those Rust signatures with Rust type-namespace
   facts and removes later Rust ranges; it no longer scans member-definition syntax
   or matches braces in Node. Namespace-scope free-function facts carry normalized
   signatures and default-free declaration signatures as well; exact repeated definitions are grouped within their Rust
   namespace and removed by Rust ranges, while overloads, changed bodies, and
   same-text functions in different namespaces remain distinct. Matching prior
   declarations and definitions are also compared in Rust after removing top-level
   parameter defaults. Rust returns the repeated default-value ranges from the
   definition, and Node only validates and applies those UTF-16 spans. General
   namespace helper forwards consume Rust's default-free declaration signature;
   implementation-support and cross-file helper closures carry the full Rust
   candidate and emit its normalized signature and namespace directly. Node no
   longer reparses selected definitions to recover a forward declaration. Only
   known decoration-macro normalization and output ordering remain in Node; the
   decoration macro names and replacement bodies come from the Rust declaration
   report. Rust's
   boundary enumerator accepts declarations immediately after newlines, semicolons,
   and braces, including compact same-line namespace definitions. Free
   helpers that depend on a complete target or inherited type are likewise moved
   with Rust definition ranges and namespace facts; Node retains only the type-reference
   policy and output ordering. Rust out-of-line facts also distinguish ordinary
   functions from constructors and destructors and expose their terminal names.
   Name-based helper extraction combines those qualified callable facts with Rust
   free-function facts without scanning C++ definitions in Node. Removing selected
   out-of-line functions now filters the same Rust owner chains and applies their
   ranges, preserving static data and defaulted members without Node brace matching. Out-of-line facts
   also carry the full nested owner chain, so selecting an outer DSP type
   retains implementations owned by nested quantity/helper types without reparsing
   their qualified names in Node. Named source-specific helper removal and
   Daily Fortune helpers and plugin-wide `void init(Plugin*)` cleanup now select Rust namespace-scope
   free-function facts and delete their exact ranges; Node retains only those
   adapter policies and no longer scans bodies or matches braces. Referenced
   DSP helpers with `Vec` parameters are likewise selected from Rust signatures
   and raw definitions, with Node retaining only the reference and parameter policy.
   Residual Rack UI functions and declarations are selected from Rust free-function
   and out-of-line owner/signature facts; Node retains only the UI policy and applies
   Rust ranges without a definition or brace scanner.
   Conditional SIMD template implementation normalization likewise consumes Rust
   out-of-line owner, namespace, raw-definition, and range facts; Node retains the
   policy that prefers explicit specializations for classes guarded by `RACK_SIMD`.
   Browser-specific replacement of selected out-of-line methods uses the first
   matching Rust owner/member range, including constructor and destructor facts,
   instead of matching qualified method text and braces in Node.
   Embedded-resource documentation stubbing consumes Rust out-of-line signature
   and body ranges. Node retains only the `std::string` and active CMRC-filesystem
   policy, with comments and literals excluded from that policy check.
   Surge VCO and FX explicit-specialization extraction consumes the same Rust
   owner, member, signature, and raw-definition facts. Node retains the concrete
   template-argument selection, UI exclusions, and the generic VCO configuration
   fallback policy.
   Removal of the specialized Surge Rack custom editor selects the first matching
   Rust `VCOConfig::createCustomEditorAt` owner/member/signature fact and applies
   its definition range; Node retains only that browser UI policy.
   Conservative inline-member facts include nested owner chains, normalized
   signatures, constructor/function/destructor callable kinds, and body ranges.
   A synthetic class wrapper gives class-body fragments the same Rust structural
   boundary while preserving source-relative UTF-16 offsets. Browser stubbing of the first matching inline
   `void guaranteeRackUserWavetablesDir(...)` method now applies that Rust body
   range. Generic inline-body replacement, prepend, and append helpers also select
   these Rust facts; Node retains their caller-supplied signature policy regexes
   and replacement text. Host-only direct module methods are selected from the
   same inline-member facts before Node applies its browser-host API policy and
   chooses the stub return form; methods inside nested classes are not treated as
   direct module members. UI class-body cleanup also consumes those direct method
   facts for signature filtering and host-body stubbing, while the remaining
   member-declaration and nested-type compatibility scan stays in Node.
   Repeated namespace-scope types and exact enum declarations are deduplicated from
   Rust declaration ranges and namespace facts; nested declarations and same-name
   declarations in other namespaces remain outside that policy.
   Repeated namespace variables and exact constant definitions are now deduplicated
   from Rust variable ranges. Referenced namespace globals, qualified `using`
   declarations, namespace preludes, plugin `std` imports, and implementation-support
   `using namespace` directives are selected from the same Rust facts. Node retains
   dependency reachability, target normalization/lifting, namespace-relative wrapping,
   browser model-identity rewriting, and declaration-before-directive output ordering,
   but no longer discovers their scopes or statement ends.
   Pure `extern` reference names and exact-target-namespace global definitions also
   consume this report, eliminating the remaining Node declaration regexes on these
   linking paths.
   Plugin-wide fallback definitions for referenced `extern` globals now consume
   the same Rust type, array, namespace, and C-linkage facts. Node retains only
   reference reachability, known browser defaults, locked-definition preference,
   and emission policy; it no longer parses declarators or matches linkage braces.
   The batch model report's namespace-variable and qualified-`using` maps are active
   for standard immutable files. Dependency extern collection no longer has a raw
   declaration regex. When a dependency header has already passed through UI and
   header-guard removal, Node projects the original Rust `using` candidates by
   exact retained declaration text; it does not rediscover their target or scope.
   For files in
   the standard Rust inventory, missing declarations and aliases remain missing
   instead of falling through to a second Node parser. The same report carries namespace/type-owner stacks and
   general `struct`/`class`/`union` template parameters and inheritance bases,
   plus named and anonymous enum declarations, lexical scopes, items,
   assignments, supported repeat macros, and explicit completeness markers.
   The same report now inventories the bounded Rack `config`, `venomConfig`,
   `configParam*`, `configSwitch`, `configButton`, `configInput`, `configOutput`,
   `configBypass`, `configOnOff*`, `configMenuParam`, and `rackWebSnapParam`
   call set with templates, raw/split arguments, scopes, enclosing counted
   `for` loops, preceding local `auto`/`string` bindings, and UTF-16 ranges.
   Rack's equivalent `paramQuantities[id]->snapEnabled = true` and
   `getParamQuantity(id)->snapEnabled = true` assignments are normalized into
   explicitly marked synthetic `rackWebSnapParam` facts at the same boundary.
   Node validates and consumes those structured facts for module-template binding,
   transitive base discovery, immutable-checkout include traversal, and exact-scope
   direct module/global port-enum selection. Complete Rust enum and registration-string
   results become active directly without a compatible Node shadow comparison;
   unknown enum syntax is marked incomplete instead of being guessed, while remaining
   transformed or unindexed enum-discovery compatibility paths are called out below.
   All direct, inherited, out-of-line, preprocessed, and synthesized configuration
   calls are discovered by `peach-registry analyze declarations`. `peach-registry abi
   config-expansions` is the sole bounded counted-loop/context expansion and local
   string-binding substitution implementation. The legacy Node call scanner and its
   duplicate model-report cache have been removed. `peach-registry abi strings`
   evaluates the supported configuration-name subset: string constants, JSON-compatible
   C++ literals and wrappers, literal/`std::to_string` concatenation, indexed string
   constants, and `string::f` integer/character formatting. Standard parameter and
   port names plus local loop bindings are evaluated in Rust batches. Unsupported
   dynamic strings remain explicit unsupported values; Node still evaluates bespoke
   source-specific metadata paths outside this structured batch boundary.
   `peach-registry abi integers` solely owns structured integer evaluation for direct
   `config(...)` counts and counted-loop bounds. `peach-registry abi numbers` uses the same safe
   expression grammar for standard direct parameter minimum, maximum, and default
   values, including finite fractional results. These values are evaluated in one
   batch. Compatibility expectations remain in `tests/abi_contract.rs` rather than
   duplicated production wrappers.
   Ambiguous/unresolved dependency edges and files outside the standard Rust
   inventory, such as explicitly selected nested/external compatibility roots,
   retain conservative Node include and implementation selection. Indexed
   immutable raw include lists, type bodies, aliases, out-of-line members,
   free-function definitions, and free-function reference edges do not use an
   independent Node discovery fallback. Active macro-preprocessed and synthesized
   type bodies, inheritance bases, declaration namespaces, aliases, out-of-line
   members, free-function closures, whole-type removal, template parameter binding,
   templated-widget inheritance traversal, module-prelude declaration starts,
   referenced sibling-module candidates, and namespace-scope `ParamQuantity` helper
   selection also use those Rust declarations rather than Node discovery regexes.
   Generic dependency-name discovery now merges Rust namespace-scope types,
   anonymous typedefs, enums, aliases, free-function declarations/definitions,
   and namespace variables in source order. Dependency-header function names,
   qualified identities, and reachable namespace names come from the same report;
   the former Node declaration/scope scanner and per-function namespace rescan
   have been removed.
   Referenced plain support types declared before a module are likewise selected
   and sliced from Rust type ranges, with Rust namespace facts used for wrapping.
   Dependency enum backfill now iterates complete Rust enum declarations and
   identifiers directly; it no longer rescans enum syntax or recomputes scope in
   Node.
   `plugin.hpp` support aliases, ordinary types, and enums now form one
   source-ordered fixed-point closure over the same Rust facts; Node retains the
   policy decisions about reachability and Rack UI exclusion but no longer scans
   their C++ declaration syntax. The explicit namespace-scope facts prevent local
   function aliases, types, or enums from being mistaken for reusable adapter
   declarations. The `plugin.hpp`/`plugin.cpp` free-helper fixed point likewise
   consumes Rust function-definition ranges and code-level reference edges across
   both files, and its selected header forward declarations come from Rust ranges;
   Node seeds the reachable roots and applies UI/host exclusion policy without
   rediscovering helper declaration or definition syntax. `plugin.hpp` constants
   likewise come from Rust namespace-scope declaration
   ranges. Node retains root reachability and macro-collision policy, computes
   transitive constant references outside comments and literals, and emits each
   selected dependency before its dependent without rescanning constant syntax.
   Explicitly unindexed
   raw roots now request type bodies and scoped/simple aliases from the same Rust
   declarations command on demand; the general Node `structBody`/class matcher and
   typedef/using discovery fallbacks have been removed. The shared recursive
   C/C++ file walker is now `peach-registry analyze files`; its explicit
   `dependency` and `vendor` profiles freeze the two reviewed exclusion/extension
   policies, return sorted confined inventories for a checkout or selected subtree,
   and replace both former Node directory traversals. Node still selects which
   vendored containers participate in a module. Node still owns
   free-helper root reachability and UI/host exclusion, semantic dependency extraction
   beyond the include/function graphs, compatibility transforms, module-specific
   C++ assembly, explicit compatibility overrides, and source-specific compiler-option
   discovery. Nearest-target duplicate filtering, exact-namespace and referenced-global
   enum selection, and qualified-alias/terminal resolution now consume Rust declaration
   facts. Node retains only incomplete/custom transformed enum syntax and explicitly
   unindexed compatibility roots at discovery, plus explicit module overrides.
   `peach-registry abi layout` solely evaluates structured enum expressions,
   assignments, repeats, terminal counts, and ordered runtime IDs; Node retains only
   the explicit transformed/unindexed enum-discovery compatibility paths around that
   Rust evaluation boundary.
   Explicit configuration or module-specific count overrides
   remain authoritative. `peach-registry abi wrapper` is now the sole producer of
   the shared traits/macro tail; its frozen output contract remains in the Rust
   compatibility suite rather than production JavaScript. `peach-registry compile
   wasm` is now the only WASM compile entry used by the adapter. It owns the
   complete linked ABI allowlist, validates the structured plan,
   constructs canonical Emscripten arguments, and owns compiler process execution,
   C-object ordering, failure propagation, and temporary-object cleanup;
   Emscripten remains the C/C++ compiler and WebAssembly linker. There is no direct
   Node `emcc`/`em++` fallback. Linker multiple-definition compatibility selection
   now compares Rust-reported out-of-line callable owner/member facts across headers,
   the generated adapter, and separately linked implementation units; Node retains
   only the decision to enable that browser compatibility linker option. This also
   covers a dependency implementation intentionally lifted into the adapter while
   its original translation unit remains linked for companion data.
   Continue with one independently testable analysis or transform at a time; do
   not mechanically translate the monolithic script and call that a boundary.
7. **Node removal:** remove a compatibility shim only after repository scripts,
   CI, documentation, and downstream callers use its Rust replacement.

## Required gates

Run these gates for every migration step:

```sh
cargo fmt --check
cargo test
node --test tests/tool-entrypoints.test.mjs
node scripts/verify-registry.mjs
npm run test:provenance
git diff --check
```

Changes to source extraction, compatibility headers, generated compiler flags,
or the WASM ABI additionally require the relevant focused builder fixtures and
runtime instantiation checks. A stalled or selectively run builder suite must be
reported as incomplete rather than treated as a green full gate.
