# Building modules

This document describes the reproducible build boundary for Peach Patch Registry.

## Toolchain

The compiler is Emscripten's `em++`, which provides Clang/LLVM and the WebAssembly linker. The repository does not implement a C++ compiler. Rust resolves and checks out immutable source, then `peach-registry compile wasm` validates a structured plan, supplies the fixed Rack Web export allowlist, constructs the canonical `emcc`/`em++` flags, owns object and link ordering, propagates backend errors, and cleans temporary objects. This Rust command is the sole WASM compile path; there is no direct Node compiler fallback. The JavaScript adapter still performs C++ source selection, compatibility adaptation, source-family option policy, and compile-plan assembly. Generic root Makefile and CMake inputs are discovered and path-validated by Rust before that plan is assembled.

Rust replaces repository tooling around this compiler boundary; it does not
replace the upstream C++ compiler. See [RUST_MIGRATION.md](RUST_MIGRATION.md) for
the stable interfaces and incremental replacement gates.

The required commands should be available on `PATH`:

```sh
node --version       # 22+
em++ --version       # Emscripten
git --version
tar --version
```

`runtime:build` compiles the checked-in files in `web-runtime/plugins/`. `source:scaffold` and `source:build` additionally need network access to the VCV Library index and upstream source repositories unless their caches are already populated.

## Two build paths

### Bundled runtime modules

`web-runtime/modules.json` is generated from the manifest source and binds a registry key to a C++ entry, output name, memory budget, and compatibility strategy. `scripts/build-web-runtime.sh` validates the manifest, compiles each selected entry with `em++`, emits standalone WASM, and exports only the stable `rack_web_*` symbols.

```sh
npm run runtime:manifest
npm run runtime:build -- Fundamental/VCO
```

These artifacts are useful for the Peach Patch website's built-in fallback catalog. They are not automatically published to the registry; use the publisher after checking their metadata and license.

### Official-source builds

The dynamic pipeline crosses a deliberate Rust/Node boundary:

1. `peach-registry source prepare` reads the official Library manifest and resolves the exact plugin revision or gitlink.
2. Rust checks out the source, recovers matching interrupted clones, and recursively validates locked submodules.
3. Rust inventories C/C++ files outside development trees and reports each initialized nested repository boundary. `peach-registry analyze files --profile dependency|vendor` also owns the two reviewed filtered recursive C/C++ inventories used for dependency or selected-subtree scans; the adapter no longer carries a C/C++ filesystem walker. Node still decides which vendored containers are relevant to the selected module.
4. Rust lexically identifies direct include directives and model-factory candidates, resolves unique include targets across importer/repository/`src` paths and ranked suffix matches, selects safe same-stem companion implementations, computes transitive dependency closure, conservatively prunes proven-inactive conditional branches, reports active angle and quoted includes from that same preprocessed source, splits nested template and call arguments, and collects constant string registrations with their evaluated static values, raw object/function macro definitions with parameter lists and normalized continuation bodies, structured conditional directives with direct simple-macro facts and general opening/closing block pairs, paired or open header guards with exact opening/definition/closing ranges, namespace-scope constant declaration ranges, scoped type aliases, enclosing namespace/type-owner stacks, complete general type, anonymous C typedef, and enum declarations, parsed enum items/assignments/supported repeats with completeness markers, bounded Rack `config*` calls and synthetic `snapEnabled = true` parameter facts with template/raw/split arguments plus enclosing counted loops and preceding local string bindings, conservative inline-member definition/body ranges with constructor/function/destructor callable kinds, raw out-of-line member functions with definition/body ranges, terminal names, callable kinds, and comment-insensitive normalized signatures, defaulted/deleted members, static member data, namespace-scope free-function declarations and definitions with normalized and default-free forward-declaration signatures, repeated default-argument removal ranges for matching prior declarations, and their code-level reference edges with UTF-16 ranges while excluding comments and string/raw-string false positives.
   This Rust analysis is the default for official and fixture scaffolds; the older `--use-rust-analysis` flag remains a harmless compatibility argument. The reviewed Neil nested-source selection is the only current root-inventory exception.
   Its registration report covers templated factories, custom `Model` lambdas,
   and MetaModule `GenericModule<...>::create()` calls. A one-argument templated
   factory also carries its Rust-resolved include context, widget namespace, and
   inherited module type. For directly inventoried
   files those syntax facts are authoritative; Node retains slug/type resolution
   policy and fallback scanning only for macro-expanded or explicitly unindexed
   compatibility sources.
   The model report and active-source declaration report also carry namespace-scope
   variable statement/name/declarator ranges with exact type source, array extent,
   initialized/pure-`extern`, and enclosing C-linkage classification, plus qualified
   `using ns::Name;` ranges and `using namespace ns;` ranges with their enclosing
   namespace stacks. Anonymous C typedefs include an explicit
   namespace-scope classification.
   `peach-registry analyze makefile` separately accepts a checkout-relative
   Makefile and explicit source-variable names, then reports unconditional and
   conditional `-D` definitions, canonical checkout-confined `-I` directories,
   and bounded variable-expanded C/C++ files. The Node adapter validates and
   consumes that report; it no longer parses root or nested Makefiles for generic
   compiler inputs. `peach-registry analyze cmake` likewise reports bounded
   numeric/boolean cache definitions without a Node CMake scanner. ChucK's
   dedicated `EMSCRIPTENSRCS` list uses the same Rust contract; only selection of
   that source-family variable and the Surge libsamplerate compatibility define
   remain explicit Node policy.
