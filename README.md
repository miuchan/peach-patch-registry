# Peach Patch Registry

A browser-native VCV Rack module registry. It stores versioned WebAssembly artifacts, complete Rack control/port metadata, source provenance, and SHA-256 integrity data.

The root `index.json` is the searchable formula index. Every immutable package lives at `packages/<plugin>/<model>/<version>/` with its own `manifest.json` and `module.wasm`.

`build-status.json` tracks every open-source module discovered from the pinned VCV Library revision as `compiled`, `failed`, or `pending`. `coverage.json` is the compact summary. Failed records contain only structured adapter assessments; local paths and raw build logs are never published.

## CLI

```sh
node bin/peach.mjs search oscillator --registry ./index.json
node bin/peach.mjs info Fundamental/VCO --registry ./index.json
node bin/peach.mjs install Fundamental/VCO --registry ./index.json
node bin/peach.mjs verify Fundamental/VCO --registry ./index.json
```

The Peach Patch website reads the same index directly and verifies every downloaded artifact before WebAssembly instantiation. Packages retain their upstream license; see each manifest for its source repository, source commit, and license identifier.

Run `npm test` after every registry update.
