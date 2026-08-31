//! Consent-first, local meeting-window detection for Windows.
//!
//! The detector enumerates visible top-level windows, verifies the owning
//! executable, and then applies conservative title rules. Window titles are
//! never logged, emitted, or persisted. A short debounce avoids transient
//! matches, while a disappearance grace period prevents repeated prompts when
//! somebody switches away from a browser meeting tab.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_store::StoreExt;

const SETTINGS_KEY: &str = "meeting_detection";
const REQUIRED_MATCHES: usize = 2;
const REQUIRED_MISSES: usize = 30;
const POLL_INTERVAL: Duration = Duration::from_secs(2);

static DISMISSED_FOR_CURRENT_MEETING: AtomicBool = AtomicBool::new(false);
static CURRENT_MEETING: LazyLock<Mutex<Option<DetectedMeeting>>> =
    LazyLock::new(|| Mutex::new(None));

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeetingDetectionSettings {
    pub enabled: bool,
    pub zoom: bool,
    pub teams: bool,
    pub google_meet: bool,
}

impl Default for MeetingDetectionSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            zoom: true,
            teams: true,
            google_meet: true,
        }
    }
}

impl MeetingDetectionSettings {
    fn allows(&self, app_id: &str) -> bool {
        self.enabled
            && match app_id {
                "zoom" => self.zoom,
                "teams" => self.teams,
                "googleMeet" => self.google_meet,
                _ => false,
            }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedMeeting {
    pub app_id: String,
    pub app_name: String,
    #[serde(skip)]
    signature: String,
}

impl DetectedMeeting {
    fn new(app_id: &str, app_name: &str, process_id: u32) -> Self {
        Self {
            app_id: app_id.to_string(),
            app_name: app_name.to_string(),
            signature: format!("{}:{}", app_id, process_id),
        }
    }
}

#[derive(Clone, Debug)]
struct WindowInfo {
    title: String,
    process_name: String,
    process_id: u32,
}

#[derive(Debug, PartialEq, Eq)]
enum DetectionTransition {
    Started(DetectedMeeting),
    Ended,
}

#[derive(Default)]
struct DetectionTracker {
    candidate: Option<DetectedMeeting>,
    candidate_matches: usize,
    active: Option<DetectedMeeting>,
    misses: usize,
}

impl DetectionTracker {
    fn observe(&mut self, observed: Option<DetectedMeeting>) -> Option<DetectionTransition> {
        match observed {
            Some(meeting)
                if self
                    .active
                    .as_ref()
                    .is_some_and(|active| active.signature == meeting.signature) =>
            {
                self.misses = 0;
                self.candidate = None;
                self.candidate_matches = 0;
                None
            }
            Some(meeting) => {
                let matches_candidate = self
                    .candidate
                    .as_ref()
                    .is_some_and(|candidate| candidate.signature == meeting.signature);

                if matches_candidate {
                    self.candidate_matches += 1;
                } else {
                    self.candidate = Some(meeting.clone());
                    self.candidate_matches = 1;
                }

                if self.candidate_matches < REQUIRED_MATCHES {
                    return None;
                }

                self.candidate = None;
                self.candidate_matches = 0;
                self.misses = 0;
                self.active = Some(meeting.clone());
                Some(DetectionTransition::Started(meeting))
            }
            None => {
                self.candidate = None;
                self.candidate_matches = 0;

                if self.active.is_none() {
                    return None;
                }

                self.misses += 1;
                if self.misses < REQUIRED_MISSES {
                    return None;
                }

                self.active = None;
                self.misses = 0;
                Some(DetectionTransition::Ended)
            }
        }
    }

    fn reset(&mut self) -> bool {
        let was_active = self.active.is_some();
        self.candidate = None;
        self.candidate_matches = 0;
        self.active = None;
        self.misses = 0;
        was_active
    }
}

pub(crate) fn dismiss_for_current_meeting() {
    DISMISSED_FOR_CURRENT_MEETING.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn get_meeting_detection_settings<R: Runtime>(app: AppHandle<R>) -> MeetingDetectionSettings {
    read_settings(&app)
}

#[tauri::command]
pub fn set_meeting_detection_settings<R: Runtime>(
    app: AppHandle<R>,
    settings: MeetingDetectionSettings,
) -> Result<(), String> {
    let store = app
        .store("preferences.json")
        .map_err(|error| format!("Failed to open preferences: {error}"))?;
    let value = serde_json::to_value(settings)
        .map_err(|error| format!("Failed to serialize meeting detection settings: {error}"))?;
    store.set(SETTINGS_KEY, value);
    store
        .save()
        .map_err(|error| format!("Failed to save meeting detection settings: {error}"))
}

#[tauri::command]
pub fn get_detected_meeting() -> Option<DetectedMeeting> {
    CURRENT_MEETING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}

pub(crate) fn start<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let mut tracker = DetectionTracker::default();
        let mut recording_was_active = false;

        loop {
            let settings = read_settings(&app);
            let recording_is_active = crate::audio::recording_commands::is_recording().await;

            let active_provider_disabled = get_detected_meeting()
                .as_ref()
                .is_some_and(|meeting| !settings.allows(&meeting.app_id));

            if !settings.enabled || active_provider_disabled {
                tracker.reset();
                set_current_meeting(None);
                DISMISSED_FOR_CURRENT_MEETING.store(false, Ordering::SeqCst);
                if !recording_is_active {
                    hide_overlay(&app);
                }
            } else {
                let detected = detect_meeting(&settings);
                match tracker.observe(detected) {
                    Some(DetectionTransition::Started(meeting)) => {
                        set_current_meeting(Some(meeting));
                        DISMISSED_FOR_CURRENT_MEETING.store(false, Ordering::SeqCst);
                        show_overlay_if_allowed(&app);
                    }
                    Some(DetectionTransition::Ended) => {
                        set_current_meeting(None);
                        DISMISSED_FOR_CURRENT_MEETING.store(false, Ordering::SeqCst);
                        if !recording_is_active {
                            hide_overlay(&app);
                        }
                    }
                    None => {}
                }
            }

            if recording_is_active && !recording_was_active {
                // A recording explicitly started elsewhere must always surface
                // its controls, even if the earlier detection prompt was hidden.
                DISMISSED_FOR_CURRENT_MEETING.store(false, Ordering::SeqCst);
                show_overlay_if_allowed(&app);
            }

            if recording_was_active && !recording_is_active && get_detected_meeting().is_none() {
                hide_overlay(&app);
            }

            recording_was_active = recording_is_active;
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    });
}

fn read_settings<R: Runtime>(app: &AppHandle<R>) -> MeetingDetectionSettings {
    let Ok(store) = app.store("preferences.json") else {
        return MeetingDetectionSettings::default();
    };

    store
        .get(SETTINGS_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

fn set_current_meeting(meeting: Option<DetectedMeeting>) {
    *CURRENT_MEETING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = meeting;
}

fn show_overlay_if_allowed<R: Runtime>(app: &AppHandle<R>) {
    if DISMISSED_FOR_CURRENT_MEETING.load(Ordering::SeqCst) {
        return;
    }

    crate::tray::position_overlay_window(app);
    if let Some(window) = app.get_webview_window("meeting-overlay") {
        if let Err(error) = window.show() {
            log::warn!("Failed to show meeting overlay: {}", error);
        }
    }
}

fn hide_overlay<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("meeting-overlay") {
        if let Err(error) = window.hide() {
            log::warn!("Failed to hide meeting overlay: {}", error);
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn detect_meeting(_settings: &MeetingDetectionSettings) -> Option<DetectedMeeting> {
    None
}

#[cfg(target_os = "windows")]
fn detect_meeting(settings: &MeetingDetectionSettings) -> Option<DetectedMeeting> {
    windows::visible_windows()
        .into_iter()
        .find_map(|window| classify_window(&window, settings))
}

fn classify_window(
    window: &WindowInfo,
    settings: &MeetingDetectionSettings,
) -> Option<DetectedMeeting> {
    let title = window.title.trim().to_ascii_lowercase();
    let process = window.process_name.trim().to_ascii_lowercase();

    if title.is_empty() || process == "free-meet-notes.exe" {
        return None;
    }

    let browser = matches!(
        process.as_str(),
        "chrome.exe" | "msedge.exe" | "firefox.exe" | "brave.exe" | "opera.exe" | "vivaldi.exe"
    );

    let zoom_title = title.contains("zoom meeting") || title.contains("zoom webinar");
    if settings.zoom && ((process == "zoom.exe" && zoom_title) || (browser && zoom_title)) {
        return Some(DetectedMeeting::new("zoom", "Zoom", window.process_id));
    }

    let teams_title = title.contains("microsoft teams meeting")
        || ((title.contains("meeting") || title.contains("call"))
            && (title.contains("microsoft teams") || title.contains("| teams")));
    if settings.teams
        && ((matches!(process.as_str(), "ms-teams.exe" | "teams.exe") && teams_title)
            || (browser && teams_title))
    {
        return Some(DetectedMeeting::new(
            "teams",
            "Microsoft Teams",
            window.process_id,
        ));
    }

    let meet_title = title_looks_like_google_meet(&title);
    if settings.google_meet && browser && meet_title {
        return Some(DetectedMeeting::new(
            "googleMeet",
            "Google Meet",
            window.process_id,
        ));
    }

    None
}

fn title_may_be_meeting(title: &str) -> bool {
    let title = title.trim().to_ascii_lowercase();
    title.contains("zoom meeting")
        || title.contains("zoom webinar")
        || title_looks_like_google_meet(&title)
        || title.contains("microsoft teams meeting")
        || ((title.contains("meeting") || title.contains("call"))
            && (title.contains("microsoft teams") || title.contains("| teams")))
}

fn title_looks_like_google_meet(title: &str) -> bool {
    let title = title.trim().to_ascii_lowercase();
    title.starts_with("meet - ")
        || title.starts_with("meet – ")
        || title.starts_with("meet — ")
        || title.contains("meet.google.com/")
        || (title.len() > " - google meet".len() && title.ends_with(" - google meet"))
        || (title.len() > " – google meet".len() && title.ends_with(" – google meet"))
        || (title.len() > " — google meet".len() && title.ends_with(" — google meet"))
}

#[cfg(target_os = "windows")]
mod windows {
    use super::{title_may_be_meeting, WindowInfo};
    use std::path::Path;
    use windows_sys::Win32::Foundation::{CloseHandle, BOOL, HWND, LPARAM};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        IsWindowVisible,
    };

    pub(super) fn visible_windows() -> Vec<WindowInfo> {
        let mut windows = Vec::<WindowInfo>::new();

        // SAFETY: EnumWindows invokes the callback synchronously. The LPARAM is
        // a valid mutable pointer to `windows` for the full duration of the call.
        unsafe {
            EnumWindows(
                Some(collect_visible_window),
                &mut windows as *mut _ as LPARAM,
            );
        }

        windows
    }

    unsafe extern "system" fn collect_visible_window(window: HWND, state: LPARAM) -> BOOL {
        if IsWindowVisible(window) == 0 {
            return 1;
        }

        let title_length = GetWindowTextLengthW(window);
        if title_length <= 0 {
            return 1;
        }

        let mut title_buffer = vec![0_u16; title_length as usize + 1];
        let copied = GetWindowTextW(window, title_buffer.as_mut_ptr(), title_buffer.len() as i32);
        if copied <= 0 {
            return 1;
        }

        let title = String::from_utf16_lossy(&title_buffer[..copied as usize]);
        if !title_may_be_meeting(&title) {
            return 1;
        }

        let mut process_id = 0_u32;
        if GetWindowThreadProcessId(window, &mut process_id) == 0 || process_id == 0 {
            return 1;
        }

        let Some(process_name) = process_name(process_id) else {
            return 1;
        };

        let windows = &mut *(state as *mut Vec<WindowInfo>);
        windows.push(WindowInfo {
            title,
            process_name,
            process_id,
        });
        1
    }

    unsafe fn process_name(process_id: u32) -> Option<String> {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
        if handle.is_null() {
            return None;
        }

        let mut path_buffer = vec![0_u16; 32_768];
        let mut path_length = path_buffer.len() as u32;
        let succeeded =
            QueryFullProcessImageNameW(handle, 0, path_buffer.as_mut_ptr(), &mut path_length);
        CloseHandle(handle);

        if succeeded == 0 || path_length == 0 {
            return None;
        }

        let path = String::from_utf16_lossy(&path_buffer[..path_length as usize]);
        Path::new(&path)
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_window, title_looks_like_google_meet, DetectedMeeting, DetectionTracker,
        DetectionTransition, MeetingDetectionSettings, WindowInfo, REQUIRED_MATCHES,
        REQUIRED_MISSES,
    };

    fn window(title: &str, process_name: &str, process_id: u32) -> WindowInfo {
        WindowInfo {
            title: title.to_string(),
            process_name: process_name.to_string(),
            process_id,
        }
    }

    #[test]
    fn recognizes_supported_meetings_only_from_expected_processes() {
        let settings = MeetingDetectionSettings::default();

        assert_eq!(
            classify_window(
                &window("Weekly sync - Zoom Meeting", "Zoom.exe", 11),
                &settings,
            )
            .map(|meeting| meeting.app_id),
            Some("zoom".to_string())
        );
        assert_eq!(
            classify_window(
                &window(
                    "Design review | Microsoft Teams meeting",
                    "ms-teams.exe",
                    12
                ),
                &settings,
            )
            .map(|meeting| meeting.app_id),
            Some("teams".to_string())
        );
        assert_eq!(
            classify_window(
                &window("Planning - Google Meet", "chrome.exe", 13),
                &settings,
            )
            .map(|meeting| meeting.app_id),
            Some("googleMeet".to_string())
        );
        assert!(classify_window(
            &window("Planning - Google Meet", "notepad.exe", 14),
            &settings,
        )
        .is_none());
    }

    #[test]
    fn ignores_normal_home_windows_and_disabled_apps() {
        let mut settings = MeetingDetectionSettings::default();

        assert!(classify_window(&window("Zoom Workplace", "Zoom.exe", 20), &settings).is_none());
        assert!(
            classify_window(&window("Microsoft Teams", "ms-teams.exe", 21), &settings).is_none()
        );
        assert!(classify_window(
            &window(
                "Free Meet Notes meeting controls",
                "free-meet-notes.exe",
                22
            ),
            &settings,
        )
        .is_none());

        settings.google_meet = false;
        assert!(classify_window(
            &window("Planning - Google Meet", "msedge.exe", 23),
            &settings,
        )
        .is_none());
    }

    #[test]
    fn setting_permissions_are_provider_specific() {
        let mut settings = MeetingDetectionSettings::default();
        assert!(settings.allows("zoom"));
        assert!(settings.allows("teams"));
        assert!(settings.allows("googleMeet"));

        settings.teams = false;
        assert!(!settings.allows("teams"));
        assert!(settings.allows("zoom"));

        settings.enabled = false;
        assert!(!settings.allows("zoom"));
    }

    #[test]
    fn google_meet_rule_excludes_the_plain_home_page() {
        assert!(!title_looks_like_google_meet("Google Meet"));
        assert!(title_looks_like_google_meet("Meet - abc-defg-hij"));
        assert!(title_looks_like_google_meet("Meet – abc-defg-hij"));
        assert!(title_looks_like_google_meet("Planning – Google Meet"));
    }

    #[test]
    fn debounces_start_and_tolerates_temporary_disappearance() {
        let mut tracker = DetectionTracker::default();
        let meeting = DetectedMeeting::new("zoom", "Zoom", 42);

        for _ in 0..(REQUIRED_MATCHES - 1) {
            assert_eq!(tracker.observe(Some(meeting.clone())), None);
        }
        assert_eq!(
            tracker.observe(Some(meeting.clone())),
            Some(DetectionTransition::Started(meeting.clone()))
        );

        for _ in 0..(REQUIRED_MISSES - 1) {
            assert_eq!(tracker.observe(None), None);
        }
        assert_eq!(tracker.observe(None), Some(DetectionTransition::Ended));
    }
}
