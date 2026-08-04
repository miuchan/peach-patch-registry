# Peach Patch Registry

Peach Patch Registry is the public, reproducible distribution and build repository for browser-loadable VCV Rack modules. It publishes versioned WebAssembly packages together with the metadata a host needs to render a Rack panel, connect ports, restore state, and verify an artifact before instantiation.

The repository deliberately separates concerns:

- `packages/` is the immutable distribution catalog: one `module.wasm` and one signed-by-hash `manifest.json` per plugin/model/version.
- `index.json` is the compact searchable index consumed by Peach Patch and other hosts.
- `src/` contains the Rust consumer CLI plus repository verification,
  publication, discovery, build scheduling, immutable source acquisition, and
  bounded source analysis, conditional preprocessing and object-macro expansion,
  structured Rack port-layout and configuration numeric/string evaluation,
  shared Rack Web ABI-tail generation, the complete linked export
  allowlist, canonical Emscripten flag construction, and compiler orchestration.
- `scripts/` retains compatibility entrypoints, the Rack C++ source adapter,
  compatibility transforms, source-specific compiler-option discovery, and
  maintenance commands that have not migrated yet.
- `web-runtime/` contains the portable Rack compatibility headers and bundled adapter sources used to produce WASM; it is not a browser application.
- `build-status.json` and `coverage.json` describe discovery and build coverage without publishing local paths or raw logs.

The registry is not a replacement for the upstream VCV Rack repositories. Every package keeps its upstream source URL, exact source commit where available, license identifier, and Library URL. Read [docs/PROVENANCE.md](docs/PROVENANCE.md) before adding an artifact.

## Install the CLI

Repository development requires Rust 1.88+ and Node.js 22 or newer. The installed
`peach` binary has no Node.js runtime dependency and can read either a local
checkout or a hosted raw `index.json`.

```sh
cargo test
cargo run -- search oscillator
cargo run -- info Fundamental/VCO
cargo run -- install Fundamental/VCO --prefix ~/.peach-patch
cargo run -- verify Fundamental/VCO --prefix ~/.peach-patch
```

Install the Rust CLI with `cargo install --path .` to use the `peach` command directly.

Use `--registry ./index.json` for offline/local operation or set `PEACH_PATCH_REGISTRY` to a registry URL. Installation is atomic and refuses an artifact whose byte length or SHA-256 digest differs from the index.

## Build a module from official source

The source pipeline is an adapter generator, not a new C++ compiler. It resolves an immutable Library revision, isolates the DSP-relevant Rack class and dependencies, removes unsupported native UI/host code, and injects the browser ABI. Every WASM build is then submitted as a validated structured plan to the Rust CLI, which alone invokes the installed Emscripten `emcc`/`em++` toolchain.

```sh
npm run source:scaffold -- https://library.vcvrack.com/Fundamental/VCO --compile
npm run source:discover
npm run source:build -- --plugin Fundamental --model VCO
npm run registry:publish -- --key Fundamental/VCO
```

For the bundled catalog, use `npm run runtime:build`. This produces standalone WASM with the fixed `rack_web_*` ABI. See [docs/BUILDING.md](docs/BUILDING.md) for toolchain installation, cache layout, failure handling, and the review checklist.

Registry maintenance is being migrated from Node.js to Rust one compatibility
boundary at a time. The package/ABI invariants, executable gates, and replacement
order are documented in [docs/RUST_MIGRATION.md](docs/RUST_MIGRATION.md).

## Package contract

Each package has this layout:

```text
packages/<plugin>/<model>/<version>/
├── manifest.json
└── module.wasm
```

The manifest records `abiVersion`, module metadata, parameter/input/output/light definitions, runtime capabilities, source provenance, build strategy, and the artifact digest. The full index and manifest contract is documented in [docs/SCHEMA.md](docs/SCHEMA.md).

## Verification and releases

Run the complete local check before every change to the catalog:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo run --quiet --bin peach-registry -- verify --root .
git diff --check
```

The GitHub Actions workflow repeats the Cargo gates and Rust registry verification
on pushes and pull requests. When changing source extraction, compatibility
headers, compiler flags, or the WASM ABI, also run:

```sh
cargo test --test scaffold_contract -- --ignored
cargo test --test web_runtime_header_contract -- --ignored
```

These explicit builder tests require Emscripten and use Rust's `wasmi` runtime
for artifact execution. A release is complete only when the committed
`index.json`, manifests, artifacts, coverage records, and source provenance
agree. The release process is documented in
[docs/RELEASING.md](docs/RELEASING.md).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening a change. In particular, do not add a binary copied from an upstream plugin without confirming that its license permits redistribution, and do not commit source checkouts, build caches, credentials, or private build logs.

Peach Patch is the consumer project; this repository is intentionally usable by other browser hosts. If a host needs a runtime-specific visual or interaction, keep that behavior in the host and extend the package metadata only when it describes the module's portable ABI contract.
