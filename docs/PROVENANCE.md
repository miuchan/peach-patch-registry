# Provenance and licensing

Peach Patch Registry distributes artifacts derived from VCV Rack plugins. The upstream project remains the author of its source and artwork. Registry metadata must make the chain of provenance inspectable.

For every package, record:

- the official VCV Library URL;
- the upstream source repository URL;
- the Library version and exact source commit when available;
- the upstream license identifier;
- whether the artifact is an exact source translation, a browser DSP adapter, or a Rack boundary implementation.

Do not redistribute a plugin merely because its source repository is reachable. Confirm that the declared license permits source-derived binary distribution and that bundled assets are covered. If the source owner has requested that code or ports not be redistributed, exclude it and record the reason in build status rather than publishing an artifact.

The registry does not claim that a browser artifact is byte-for-byte equivalent to the desktop plugin. The strategy and description must state when native DSP or host behavior was replaced. Any compatibility claim should be backed by an executable regression or a clear manual review note.
