# Code signing policy

Free Meet Notes builds desktop artifacts only from the public source repository at
<https://github.com/akhilm2223/free-meet-notes>. Unsigned artifacts are development
previews, not normal end-user downloads.

## Build origin

- Release installers are built from version tags by GitHub Actions.
- The release workflow builds the Rust sidecar and Tauri application from the same commit.
- Downloaded FFmpeg archives are checked against SHA-256 digests published with the pinned release.
- Every release includes a SHA-256 checksum for the final installer.

## Windows signing intent

The project is applying for trusted open-source code signing. Once approved, signing will run
inside the release pipeline after compilation and before GitHub Release publication. Private
signing keys will never be stored in the repository or distributed to contributors.

Until trusted signing is configured, artifacts are development previews and will be labeled as
unsigned. Users should not disable operating-system security protections merely to run them.

## macOS signing intent

A public macOS download must be signed with an Apple Developer ID Application
certificate, submitted to Apple's notarization service, and distributed with the
notarization ticket stapled to the app or DMG. The current Apple Silicon workflow
uses ad hoc signing only and deliberately verifies that Gatekeeper does not accept
the result as a public release.

Apple certificates, private keys, App Store Connect credentials, and notarization
credentials must be stored only as protected CI secrets. They must never be committed,
placed in `.env`, bundled into the desktop application, printed to build logs, or
uploaded as artifacts.

## Release control

Only project maintainers may create release tags or approve signing requests. Changes from outside
contributors must be reviewed before merge. A compromised or incorrectly signed release will be
removed immediately and reported through a GitHub security advisory.
