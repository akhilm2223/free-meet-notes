# Free Meet Notes

A free, open-source, local-first meeting recorder for Windows. Free Meet Notes
captures microphone and system audio without adding a bot to the call, transcribes
locally, and is being extended to write project-aware notes.

> Early development build. The desktop source is functional, but no signed public
> installer or official update channel exists yet.

The Windows build is the current product target. The shared recording and
transcription core includes macOS support, and an Apple Silicon compatibility
workflow is available for development testing. A normal public Mac download still
requires Developer ID signing, notarization, and real-device permission testing.

## Install

Signed public installation is not available yet. Development builds are produced by
the `Build Free Meet Notes for Windows` GitHub Actions workflow and include a SHA-256
checksum. See the [code signing policy](CODE_SIGNING_POLICY.md) before distributing a
Windows build.

## What is working

- Local microphone and system-audio recording inherited from Meetily
- Local Whisper and Parakeet transcription options
- Meeting library, transcript recovery, summaries, and tray controls
- A compact always-on-top recording pill with start, pause, resume, and stop
- Consent-first Windows and macOS meeting detection for Zoom, Microsoft Teams, and Google Meet
- Per-app detection controls under Settings > Preferences
- A separately deployable blue web companion/landing surface in `web/`

## Architecture

Recording remains a native desktop responsibility. A hosted browser cannot reliably
capture system audio, run an always-on-top native control, or continue when a
tab closes.

```text
Zoom / Teams / Meet
        ↓
Free Meet Notes desktop agent
  capture → transcribe → store locally
        ↓ optional, not implemented yet
Hosted web companion
  encrypted notes → sharing → team access
```

Cloud sync is not enabled. The current web companion contains no meeting data and the
desktop remains the source of truth.

## Desktop development

Prerequisites on Windows:

- Node.js
- pnpm 9 (pinned through Corepack)
- Rust stable with the MSVC target
- Visual Studio 2022 Build Tools with Desktop development with C++ and a Windows SDK

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm tauri dev
```

The imported upstream build provisions FFmpeg as a Tauri sidecar. The archive is
verified against a pinned SHA-256 digest before extraction.

## Web companion development

```powershell
cd web
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

The web project is a standalone Next.js application and can be deployed from the
`web` directory on Vercel. It deliberately does not pretend to record meetings in the
browser.

## Privacy and consent

Free Meet Notes is designed for local processing, but recording laws and workplace
policies vary. Tell participants when required and obtain consent before recording.
Window-title meeting detection runs locally, is not persisted, and can be dismissed
for the current call. Recording never starts from detection alone. See
[Meeting detection](docs/MEETING_DETECTION.md) for the matching rules, privacy model,
limitations, and test matrix.

## Upstream and license

Free Meet Notes is based on [Meetily](https://github.com/Zackriya-Solutions/meetily)
v0.4.0 and preserves its Git history. See [UPSTREAM.md](UPSTREAM.md) for the exact
source commit and fork provenance.

The project remains available under the MIT License in [LICENSE.md](LICENSE.md).
Free Meet Notes is not affiliated with or endorsed by the Meetily maintainers.

## Code signing policy

Windows release signing and provenance rules are documented in
[CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md).
