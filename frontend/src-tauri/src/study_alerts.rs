//! Privacy-conscious phone delivery for real-time study alerts.
//!
//! Classification happens in the local webview. This module only accepts a
//! short, bounded alert and publishes it to a hard-coded HTTPS ntfy endpoint.
//! The unguessable topic is kept in the operating-system credential store.

use crate::credential_store::{self, SecretScope};
use reqwest::{redirect::Policy, Client};
use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;

const NTFY_ORIGIN: &str = "https://ntfy.sh";
const TOPIC_PROVIDER: &str = "ntfy-topic";
const MAX_TITLE_CHARS: usize = 80;
const MAX_BODY_CHARS: usize = 360;
const MIN_DELIVERY_GAP: Duration = Duration::from_secs(5);

static LAST_DELIVERY: LazyLock<Mutex<Option<Instant>>> = LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyAlertPayload {
    title: String,
    body: String,
    category: String,
    priority: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyAlertDelivery {
    delivered: bool,
}

fn validate_topic(topic: &str) -> Result<(), String> {
    let valid_length = (24..=64).contains(&topic.len());
    let valid_characters = topic
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'));

    if !valid_length || !valid_characters {
        return Err(
            "Phone alert topic must be 24-64 characters using letters, numbers, '-' or '_'"
                .to_string(),
        );
    }

    Ok(())
}

fn validate_payload(payload: &StudyAlertPayload) -> Result<(), String> {
    let title_length = payload.title.chars().count();
    let body_length = payload.body.chars().count();
    if title_length == 0 || title_length > MAX_TITLE_CHARS {
        return Err("Study alert title is empty or too long".to_string());
    }
    if body_length == 0 || body_length > MAX_BODY_CHARS {
        return Err("Study alert body is empty or too long".to_string());
    }
    if !matches!(
        payload.category.as_str(),
        "deadline" | "action" | "question" | "important" | "test"
    ) {
        return Err("Unsupported study alert category".to_string());
    }
    if !matches!(payload.priority.as_str(), "default" | "high") {
        return Err("Unsupported study alert priority".to_string());
    }
    Ok(())
}

fn reserve_delivery_slot() -> Result<(), String> {
    let now = Instant::now();
    let mut last_delivery = LAST_DELIVERY
        .lock()
        .map_err(|_| "Phone alert rate limiter is unavailable".to_string())?;

    if let Some(previous) = *last_delivery {
        if now.duration_since(previous) < MIN_DELIVERY_GAP {
            return Err("Please wait a few seconds before sending another phone alert".to_string());
        }
    }

    *last_delivery = Some(now);
    Ok(())
}

#[tauri::command]
pub fn generate_study_alert_topic() -> Result<String, String> {
    // UUID v4 obtains randomness from the operating system. Its random bits make
    // an unauthenticated public topic impractical to guess.
    let topic = format!("fmn_{}", Uuid::new_v4().simple());
    credential_store::set(SecretScope::StudyAlerts, TOPIC_PROVIDER, &topic)?;
    Ok(topic)
}

#[tauri::command]
pub fn get_study_alert_topic() -> Result<Option<String>, String> {
    credential_store::get(SecretScope::StudyAlerts, TOPIC_PROVIDER)
}

#[tauri::command]
pub async fn send_study_alert(payload: StudyAlertPayload) -> Result<StudyAlertDelivery, String> {
    validate_payload(&payload)?;
    let topic = credential_store::get(SecretScope::StudyAlerts, TOPIC_PROVIDER)?
        .ok_or_else(|| "Set up a phone alert topic first".to_string())?;
    validate_topic(&topic)?;
    reserve_delivery_slot()?;

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(Policy::none())
        .build()
        .map_err(|_| "Could not initialize secure phone delivery".to_string())?;

    // Never log the topic or message. Cache:no asks the relay not to retain the
    // alert on disk. Raw audio and full transcripts never enter this function.
    let response = client
        .post(format!("{NTFY_ORIGIN}/{topic}"))
        .header("Title", payload.title)
        .header("Priority", payload.priority)
        .header("Tags", payload.category)
        .header("Cache", "no")
        .body(payload.body)
        .send()
        .await
        .map_err(|_| "Phone alert delivery failed; check your connection".to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Phone alert service returned status {}",
            response.status().as_u16()
        ));
    }

    Ok(StudyAlertDelivery { delivered: true })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload(category: &str) -> StudyAlertPayload {
        StudyAlertPayload {
            title: "Free Meet Notes".to_string(),
            body: "A possible deadline was mentioned.".to_string(),
            category: category.to_string(),
            priority: "high".to_string(),
        }
    }

    #[test]
    fn accepts_generated_topic_shape() {
        let topic = format!("fmn_{}", Uuid::new_v4().simple());
        assert!(validate_topic(&topic).is_ok());
    }

    #[test]
    fn rejects_short_or_path_like_topics() {
        assert!(validate_topic("class").is_err());
        assert!(validate_topic("../../a-topic-that-is-long-enough").is_err());
        assert!(validate_topic("https://example.com/not-a-topic").is_err());
    }

    #[test]
    fn validates_categories_and_lengths() {
        assert!(validate_payload(&payload("deadline")).is_ok());
        assert!(validate_payload(&payload("unknown")).is_err());

        let mut oversized = payload("important");
        oversized.body = "a".repeat(MAX_BODY_CHARS + 1);
        assert!(validate_payload(&oversized).is_err());
    }

    #[test]
    fn native_rate_limiter_rejects_immediate_replay() {
        *LAST_DELIVERY.lock().unwrap() = None;
        assert!(reserve_delivery_slot().is_ok());
        assert!(reserve_delivery_slot().is_err());
        *LAST_DELIVERY.lock().unwrap() = None;
    }
}