5. The Node adapter validates and consumes those facts to traverse immutable-checkout dependencies, slice raw module/inherited DSP declarations, anonymous C typedefs, direct class implementations, transitively referenced free helpers, and support preludes, bind scoped aliases, specialize module templates, traverse plugin-defined DSP bases, select exact-scope direct module/global port enums, and locate direct inline module methods before applying browser-host stubbing policy. For files in the standard Rust inventory, raw type bodies, anonymous typedef names/bodies, namespace-scope constants and variables, qualified namespace `using` declarations, namespace `using` directives, scoped aliases, out-of-line members, inline-member body ranges, free-function declarations/definitions, and their reference edges are authoritative Rust facts: a missing fact does not silently invoke a second Node discovery parser. Rust is also the sole implementation for source normalization, supported conditional-branch selection, active object-definition tracking, recursive object-macro expansion outside definition blocks, comments, and literals, and active include-directive discovery; unknown complex conditions are preserved. Node validates those include facts and retains browser-system-header filtering plus external-path selection without a second active-directive regex; conditional dependency pruning, dependency system-header re-emission, directly included `.cpp` recursion and nested-header selection, and class-body header lookup consume the Rust directive list. The raw all-branch comparison consumes Rust raw directives from per-file reports or one batch `analyze includes` source inventory before those reports exist; no Node raw include scanner remains. Rust reports type body/template/base, namespace-scope classification and constant ranges, anonymous typedef, scoped alias, enum item/assignment/repeat, out-of-line member ranges, terminal names, callable kinds, and normalized signatures, namespace-scope free-function declaration/definition/signature/reference facts, default-free forward-declaration signatures, repeated default-argument removal ranges, and bounded configuration-call ranges directly from preprocessed or synthesized source. Generated class-member deduplication groups those signatures with Rust namespace facts and removes later Rust ranges without a Node member-definition scanner. Exact repeated free-function definitions are likewise removed within their Rust namespace from Rust ranges; overloads, changed bodies, and identical functions in different namespaces remain distinct. When a prior declaration in the same Rust namespace has the same signature after removing top-level defaults, Rust reports only the repeated default-value spans in the definition; Node validates and applies those spans without parsing C++ parameters. General namespace helper forwards use Rust's default-free declaration signature, while implementation-support and cross-file helper closures carry full Rust candidates and emit their normalized signature plus namespace directly; Node no longer parses selected definition text or recomputes its scope. Rust enumerates declaration boundaries after newlines, semicolons, and braces, including compact same-line namespace definitions. Free functions that must be emitted after a complete target or inherited type are selected by policy from their Rust raw definitions, removed by Rust ranges, and wrapped with Rust namespaces; Node no longer rediscovers their syntax or matches their braces. Name-based helper extraction merges ordinary Rust free-function facts with Rust-qualified callable facts while excluding constructors and destructors, so namespace-qualified implementations retain their original definition form without a Node function scanner. Removing inherited, host-only, or source-specific out-of-line function bodies likewise filters Rust owner chains and applies Rust ranges; defaulted members and static data remain intact without a Node qualified-name or brace scanner. Complete enum and registration-string facts are consumed without Node shadow comparisons; transformed inheritance-base lookup, declaration namespaces, whole-type removal, module-template parameter binding, templated-widget inheritance traversal, module-prelude declaration starts, referenced sibling-module and namespace-scope `ParamQuantity` helper selection, aliases, member implementations, free-function closures, active type declarations, and every standard direct, inherited, out-of-line, and synthesized `config*` call are likewise consumed without an independent Node discovery shadow. Repeated namespace variables/constants, pure `extern` reference names, exact-target-namespace and referenced global definitions, qualified `using` declarations, and namespace `using` directives consume Rust scopes, classification, and UTF-16 statement ranges; Node retains only deduplication/reachability, target normalization/lifting, namespace-relative wrapping, browser model-identity, and declaration-before-directive emission policy. Referenced plugin-wide `extern` fallback definitions additionally consume Rust type source, array extent, namespace, and C-linkage facts; Node retains default-value, locked-definition, reachability, and emission policy without parsing declarators or matching linkage braces. `plugin.hpp` support aliases, ordinary types, and enums are selected as one source-ordered transitive closure over Rust declarations. Its `plugin.hpp`/`plugin.cpp` free-helper closure also consumes Rust declaration/definition ranges and reference edges across both files. `plugin.hpp` constants are selected from Rust namespace-scope declaration ranges; Node retains root reachability and macro-collision policy, follows transitive constant references outside comments and literals, and emits dependencies before dependents. Node still seeds helper reachability and applies Rack UI/host exclusion policy. Explicitly unindexed roots request type bodies and scoped/simple aliases from the same Rust declaration command on demand; the general Node class/body and typedef/using discovery fallbacks have been removed. Rust expands supported counted loops and local string bindings from structured configuration calls in one request and is the sole producer of the complete typed constant table, including concrete-owner `std::array` sizes and indexed labels. Structured configuration expansion plus bounded integer, finite-number, string, and enum-layout evaluation are also Rust-only boundaries with compatibility expectations in Rust tests. Ambiguous or unresolved includes, unknown preprocessor expressions, incomplete/transformed enum syntax, legacy custom factories, and explicitly unindexed nested/external compatibility roots retain conservative include/implementation selection behavior; Node still chooses root helpers, applies UI/host exclusions, and owns source-specific metadata transforms and C++ assembly.
   For indexed immutable files, the raw all-branch comparison consumes the model
   report's validated file-keyed directive/target map. Pre-analysis source
   acquisition uses one Rust `analyze includes` inventory, and arbitrary unindexed
   source uses the Rust declaration report on demand. Model-definition lookup,
   vendored dependency traversal,
   dependency-header ordering, UI-header recursion, DMA support lookup, and widget
   support traversal, adapter include metadata, and compiler include/quote-root
   discovery use the same Rust raw directive facts. Compiler-link collision
   detection likewise compares Rust out-of-line callable facts instead of scanning
   `Class::method(...)` syntax in Node; enabling the compatibility linker flag remains
   an explicit Node policy decision. Header free-function lifting also consumes
   those directive facts and skips headers that the generated prelude still includes,
   so inline helpers are never copied beside their original definition.
   Registration-file lookup preserves the Rust-reported quoted-include order and
   uses each canonical target for preferred module-definition selection and
   preceding-header ordering. Null-target or explicitly unindexed compatibility
   directives alone use the source-root-confined path fallback.
   Recursive headers embedded inside a module class are discovered by the raw
   directive list in Rust's declaration report. Node keeps only whole-line and
   indentation preservation, bounded recursive expansion, macro-state threading,
   and source-root path policy.
   The same report identifies raw `include`, `pragma`, and `define` directives by
   kind, comment status, and exact UTF-16 range. Standard module-prelude and
   dependency cleanup remove Rust ranges while retaining active defines. UI-header
   filtering, browser-asset dependency selection, and already-inlined include
   removal, plus Airwindows unity-build aggregation, consume Rust include
   candidates; Node retains browser policy, absolute-path emission, and exact-line
   validation rather than a second directive scanner.
   Raw object-like and function-like macro definitions are likewise Rust facts,
   including names, parameters, normalized continuation bodies, comment state,
   and exact ranges. Node retains model-registration expansion, dependency
   reachability, and function-decoration policy without rescanning macro
   declarations.
   Conditional directives and include guards are likewise discovered in Rust.
   Direct `#if FLAG` and `#elif FLAG` facts feed conservative dependency pruning;
   `#ifndef` and `#if !defined(...)` guards carry their matching definition and,
   when present, closing `#endif` ranges. All general conditional openings also
   carry their paired closing directive when one exists. Node validates those
   facts and retains value selection, dependency removal, exact source editing,
   `extern "C"` flattening, and source-specific guarded-include policy without a
   second directive grammar scan.
   Standard namespace-variable and qualified-`using` consumers use the batch model
   maps as well. Dependency extern collection consumes Rust type, name, array,
   namespace, initialization, and C-linkage fields without a Node declarator regex.
   UI-filtered headers retain only exact Rust-reported `using` declarations still
   present after policy transforms; Node does not reparse their C++ syntax.
   Source-specific named helper removal, Daily Fortune helper cleanup, and plugin-wide `void init(Plugin*)` cleanup also select namespace-scope Rust free-function facts and apply their exact ranges. Referenced DSP helpers with `Vec` parameters are selected from the same Rust signatures and raw definitions rather than rediscovered with a Node function/body scanner. Residual Rack UI free-function definitions/declarations and out-of-line UI-owner methods are also removed from Rust ranges. Conditional SIMD template normalization consumes Rust out-of-line owner, namespace, raw-definition, and range facts when selecting explicit specializations over inactive generic implementations. Browser-specific method-body replacement also selects the first matching Rust owner/member range, including constructors and destructors, without matching `Class::method` text or braces in Node. CMRC-backed `std::string` documentation stubs consume Rust signature and body ranges while Node retains only the browser-resource policy. Surge VCO/FX explicit-specialization extraction likewise consumes Rust owner/member/signature/raw-definition facts; Node retains concrete-template selection, UI exclusions, and the VCO generic fallback. The specialized Rack custom-editor removal applies the first matching Rust `VCOConfig::createCustomEditorAt` range rather than finding its body in Node. The browser stub for the first matching inline `void guaranteeRackUserWavetablesDir(...)` method applies a Rust inline-member body range. Generic inline-body replace, prepend, and append helpers use the same Rust facts, including for class-body fragments through a synthetic wrapper; Node retains only the caller-supplied signature regex and replacement text. Host-only direct module methods are selected from those Rust facts before Node applies its browser-host API policy and stub return form; nested classes remain outside this direct-member transform. UI class-body cleanup uses the same direct method ranges for signature filtering and host-body stubbing, while Node retains member-declaration and nested-type compatibility policy. Repeated namespace-scope types and exact enum declarations are deduplicated from Rust declaration ranges, preserving nested declarations and same-name types in other namespaces. Node retains the helper-name, allowed-return-type, UI-signature/owner, host-API, conditional-template selection, replacement, reference, `Vec`-parameter, inline-body, inline-stub, CMRC-documentation, Surge specialization/editor, and Plugin-signature policies; class members with the same name are not mistaken for namespace-scope helpers.
   Generic dependency-name discovery and dependency-header function/namespace
   identities are source-ordered projections of Rust declaration facts. Node
   retains reachability and header-selection policy without rescanning C++
   declarations or recomputing function namespaces. Pre-module plain support
   types and dependency enum backfill also consume Rust declaration ranges,
   namespaces, completeness markers, and identifiers; Node retains reference,
   UI-exclusion, deduplication, and emission-order policy.
