# Building modules

This document describes the reproducible build boundary for Peach Patch Registry.

## Toolchain

The compiler is Emscripten's `em++`, which provides Clang/LLVM and the WebAssembly linker. The repository does not implement a C++ compiler. The JavaScript source pipeline performs source selection and compatibility adaptation before handing generated C++ to Emscripten.

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

The dynamic pipeline in `scripts/scaffold-library-module.mjs`:

1. Reads the official Library manifest and resolves the exact plugin revision or gitlink.
2. Checks out the source and recursively validates locked submodules.
3. Finds the registered `createModel<Module, Widget>()` target.
4. Extracts the module class, required DSP headers, implementation units, constants, and widget coordinates.
5. Removes native UI and unsupported host dependencies, replacing supported Rack contracts with the headers in `web-runtime/include/`.
6. Generates an ABI wrapper and runtime metadata.
7. Invokes `em++` with standalone-WASM, memory, optimization, SIMD, and export flags.
8. Writes an assessment, generated adapter source, runtime metadata, and artifact into the build cache.

The source transformer is intentionally conservative. A source build that requires native windows, filesystem assets, threads, or an unsupported DSP primitive becomes a structured `manual-browser-adapter` result instead of being marked ready optimistically.

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
