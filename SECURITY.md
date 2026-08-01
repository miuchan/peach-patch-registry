# Security policy

The registry is an artifact distribution system. A host must treat `index.json`, manifests, and WASM as untrusted input until schema, path, size, and SHA-256 checks pass. The reference CLI verifies the artifact before installation; hosts should perform the same verification before WebAssembly instantiation.

Report security issues privately to the repository maintainers rather than opening a public issue with an exploitable payload. Include the affected package key, registry revision, and a minimal reproduction. Do not attach credentials or private source checkouts.

Supply-chain concerns such as a mismatched source commit, unexpected generated import, suspicious artifact, or license violation should be reported even when the WASM executes correctly. Maintainers will quarantine the package, verify upstream provenance, and publish a corrected reviewed version when appropriate.