6. It extracts the module class, required DSP headers, implementation units, constants, and widget coordinates.
7. It removes native UI and unsupported host dependencies, replacing supported Rack contracts with the headers in `web-runtime/include/`.
8. Rust supplies complete, exact-scope raw and active-source parameter/input/output/light enum and configuration-call facts and is the sole producer of typed constants from synthesized analysis source, including concrete module `std::array` sizes and labels. Rust is also the sole structured implementation for configuration expansion, `config(...)` counts, counted-loop integer bounds, direct parameter minimum/maximum/default numbers, configuration-name constants/literals/concatenation/`string::f` formatting, enum layout, and the byte-compatible `RackWebModuleTraits`/`RACK_WEB_EXPORTS` ABI tail. Nearest-target duplicate filtering, exact-namespace and referenced-global enum selection, and qualified-alias/terminal resolution consume those Rust declarations. Node retains incomplete/custom transformed enum syntax, explicitly unindexed compatibility roots, and explicit module overrides, and still assembles the module-specific C++ body and runtime metadata.
9. Rust validates the structured compile plan, supplies the tested complete `rack_web_*` link-export allowlist, constructs the ordered language, optimization, definition, SIMD, LTO, standalone-WASM, and memory flags, compiles C units to temporary objects with `emcc`, invokes `em++`, and cleans the objects on success or failure.
10. It writes an assessment, generated adapter source, runtime metadata, and artifact into the build cache.

