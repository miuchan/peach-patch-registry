# Registry schema

The current schema is version `1` and the browser ABI is `0.3`.

## `index.json`

The root index contains:

- `schemaVersion`: registry format version.
- `abiVersion`: WASM host ABI version.
- `generatedAt`: UTC generation timestamp.
- `packageCount` and `totalBytes`: denormalized catalog totals.
- `packages`: one searchable package record per `plugin/model` key.

Package records contain identity (`key`, `plugin`, `model`, `name`, `brand`, `version`), provenance (`license`, `sourceUrl`, `libraryUrl`, `sourceCommit`), browser metadata (`width`, `description`, `params`, `inputs`, `outputs`, `lights`, `runtime`), relative artifact paths (`wasmUrl`, `manifestUrl`), and `artifact.sha256`/`artifact.size`. `screenshotUrl` is either the official HTTPS VCV Library panel or a registry-relative `panel.webp` captured by the matching native Rack runtime from the locked source. It is canonical UI data, not a browser-generated fallback.

## `manifest.json`

Each package manifest repeats the package record under `module` and adds:

```json
{
  "schemaVersion": 1,
  "abiVersion": "0.3",
  "module": { "key": "Fundamental/VCO", "artifact": { "sha256": "...", "size": 123 } },
  "source": { "url": "https://github.com/...", "commit": "40-hex-sha-or-null" },
  "build": { "strategy": "direct-rack-source-adapter", "fingerprint": "...", "builtAt": "..." }
}
```

The manifest is the portable package description. A host may ignore fields it does not understand, but it must reject an artifact whose digest or byte length does not match the manifest/index.

## Runtime metadata

`params`, `inputs`, `outputs`, and `lightWidgets` use stable numeric IDs matching the compiled Rack contract. IDs are not display ordering hints and must not be renumbered during publication. `runtime.strategy` describes whether the artifact is an ordered source translation, browser DSP adapter, Rack boundary, or direct source adapter. Optional runtime fields describe assets, MIDI, audio channels, expanders, state, capture, and visuals without requiring a particular UI framework.

## Status files

`build-status.json` records the source-discovery universe and each candidate's `compiled`, `failed`, or `pending` state. Failed records may include structured blockers and assessments. `coverage.json` is a summary for humans and automation. Neither file should contain local absolute paths, credentials, or raw compiler output.
