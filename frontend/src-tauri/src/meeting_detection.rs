//! Lightweight, local meeting-window detection for the recording overlay.
//!
//! This intentionally does not inspect page content, capture screenshots, or
//! persist window titles. It only checks visible top-level window titles and
//! uses a transition (not a continuous forced show) so users can dismiss the
//! overlay for the rest of the current meeting.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime};

static DISMISSED_FOR_CURRENT_MEETING: AtomicBool = AtomicBool::new(false);

pub(crate) fn dismiss_for_current_meeting() {
    DISMISSED_FOR_CURRENT_MEETING.store(true, Ordering::SeqCst);
}

pub(crate) fn start<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let mut meeting_was_detected = false;
        let mut recording_was_active = false;

        loop {
            let meeting_is_detected = meeting_window_is_visible();
            let recording_is_active = crate::audio::recording_commands::is_recording().await;

            if meeting_is_detected && !meeting_was_detected {
                DISMISSED_FOR_CURRENT_MEETING.store(false, Ordering::SeqCst);
                show_overlay_if_allowed(&app);
            }

            if recording_is_active && !recording_was_active {
                show_overlay_if_allowed(&app);
            }

            if meeting_was_detected && !meeting_is_detected {
                DISMISSED_FOR_CURRENT_MEETING.store(false, Ordering::SeqCst);
                if !recording_is_active {
                    hide_overlay(&app);
                }
            }

            if recording_was_active && !recording_is_active && !meeting_is_detected {
                hide_overlay(&app);
            }

            meeting_was_detected = meeting_is_detected;
            recording_was_active = recording_is_active;
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });
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
fn meeting_window_is_visible() -> bool {
    false
}

#[cfg(target_os = "windows")]
fn meeting_window_is_visible() -> bool {
    windows::visible_window_titles()
        .iter()
        .any(|title| title_looks_like_meeting(title))
}

#[cfg(target_os = "windows")]
fn title_looks_like_meeting(title: &str) -> bool {
    let title = title.to_ascii_lowercase();

    title.contains("zoom meeting")
        || title.contains("google meet")
        || title.contains("meet.google.com")
        || title.contains("microsoft teams meeting")
        || ((title.contains("microsoft teams") || title.contains("| teams"))
            && (title.contains("meeting") || title.contains("call")))
}

#[cfg(target_os = "windows")]
mod windows {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
    };

    pub(super) fn visible_window_titles() -> Vec<String> {
        let mut titles = Vec::<String>::new();

        // SAFETY: EnumWindows invokes the callback synchronously. The LPARAM is
        // a valid mutable pointer to `titles` for the full duration of the call.
        unsafe {
            EnumWindows(Some(collect_visible_title), &mut titles as *mut _ as LPARAM);
        }

        titles
    }

    unsafe extern "system" fn collect_visible_title(window: HWND, state: LPARAM) -> BOOL {
        if IsWindowVisible(window) == 0 {
            return 1;
        }

        let title_length = GetWindowTextLengthW(window);
        if title_length <= 0 {
            return 1;
        }

        let mut buffer = vec![0_u16; title_length as usize + 1];
        let copied = GetWindowTextW(window, buffer.as_mut_ptr(), buffer.len() as i32);
        if copied <= 0 {
            return 1;
        }

        let titles = &mut *(state as *mut Vec<String>);
        titles.push(String::from_utf16_lossy(&buffer[..copied as usize]));
        1
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::title_looks_like_meeting;

    #[test]
    fn recognizes_supported_meeting_titles() {
        assert!(title_looks_like_meeting("Weekly sync - Zoom Meeting"));
        assert!(title_looks_like_meeting("Planning - Google Meet"));
        assert!(title_looks_like_meeting(
            "Design review | Microsoft Teams meeting"
        ));
    }

    #[test]
    fn ignores_normal_app_windows() {
        assert!(!title_looks_like_meeting("Zoom Workplace"));
        assert!(!title_looks_like_meeting("Microsoft Teams"));
        assert!(!title_looks_like_meeting(
            "Free Meet Notes meeting controls"
        ));
    }
}
