# Code signing policy

Free Meet Notes publishes Windows installers only from the public source repository at
<https://github.com/akhilm2223/free-meet-notes>.

## Build origin

- Release installers are built from version tags by GitHub Actions.
- The release workflow builds the Rust sidecar and Tauri application from the same commit.
- Downloaded FFmpeg archives are checked against SHA-256 digests published with the pinned release.
- Every release includes a SHA-256 checksum for the final installer.

## Signing intent

The project is applying for trusted open-source code signing. Once approved, signing will run
inside the release pipeline after compilation and before GitHub Release publication. Private
signing keys will never be stored in the repository or distributed to contributors.

Until trusted signing is configured, artifacts are development previews and will be labeled as
unsigned. Users should not disable operating-system security protections merely to run them.

## Release control

Only project maintainers may create release tags or approve signing requests. Changes from outside
contributors must be reviewed before merge. A compromised or incorrectly signed release will be
removed immediately and reported through a GitHub security advisory.
