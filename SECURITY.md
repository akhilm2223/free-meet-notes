# Security policy

## Supported version

Free Meet Notes is currently a development preview. Security fixes are applied
to the latest commit and the newest published prerelease only.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability, leaked credential, or private
meeting data in a public issue.

Use GitHub's private vulnerability reporting for this repository:
<https://github.com/akhilm2223/free-meet-notes/security/advisories/new>.

Include the affected version, Windows version, reproduction steps, and impact.
Do not include real API keys or real meeting content. Use clearly fake test data.

We will acknowledge a complete report as soon as practical and coordinate a fix
and disclosure through the private advisory. This project does not currently
offer a bug bounty or guaranteed response time.

## Secret handling for contributors

- Never commit `.env` files, API keys, access tokens, signing certificates, or
  recordings from real meetings.
- Use fake placeholders in tests and documentation.
- Enter provider keys inside the installed desktop app, where they are stored in
  the operating-system credential store.
- If a real credential is pushed, revoke it immediately and report the exposure
  privately. Removing it in a later commit is not sufficient because Git retains
  history.

## Platform-specific dependency advisories

The repository lockfile includes Tauri's Linux GTK dependency graph so builds
remain reproducible across platforms. Free Meet Notes currently publishes only
Windows and macOS builds. The `glib` 0.18 advisory
(`GHSA-wrw7-89jp-8q8g`) is therefore not present in either shipped target's
resolved dependency graph. Tauri's current Linux WebKit stack pins the GTK 0.18
family; forcing `glib` 0.20 independently would create an incompatible GTK
graph. Re-evaluate this advisory before publishing a Linux build or when Tauri
moves its Linux stack to GTK 0.20 or newer.
