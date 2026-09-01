# Meeting detection

Free Meet Notes can show a small always-on-top prompt when a supported meeting
window appears on Windows or macOS. Detection is a convenience signal only: the recorder
does not start until the user clicks **Start**.

## Behavior

1. The desktop agent checks visible top-level windows every two seconds.
2. A candidate must match twice in succession before a prompt appears.
3. The title must match a supported meeting pattern **and** the owning executable
   must be the expected native app or a supported browser.
4. **Not now** hides the prompt for the current detected session.
5. The detector waits for 60 seconds of absence before treating the session as
   ended. This prevents repeated prompts when a browser tab is briefly hidden.
6. Starting a recording from the main window always brings back the recording
   controls, even if the earlier detection prompt was dismissed.

Meeting detection is enabled by default. It can be disabled globally or separately
for Zoom, Microsoft Teams, and Google Meet under **Settings > Preferences**.

## Signals

The Windows implementation uses [`EnumWindows`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumwindows)
to enumerate top-level windows and `IsWindowVisible` to discard hidden windows. It
then resolves the owner with [`GetWindowThreadProcessId`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid)
and verifies the executable using [`QueryFullProcessImageNameW`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew).

The macOS implementation uses Apple’s
[`CGWindowListCopyWindowInfo`](https://developer.apple.com/documentation/coregraphics/cgwindowlistcopywindowinfo(_:_:))
for visible on-screen windows, reads the owning PID, and resolves the process
executable locally before applying the same title rules.

Current conservative matches are:

| Product | Executable requirement | Title requirement |
| --- | --- | --- |
| Zoom | `Zoom.exe`, `zoom.us`, or a supported browser | `Zoom Meeting` or `Zoom Webinar` |
| Teams | `ms-teams.exe`, `Teams.exe`, `MSTeams`, or a supported browser | Teams plus `meeting` or `call` |
| Google Meet | Chrome, Edge, Firefox, Brave, Opera, Vivaldi, or Safari on macOS | A call title beginning `Meet -`/`Meet –`, a named call ending in `Google Meet`, or a visible `meet.google.com/` path |

The executable check is important: a text editor mentioning “Google Meet” is not
enough to trigger the prompt. A browser tab whose entire title is only `Google Meet`
is also excluded because that can be the product home page rather than a call.

## Why audio is not required

Windows Core Audio exposes process-associated sessions through
`IAudioSessionManager2` and `IAudioSessionControl2`. Those are useful secondary
signals after media starts, but they are not a reliable prerequisite for a
before-meeting prompt: a lobby can be silent, a user can join muted, and a browser
audio session can belong to unrelated media. Microsoft also notes that a simple
session enumerator can miss newly created sessions unless the application maintains
its own notification-backed list. See the [Core Audio API reference](https://learn.microsoft.com/en-us/windows/win32/api/_coreaudio/).

The first release therefore favors a process-attested meeting window. Audio-session
notifications can be added later as an optional confidence signal, not as a gate.

## Privacy and security

- Detection runs entirely in the desktop process.
- Window titles are inspected in memory and are never logged, emitted to the webview,
  written to disk, sent to analytics, or uploaded.
- The popup receives only a product identifier and display name such as `zoom` and
  `Zoom`.
- The detector cannot start recording. Only an explicit UI or tray action can call
  the recording lifecycle.
- The overlay is configured as always-on-top, initially unfocused, and absent from
  the taskbar. Tauri documents these controls in its [window configuration API](https://v2.tauri.app/reference/javascript/api/namespacewindow/).

## Known limits

- Window titles can change when vendors update their desktop clients.
- A background Google Meet tab cannot always be distinguished from an ordinary
  browser window without inspecting browser internals, which this feature avoids.
- Calendar reminders are out of scope; this detects an opened meeting surface, not
  a scheduled event.
- macOS may withhold other apps’ window titles until Screen Recording permission is
  granted. The app never captures window pixels for detection.
- Linux currently returns no automatic detection.

## Release test matrix

- Zoom home window does not prompt; Zoom Meeting does.
- Teams home/chat does not prompt; Teams meeting/call does.
- Google Meet in a supported browser prompts; identical text in Notepad or TextEdit does not.
- A one-poll title change does not prompt.
- **Not now** hides the current prompt.
- Switching away for less than 60 seconds does not create a second prompt.
- Disabling a provider hides its idle prompt within one poll interval.
- Manual recording still surfaces pause/stop controls.
