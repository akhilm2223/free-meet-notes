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
