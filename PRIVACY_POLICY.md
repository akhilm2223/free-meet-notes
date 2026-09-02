# Free Meet Notes privacy policy

Last updated: August 30, 2026

Free Meet Notes is a local-first, open-source Windows desktop application. This
document describes the current development preview, not planned cloud features.

## What stays on your computer

- Audio recordings, transcripts, summaries, settings, and meeting metadata are
  stored locally in the application's data directories.
- Local transcription and local summary models process data on your computer.
- Free Meet Notes has no product analytics, advertising trackers, meeting bot,
  hosted account, or automatic cloud sync.
- The public website is a product page. It cannot access data in the desktop app.

## Optional external AI providers

You can choose an external transcription or summary provider. When you do, the
content required for that request is sent directly from the desktop app to the
provider or endpoint you selected. Their terms and privacy policy apply. Free
Meet Notes does not proxy or retain those requests.

Using local models avoids sending meeting content to an external AI provider.

## Optional phone study alerts

Live study-alert detection runs locally against finalized transcript segments and is
disabled by default. If you separately enable phone delivery, the app publishes a
short push notification to the third-party `ntfy.sh` service over HTTPS. Raw audio
and the full transcript are never sent by this feature.

The default **Category only** setting sends generic alert text without transcript
words. If you choose **Include short excerpt**, up to 360 characters derived from the
local transcript are sent to `ntfy.sh`; its terms and privacy policy apply. Publish
requests ask ntfy not to cache messages server-side, which can cause alerts to be
missed when a phone is offline.

The randomly generated ntfy topic is stored in the operating-system credential
store. All topics on the public ntfy.sh service are publicly addressable, so treat
the topic like a password and replace it if it may have been disclosed.

## API keys

Provider API keys entered in the desktop app are stored in the operating
system's credential store (Windows Credential Manager on Windows). They are not
stored in the meeting SQLite database, embedded in the installer, committed to
the source repository, or sent to Free Meet Notes.

When upgrading from an inherited Meetily build, Free Meet Notes attempts to move
legacy plaintext provider keys from SQLite into the operating-system credential
store and then clears the legacy database fields.

## Security limits

- Meeting files and the SQLite database are not independently encrypted by Free
  Meet Notes. They rely on your Windows account, file permissions, and any disk
  encryption you enable, such as BitLocker or Device Encryption.
- Anyone who can access your unlocked Windows account may be able to access your
  meetings and use credentials available to that account.
- No software can promise "no leaks." Please report suspected vulnerabilities
  privately through the repository's security advisory page rather than a public
  issue.

## Your control

You can inspect, export, or delete the local files, remove saved credentials
through Windows Credential Manager, and review or modify the source under its
license. Deleting the desktop application does not necessarily delete meeting
files or credentials; remove those separately if you want a complete cleanup.

## Open-source transparency

The current source and issue tracker are at
<https://github.com/akhilm2223/free-meet-notes>. Material privacy changes will be
documented in this policy and release notes.

Free Meet Notes is based on the MIT-licensed Meetily project. Upstream Meetily
services and maintainers do not operate this fork and are not responsible for
its data handling.
