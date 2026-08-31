//! OS-backed storage for provider credentials.
//!
//! API keys must never be written to the meeting database, logs, or frontend build
//! environment. The keyring crate maps this service to Windows Credential Manager,
//! macOS Keychain Services, and Secret Service on supported Linux desktops.

use keyring::v1::{Entry, Error};

const SERVICE: &str = "com.freemeetnotes.desktop";

#[derive(Clone, Copy, Debug)]
pub enum SecretScope {
    Summary,
    Transcription,
}

impl SecretScope {
    fn label(self) -> &'static str {
        match self {
            Self::Summary => "summary",
            Self::Transcription => "transcription",
        }
    }
}

fn account(scope: SecretScope, provider: &str) -> Result<String, String> {
    if provider.is_empty()
        || !provider
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("Credential provider contains unsupported characters".to_string());
    }

    Ok(format!("{}:{}", scope.label(), provider))
}

fn entry(scope: SecretScope, provider: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, &account(scope, provider)?).map_err(safe_error)
}

fn safe_error(error: Error) -> String {
    // Never include provider credentials in errors. keyring errors contain store
    // metadata only, but keep the public error deliberately generic.
    format!("Operating-system credential store error: {error}")
}

pub fn set(scope: SecretScope, provider: &str, secret: &str) -> Result<(), String> {
    if secret.trim().is_empty() {
        return Err("Refusing to store an empty credential".to_string());
    }

    entry(scope, provider)?
        .set_password(secret)
        .map_err(safe_error)
}

pub fn get(scope: SecretScope, provider: &str) -> Result<Option<String>, String> {
    match entry(scope, provider)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(safe_error(error)),
    }
}

pub fn delete(scope: SecretScope, provider: &str) -> Result<(), String> {
    match entry(scope, provider)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(safe_error(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_names_are_scoped() {
        assert_eq!(
            account(SecretScope::Summary, "claude").unwrap(),
            "summary:claude"
        );
        assert_eq!(
            account(SecretScope::Transcription, "openai").unwrap(),
            "transcription:openai"
        );
    }

    #[test]
    fn account_names_reject_untrusted_input() {
        assert!(account(SecretScope::Summary, "../../secret").is_err());
        assert!(account(SecretScope::Summary, "").is_err());
    }
}