The source transformer is intentionally conservative. A source build that requires native windows, filesystem assets, threads, or an unsupported DSP primitive becomes a structured `manual-browser-adapter` result instead of being marked ready optimistically.

Batch queue filtering, plugin-group concurrency, adapter timeouts, state
persistence, artifact staging, and source/build cleanup are owned by the Rust
`peach-registry build` command. `npm run source:build` is its compatibility
entrypoint and continues to invoke the source transformer as a Node subprocess.
The scheduler passes its own maintenance binary to that subprocess, so source
preparation does not start a nested Cargo process.

## Cache and outputs

All temporary source checkouts and generated build products belong under `.build/`. The default source build also uses `public/dynamic-plugins/` as a local staging directory because that layout is directly consumable by the publisher. These paths are ignored and must never be committed.

Useful options include:

```sh
npm run source:discover -- --output .build/open-source-modules.json
npm run source:build -- --limit 1 --keep-build
npm run source:build -- --plugin Fundamental --model VCO --force
npm run source:scaffold -- https://library.vcvrack.com/Fundamental/VCO --output /tmp/vco
npm run source:refresh-ui -- --key AaronStatic/ChordCV --write
npm run source:refresh-ui -- --reapply-cache-from-ref HEAD --write
npm run source:refresh-screenshots -- --write
```

