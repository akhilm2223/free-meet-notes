# Free Meet Notes — design spec

**Date:** 2026-08-28
**Status:** draft for review
**One line:** A local, Granola-style meeting recorder for Windows that records Zoom / Google Meet / Teams calls invisibly (no bot), transcribes them on your own GPU, labels speakers, and has Claude write project-aware notes into your project folders.

---

## 1. Goal

Every desktop meeting is captured in full and filed in one place, with the notes written by an AI that already knows what is going on in the project the meeting is about.

### Must do (from the brainstorm)

- Record calls on Zoom, Google Meet (browser), and Microsoft Teams on this Windows PC.
- **Invisible to other participants.** No bot joins, no browser extension, nothing is installed into the meeting apps. Audio is captured at the OS level the way Granola does it (WASAPI loopback).
- Start and stop **automatically** when a call starts and ends. Manual override always available.
- Before (or at the start of) each meeting, **pick a project** from a list. The tool then shows what is happening in that project and uses it while writing the notes.
- Save, for every meeting:
  1. the raw audio (kept, never auto-deleted),
  2. a full word-for-word transcript with timestamps,
  3. speaker labels (Me / Speaker 1 / Speaker 2 …),
  4. AI notes: summary, decisions, action items, key quotes, open questions, follow-ups.
- Copy the notes into the chosen project's folder so Claude Code sessions in that project can read them.
- Open-sourceable: MIT, no personal data in the repo, users bring their own API key.

### Won't do (v1)

- In-person meetings, phone calls, meetings on another machine.
- Live transcript scrolling during the call (v2).
- Calendar integration (v2).
- Cloud sync / S3 backup (v2 — Akhil has AWS credits if wanted).
- Mac / Linux support. Windows only.
- A notes editor. Notes are markdown files; edit them in any editor.

---

## 2. How it works, start to finish

```
Zoom / Meet / Teams starts playing audio
  → watcher notices (5 s of continuous audio from a meeting app)
  → picker window opens: "Which project?" + context card
      (skipped if you pre-picked from the tray)
  → recorder writes mic.wav (you) and system.wav (everyone else)
Call ends (60 s of silence, or the app closes)
  → transcriber: faster-whisper on both files → word timestamps
  → pyannote splits system.wav into Speaker 1 / 2 / 3
  → merge into one timeline: [00:14:32] Me: …  [00:14:40] Speaker 1: …
  → Claude Opus 5 writes notes.json using the project brief
  → notes.md rendered, meeting folder saved, index row added
  → notes.md copied into <project folder>/meetings/
  → Windows toast: "COMPASS standup — notes ready" (click opens notes.md)
```

Only the transcript **text** ever leaves the PC (to the Claude API). Audio never does.

---

## 3. Parts

All Python 3.11, one process, one repo. Each part is its own module with one job.

| Module | Job | Depends on |
|---|---|---|
| `tray.py` | System-tray icon and menu. Shows state: idle / recording / processing / error. Menu: *Pick project for next meeting*, *Start recording now*, *Stop recording*, *Open meetings*, *Redo last meeting's notes*, *Quit*. | pystray, Pillow |
| `watcher.py` | Polls every 2 s. Decides `meeting_started` / `meeting_ended` from audio sessions and window titles (see §6). Pure decision function + a thin Windows-probe wrapper so the decision logic is unit-testable. | pycaw, pywin32 |
| `recorder.py` | Opens two input streams — default microphone and the WASAPI loopback of the default output device — and writes `mic.wav` and `system.wav` continuously (16 kHz mono, 16-bit). Records the shared start timestamp. | PyAudioWPatch |
| `transcriber.py` | Runs faster-whisper on each WAV with word timestamps; runs pyannote diarization on `system.wav`; merges both into one speaker-labelled timeline (see §7). Writes `transcript.json` and `transcript.md`. | faster-whisper, pyannote.audio, torch (CUDA) |
| `context.py` | Builds the **project brief** for a project: first 100 lines of `README.md` and `CLAUDE.md` if present, `git log --oneline -20` if the folder is a repo, and the last 3 meetings' `notes.json` (summary + open action items). Also produces the **context card** data for the picker. | git (subprocess) |
| `notes.py` | Calls Claude with brief + transcript, gets structured JSON back, renders `notes.md`. | anthropic (Python SDK), pydantic |
| `store.py` | Owns the meetings directory: creates meeting folders, writes the SQLite index, copies `notes.md` into the project folder. | sqlite3 (stdlib) |
| `ui/` + `app.py` | The picker / context card / meeting browser, as an HTML page shown in a native window via pywebview (Edge WebView2). `app.py` wires everything together and exposes a small Python API to the page. | pywebview |
| `notify.py` | Windows toast notifications with a click action that opens a file. | winotify |
| `config.py` | Loads `settings.yaml`, `projects.yaml`, `.env`. | pyyaml, python-dotenv |

