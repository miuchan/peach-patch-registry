# Releasing the registry

1. Start from a clean checkout and confirm the intended upstream revisions and licenses.
2. Run the source discovery/build or import the reviewed WASM artifacts into `packages/`.
3. Run `npm run registry:publish` for staged dynamic builds, or publish a selected key with `--key`.
4. Run `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `cargo run --quiet --bin peach-registry -- verify --root .`, and inspect `git diff --check`.
5. Review the generated index, package manifests, status, coverage, and the list of changed package keys.
6. Commit the artifacts and metadata together. Do not commit `.build/`, source checkouts, or compiler logs.
7. Open a pull request and wait for the registry verification workflow.

The release is not complete if a package has a manifest without its artifact, an index record with a stale digest, or source metadata that cannot be traced to an upstream revision. Since packages are content-addressed by their recorded SHA-256 and versioned path, correcting an artifact requires a new reviewed package version or an explicit catalog correction; do not silently overwrite a published version.