`source:refresh-ui` reruns only Rack widget-geometry extraction and preserves the
published WASM artifact, ABI, DSP metadata, and build provenance. Without
`--write` it is a dry run. Use it when a published module has missing or stale
parameter/port positions but does not need to be recompiled.

The refresh also rejects collapsed, out-of-panel geometry and will not replace
existing good positions with a source extraction that introduces those issues.
The cache reapply form rebuilds geometry from a clean git baseline and is useful
after tightening these validation rules; it never invokes source extraction.

`source:refresh-screenshots` checks every official panel raster and clears only
confirmed HTTP 404 URLs. Transient network failures are preserved and the app
falls back to its generated panel if a raster later fails at runtime.

Each module extraction is isolated with a 60-second timeout so an unusually
large or unsupported source file cannot block the full refresh. Override it
when debugging a specific module with `--timeout-ms 300000`.

Every failed build should leave a small `adapter.json` assessment. Preserve the assessment in review notes, not the checkout or raw compiler log.

## Review checklist

- Confirm the source URL, Library version, exact commit, and license.
- Inspect `adapter.json` for blockers and strategy.
- Check parameter, port, light, state, and panel geometry counts against the Rack module.
- Instantiate the output and exercise representative audio/control paths at 44.1 kHz and 48 kHz.
- Check finite outputs, deterministic initialization where promised, and the exported ABI.
- Run `npm test` and `git diff --check`.
- Run `npm run test:builder` when changing source extraction, compatibility headers, or compiler flags.
- Publish only after the artifact and manifest digest match.