Interfaces between modules are plain dataclasses (`Meeting`, `Segment`, `ProjectBrief`, `MeetingNotes`) defined in `models.py`.

---

## 4. Storage — where everything goes

One place, outside every git repo:

```
C:\Users\akhil\Meetings\                       ← settings.meetings_dir
  meetings.db                                    SQLite index (see below)
  2026-08-25_1530_compass-standup\
    meeting.json        id, start/end time, project, title, duration, audio device names, pipeline versions
    mic.wav             your microphone, 16 kHz mono
    system.wav          everyone else (loopback), 16 kHz mono
    transcript.json     list of segments: start, end, speaker, text, words[]
    transcript.md       readable: [HH:MM:SS] Speaker: text, one paragraph per turn
    notes.json          structured notes from Claude (source of truth)
    notes.md            rendered notes
    brief.md            the project brief that was sent to Claude (for debugging "why did it say that")

C:\Users\akhil\Desktop\COMPASS\meetings\
  2026-08-25-standup.md                          ← copy of notes.md, with a link back to the full transcript
```

Folder name: `YYYY-MM-DD_HHMM_<project-slug>-<title-slug>` (title comes from Claude; before notes exist the folder is `…_<project-slug>-untitled` and is renamed when the title arrives).

Why this split: audio and full transcripts are large and private, so they live in one dedicated folder that no repo will ever pick up. Only the small `notes.md` goes into the project folder, where it is useful to other tools (Claude Code, Obsidian, grep).

**SQLite index** (`meetings.db`, one table):

```
meetings(id TEXT PK, started_at, ended_at, project, title, duration_s,
         folder, status)     -- status: recording | transcribing | writing_notes | done | unfiled | failed | discarded
```

The index exists so the browser and the tray can list meetings without scanning folders. Files are the source of truth; the index can be rebuilt from `meeting.json` files (`free-meet-notes reindex`).

Nothing in this folder is ever deleted by the tool.

---

## 5. Config — three files, all in `settings.meetings_dir`

`projects.yaml` — the project list. This is the whole "context" mechanism.

```yaml
- name: COMPASS
  folder: C:\Users\akhil\Desktop\COMPASS
  about: Rutgers Health AWS app. I own the backend.
- name: Tennis game
  folder: C:\Users\akhil\Desktop\gamechnager
  about: livewebtennis.com — webcam-controlled tennis, Colyseus multiplayer.
```

`settings.yaml`

```yaml
meetings_dir: C:\Users\akhil\Meetings
language: en                      # whisper language, set explicitly (no auto-detect)
whisper_model: large-v3-turbo     # falls back to "small" on CPU
silence_end_seconds: 60
start_after_seconds: 5
copy_notes_to_project: true
claude_model: claude-opus-5
```

`.env`

```
ANTHROPIC_API_KEY=...
HF_TOKEN=...          # free HuggingFace token, needed once to download pyannote's model
```

The repo ships `projects.example.yaml`, `settings.example.yaml`, `.env.example`. Real files live in the meetings dir, never in the repo.

---

## 6. Detecting a call (watcher)

Poll every 2 seconds. A meeting is **live** when any of these is true:

| Source | Condition |
|---|---|
| Zoom | An active audio session (pycaw `AudioUtilities.GetAllSessions()`) belongs to `Zoom.exe` and its peak meter is above 0.01 (pycaw reports 0–1) |
| Teams | Same, for `ms-teams.exe` or `Teams.exe` |
| Google Meet | A top-level window title matches `^Meet[ \-–]` or contains `Google Meet` or `meet.google.com` **and** Chrome/Edge has an active audio session with peak above threshold |

Rules:
- `meeting_started` fires after the condition has been true for `start_after_seconds` (5) continuously.
- `meeting_ended` fires after it has been false for `silence_end_seconds` (60) continuously, or immediately if the meeting process disappears.
- While a meeting is live, the watcher does nothing else (no re-triggers).
- The decision is a pure function `decide(state, probe_result, now) -> (new_state, event)` with the Windows probing in a separate function, so the logic is testable with fake inputs.

Manual override from the tray (*Start recording now* / *Stop recording*) bypasses the watcher.

---

## 7. Transcription pipeline (transcriber)

**Whisper** (both tracks, same settings): faster-whisper, model `large-v3-turbo`, `device="cuda"`, `compute_type="float16"`, `word_timestamps=True`, `vad_filter=True` (so it does not invent words in silence), `language` from settings, `beam_size=5`. If CUDA is unavailable or fails to load, fall back to `device="cpu"`, `compute_type="int8"`, model `small`, and set a warning flag that the tray and notes header show.

