# Free Meet Notes

A free, open-source, local-first meeting recorder for Windows. Free Meet Notes
captures microphone and system audio without adding a bot to the call, transcribes
locally, and is being extended to write project-aware notes.

> Early development build. A one-click Windows installer is available, but it is
> not code signed yet and there is no automatic update channel.

The Windows build is the current product target. The shared recording and
transcription core includes macOS support, and an Apple Silicon compatibility
workflow is available for development testing. A normal public Mac download still
requires Developer ID signing, notarization, and real-device permission testing.

## Install on Windows — no terminal required

1. [Download Free-Meet-Notes-Setup.exe](https://github.com/akhilm2223/free-meet-notes/releases/download/v0.5.0-preview.3/Free-Meet-Notes-Setup.exe).
2. Open the downloaded file and follow the installer.
3. Launch **Free Meet Notes** from the Start menu.

The preview installer is not code signed. Windows SmartScreen may warn that the
publisher is unknown, and Smart App Control in enforcement mode may block it
entirely. Do not turn off Windows security controls to install this preview. A
frictionless trusted install requires an RSA code-signing certificate from a trusted
provider or Microsoft Store distribution. Every release also includes a SHA-256
checksum; see the [code signing policy](CODE_SIGNING_POLICY.md).

## What is working

- Local microphone and system-audio recording inherited from Meetily
- Local Whisper and Parakeet transcription options
- Meeting library, transcript recovery, summaries, and tray controls
- A compact always-on-top recording pill with start, pause, resume, and stop
- Consent-first Windows and macOS meeting detection for Zoom, Microsoft Teams, and Google Meet
- Per-app detection controls under Settings > Preferences
- Opt-in local study-alert detection for deadlines, assignments, class questions, and key points
- Optional iPhone/Android push alerts with category-only privacy enabled by default
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

## Live study alerts

During an active recording, finalized transcript segments can be checked locally for
possible professor requests, deadlines, questions, and important notes. Alerts appear
inside the desktop app and can optionally be pushed to an iPhone or Android phone
through the open-source ntfy app. Raw audio is never sent for alert delivery, and the
default phone mode sends only a generic category rather than transcript text.

This preview is intentionally opt-in and cannot guarantee it will catch every request.
See [Live study alerts](docs/STUDY_ALERTS.md) for setup, privacy details, and limitations.

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
