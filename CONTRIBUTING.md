# Contributing

Thank you for improving the registry. Keep changes narrow and reviewable: one source/build concern or one package group per pull request.

Before opening a pull request:

```sh
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo run --quiet --bin peach-registry -- verify --root .
git diff --check
```

For a new package, include its upstream Library URL, source commit, license, build strategy, artifact test evidence, and any known host limitations. For a build-pipeline change, add or update a fixture and explain which compatibility rule it protects. Generated indexes and manifests should be produced by the repository tools; do not hand-edit a digest.

Do not commit credentials, local source checkouts, `.build/`, raw compiler logs, or unrelated website files. Avoid changing a package's numeric parameter/port IDs unless the upstream contract itself changed and the migration is documented.

Please write commit messages that describe the user-visible registry or build change. Maintainers may request a provenance or license clarification before merging an artifact.