**Speakers:**
- Every segment from `mic.wav` is `Me`. No AI needed.
- `system.wav` goes through `pyannote/speaker-diarization-3.1`. Each Whisper segment from that track gets the diarization speaker with the largest time overlap. Speakers are renamed `Speaker 1, 2, 3…` in order of first appearance.

**Merge:**
1. Both WAVs started at the same wall-clock instant (the recorder opens both streams then records one `started_at`), so timestamps are directly comparable.
2. Put all segments from both tracks into one list, sort by start time.
3. **Echo dedupe** (for when you are on speakers, not headphones): if a `Me` segment overlaps in time with a `system` segment and their text similarity (`difflib.SequenceMatcher` ratio) is ≥ 0.8, drop the `Me` copy.
4. Join consecutive segments from the same speaker with a gap under 1.5 s into one paragraph.
5. Write `transcript.md` as `[HH:MM:SS] Speaker: text`, and `transcript.json` with words kept.

Headphones are recommended in the README; the dedupe is a safety net, not the main plan.

---

## 8. Project brief and context card (context)

`build_brief(project) -> ProjectBrief`:
- `about` from `projects.yaml`
- first 100 lines of `README.md`, then `CLAUDE.md`, if they exist in the folder
- `git log --oneline -20` if the folder is a git repo (ignore errors)
- the last 3 meetings for this project: title, date, summary, and action items whose status is not `done`

Rendered to `brief.md` and sent as part of the system prompt. Capped at ~6,000 words; git log and README are truncated first, previous meetings last.

`context_card(project) -> ContextCard`: the same data trimmed for display — last meeting date + title, open action items, last 5 commits. **No AI call** — it must appear instantly when a project is clicked.

---

## 9. Writing the notes (notes)

One call to Claude per meeting, using the Python SDK's structured output:

```python
client = anthropic.Anthropic()          # key from ANTHROPIC_API_KEY
response = client.messages.parse(
    model=settings.claude_model,        # claude-opus-5
    max_tokens=16000,
    system=[{"type": "text", "text": SYSTEM_PROMPT + brief_md,
             "cache_control": {"type": "ephemeral"}}],
    messages=[{"role": "user", "content": transcript_md}],
    output_format=MeetingNotes,         # pydantic model
)
notes = response.parsed_output
```

Adaptive thinking is on by default on Opus 5, so no `thinking` parameter is passed. If `response.stop_reason == "refusal"` (should never happen for meeting notes), retry once on `claude-sonnet-5`; if that also fails, mark the meeting `failed` and keep the transcript.

`MeetingNotes` (pydantic):

```
title: str                       short, specific ("COMPASS standup — auth cutover date")
summary: str                     5–8 sentences
decisions: list[str]
action_items: list[ActionItem]   owner, task, due (str | None), status = "open"
quotes: list[Quote]              time (HH:MM:SS), speaker, text (verbatim), why_it_matters
open_questions: list[str]
followups: list[str]
```

The system prompt tells Claude: the user is "Me"; use the project brief to resolve names and jargon and to say when something closes a previous action item; quote verbatim with the timestamp from the transcript; do not invent decisions that were not said.

Cost: a 1-hour meeting is roughly 15k input + 2k output tokens ≈ $0.13 on Opus 5, ≈ $0.05 on Sonnet 5 (set `claude_model` in settings).

`render_notes_md(notes, meeting) -> str` produces `notes.md` with fixed headings in this order: Summary, Decisions, Action items, Key quotes, Open questions, Follow-ups, then a footer linking to `transcript.md` and the audio.

---

## 10. UI (ui/ + app.py)

**Mandatory process:** before any HTML/CSS/JS is written, invoke the `design` skill (impeccable + taste-skill + emilkowalski). Type families are declared once in `ui/fonts.css`; no component names a family inline.

One HTML page in a pywebview native window (frameless-optional, ~520×640, remembers position). Two screens in v1:

**Picker** — opens when a meeting starts (or from the tray).
- Project list from `projects.yaml`, plus *Unfiled* and *Not a meeting*.
- Clicking a project shows the context card beside it: last meeting, open action items, recent commits.
- *Record* confirms. If nothing is chosen within 30 s, recording continues as *Unfiled* and the window hides.
- *Not a meeting* stops recording; the folder is marked `discarded` and left in place for you to delete (the tool never deletes audio itself).
- A recording pill (elapsed time, red dot) stays visible while recording.

**Meetings** — reachable from the tray.
- List grouped by date, filter by project, status chip (processing / done / unfiled / failed).
- Detail: notes on top, full transcript below with a colour per speaker, timestamps clickable to seek an `<audio>` player on `system.wav` / `mic.wav`.
- *File this meeting* for unfiled ones (runs the notes step with the chosen project).

The page talks to Python through `window.pywebview.api` (list projects, context card, meetings, start/stop, file meeting). No network server, no port.

---

## 11. Error handling

| Situation | Behaviour |
|---|---|
| No microphone / no loopback device found | Tray shows error, toast explains which device is missing, nothing recorded. |
| Output device changes mid-call (e.g. Bluetooth headphones connect) | v1 keeps recording the original device; `meeting.json` records the device names so it is diagnosable. Known limitation, v2 item. |
| Crash during recording | WAVs are written incrementally; on next start, any folder with `status = recording` is offered for processing from the tray. |
| GPU / CUDA load fails | CPU fallback (§7) with a visible warning. |
| pyannote fails (no HF token, model not accepted) | Transcript still produced with `Me` / `Others` labels only; notes still written; warning shown. |
| Claude API fails (network, 5xx after SDK retries) | Meeting marked `failed` at the notes step; transcript kept; *Redo last meeting's notes* retries. |
| Claude refusal | Retry once on Sonnet 5, then `failed` (§9). |
| Project folder missing | Notes still saved in the meetings dir; the copy step is skipped with a warning. |

The tool never deletes audio or transcripts.

---

## 12. Privacy

- No bot, no extension, nothing injected into Zoom / Meet / Teams. Capture is OS-level loopback; the meeting apps cannot see it.
- Audio stays on disk locally. Transcript text goes to the Claude API only; nothing else phones home. pyannote's model is downloaded once from HuggingFace.
- Legal note for the README: recording calls is subject to consent law. New Jersey is one-party consent; participants in all-party-consent states or countries may be covered by their law. This is the user's responsibility.

---

## 13. Testing

Unit tests (pytest, run by Claude Code during implementation):
- `watcher.decide` — start after 5 s of activity, end after 60 s of silence, immediate end when the process is gone, no re-trigger while live. Fed fake probe results.
- Merge — two-track ordering, echo dedupe threshold, paragraph joining, timestamp formatting.
- Speaker assignment — segment ↔ diarization overlap picks the right speaker; first-appearance renumbering.
- `context.build_brief` — truncation order and word cap; behaviour with no README / not a repo / no previous meetings.
- `render_notes_md` — headings, ordering, quote formatting; round-trip from `notes.json`.
- `store` — folder naming, rename on title arrival, index insert/update, reindex from files.

Manual tests (Akhil, with a real call — Claude Code never runs the recorder):
1. Day 1: manual Start/Stop from the tray on a real Zoom call → both WAVs play back correctly, transcript reads right.
2. Day 3: auto-detect start/stop on Zoom, Meet (Chrome), Teams. Picker appears, context card is instant.
3. Headphones vs speakers: check the echo dedupe.

---

## 14. Repo layout and dependencies

```
free_meet_notes/
  README.md  LICENSE (MIT)  pyproject.toml
  .env.example  projects.example.yaml  settings.example.yaml
  free_meet_notes/
    __main__.py  app.py  config.py  models.py
    tray.py  watcher.py  recorder.py  transcriber.py
    context.py  notes.py  store.py  notify.py
    ui/  index.html  app.css  fonts.css  app.js
  tests/
  docs/superpowers/specs/   (this file)
```

Runtime: Python 3.11 (PyAudioWPatch ships wheels up to 3.11). Packages: `PyAudioWPatch`, `faster-whisper`, `pyannote.audio`, `torch` (CUDA build), `pycaw`, `pywin32`, `pystray`, `Pillow`, `pywebview`, `winotify`, `anthropic`, `pydantic`, `pyyaml`, `python-dotenv`; dev: `pytest`. Run as `python -m free_meet_notes`; a Startup-folder shortcut is documented in the README (no installer in v1).

Setup pain points to document: CUDA-enabled torch install, `HF_TOKEN` + accepting the pyannote model terms on HuggingFace, setting the correct default microphone in Windows Sound settings.

Machine note: Akhil's RTX 5060 has a pending TDR-timeout fix that needs a reboot before long GPU jobs.

---

## 15. Build order

| Day | Deliverable | Proof |
|---|---|---|
| 1 | `recorder` + `transcriber` (Whisper only, no speakers) + `store` + a bare tray with Start/Stop | Akhil records one real call; `transcript.md` reads correctly |
| 2 | Two-track speaker labels + `context` + `notes` + copy into project folder | Unit tests green; one real meeting produces `notes.md` in the project folder |
| 3 | `watcher` auto start/stop + picker + context card (via `design` skill) + toasts | Auto-detect works on Zoom, Meet, Teams |
| 4 | Meetings browser screen, README, `.example` files, first week of daily use | Decide whether live transcript (v2) is wanted |

Each day is one playtest-sized step: build → Akhil tests → commit → next.

---

## 16. v2 candidates (not designed here)

Live transcript during the call; Google Calendar titles; follow the output device when it changes; S3 backup; a "what happened this week" digest across all projects; export to Notion/Obsidian; Mac support.
