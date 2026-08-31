use crate::credential_store::{self, SecretScope};
use crate::database::models::{Setting, TranscriptSetting};
use crate::summary::CustomOpenAIConfig;
use sqlx::SqlitePool;

fn credential_error(error: String) -> sqlx::Error {
    sqlx::Error::Protocol(error.into())
}

fn summary_api_key_column(
    provider: &str,
) -> std::result::Result<Option<&'static str>, sqlx::Error> {
    match provider {
        "openai" => Ok(Some("openaiApiKey")),
        "claude" => Ok(Some("anthropicApiKey")),
        "ollama" => Ok(Some("ollamaApiKey")),
        "groq" => Ok(Some("groqApiKey")),
        "openrouter" => Ok(Some("openRouterApiKey")),
        "builtin-ai" => Ok(None),
        _ => Err(sqlx::Error::Protocol(
            format!("Invalid provider: {provider}").into(),
        )),
    }
}

fn transcript_api_key_column(
    provider: &str,
) -> std::result::Result<Option<&'static str>, sqlx::Error> {
    match provider {
        "localWhisper" => Ok(Some("whisperApiKey")),
        "parakeet" => Ok(None),
        "deepgram" => Ok(Some("deepgramApiKey")),
        "elevenLabs" => Ok(Some("elevenLabsApiKey")),
        "groq" => Ok(Some("groqApiKey")),
        "openai" => Ok(Some("openaiApiKey")),
        _ => Err(sqlx::Error::Protocol(
            format!("Invalid provider: {provider}").into(),
        )),
    }
}

#[derive(serde::Deserialize, Debug)]
pub struct SaveModelConfigRequest {
    pub provider: String,
    pub model: String,
    #[serde(rename = "whisperModel")]
    pub whisper_model: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "ollamaEndpoint")]
    pub ollama_endpoint: Option<String>,
}

#[derive(serde::Deserialize, Debug)]
pub struct SaveTranscriptConfigRequest {
    pub provider: String,
    pub model: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
}

pub struct SettingsRepository;

// Transcript providers: localWhisper, deepgram, elevenLabs, groq, openai
// Summary providers: openai, claude, ollama, groq, added openrouter
// NOTE: Handle data exclusion in the higher layer as this is database abstraction layer(using SELECT *)

impl SettingsRepository {
    pub async fn get_model_config(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<Setting>, sqlx::Error> {
        let setting = sqlx::query_as::<_, Setting>("SELECT * FROM settings LIMIT 1")
            .fetch_optional(pool)
            .await?;
        Ok(setting)
    }

    pub async fn save_model_config(
        pool: &SqlitePool,
        provider: &str,
        model: &str,
        whisper_model: &str,
        ollama_endpoint: Option<&str>,
    ) -> std::result::Result<(), sqlx::Error> {
        // Using id '1' for backward compatibility
        sqlx::query(
            r#"
            INSERT INTO settings (id, provider, model, whisperModel, ollamaEndpoint)
            VALUES ('1', $1, $2, $3, $4)
            ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model,
                whisperModel = excluded.whisperModel,
                ollamaEndpoint = excluded.ollamaEndpoint
            "#,
        )
        .bind(provider)
        .bind(model)
        .bind(whisper_model)
        .bind(ollama_endpoint)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn save_api_key(
        pool: &SqlitePool,
        provider: &str,
        api_key: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        // Custom OpenAI uses JSON config (customOpenAIConfig) instead of a separate API key column
        if provider == "custom-openai" {
            return Err(sqlx::Error::Protocol(
                "custom-openai provider should use save_custom_openai_config() instead of save_api_key()".into(),
            ));
        }

        let Some(api_key_column) = summary_api_key_column(provider)? else {
            return Ok(());
        };

        credential_store::set(SecretScope::Summary, provider, api_key).map_err(credential_error)?;

        // Clear any value written by older releases only after secure storage succeeds.
        let query = format!("UPDATE settings SET {api_key_column} = NULL WHERE id = '1'");
        sqlx::query(&query).execute(pool).await?;

        Ok(())
    }

    pub async fn get_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<Option<String>, sqlx::Error> {
        // Custom OpenAI uses JSON config - extract API key from there
        if provider == "custom-openai" {
            let config = Self::get_custom_openai_config(pool).await?;
            return Ok(config.and_then(|c| c.api_key));
        }

        let Some(api_key_column) = summary_api_key_column(provider)? else {
            return Ok(None);
        };

        if let Some(api_key) =
            credential_store::get(SecretScope::Summary, provider).map_err(credential_error)?
        {
            let clear_query = format!("UPDATE settings SET {api_key_column} = NULL WHERE id = '1'");
            sqlx::query(&clear_query).execute(pool).await?;
            return Ok(Some(api_key));
        }

        let query = format!(
            "SELECT {} FROM settings WHERE id = '1' LIMIT 1",
            api_key_column
        );
        let legacy_api_key: Option<String> =
            sqlx::query_scalar(&query).fetch_optional(pool).await?;

        if let Some(api_key) = legacy_api_key.filter(|key| !key.trim().is_empty()) {
            credential_store::set(SecretScope::Summary, provider, &api_key)
                .map_err(credential_error)?;
            let clear_query = format!("UPDATE settings SET {api_key_column} = NULL WHERE id = '1'");
            sqlx::query(&clear_query).execute(pool).await?;
            return Ok(Some(api_key));
        }

        Ok(None)
    }

    pub async fn get_transcript_config(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<TranscriptSetting>, sqlx::Error> {
        let setting =
            sqlx::query_as::<_, TranscriptSetting>("SELECT * FROM transcript_settings LIMIT 1")
                .fetch_optional(pool)
                .await?;
        Ok(setting)
    }

    pub async fn save_transcript_config(
        pool: &SqlitePool,
        provider: &str,
        model: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO transcript_settings (id, provider, model)
            VALUES ('1', $1, $2)
            ON CONFLICT(id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model
            "#,
        )
        .bind(provider)
        .bind(model)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn save_transcript_api_key(
        pool: &SqlitePool,
        provider: &str,
        api_key: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        let Some(api_key_column) = transcript_api_key_column(provider)? else {
            return Ok(());
        };

        credential_store::set(SecretScope::Transcription, provider, api_key)
            .map_err(credential_error)?;

        let query =
            format!("UPDATE transcript_settings SET {api_key_column} = NULL WHERE id = '1'");
        sqlx::query(&query).execute(pool).await?;

        Ok(())
    }

    pub async fn get_transcript_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<Option<String>, sqlx::Error> {
        let Some(api_key_column) = transcript_api_key_column(provider)? else {
            return Ok(None);
        };

        if let Some(api_key) =
            credential_store::get(SecretScope::Transcription, provider).map_err(credential_error)?
        {
            let clear_query =
                format!("UPDATE transcript_settings SET {api_key_column} = NULL WHERE id = '1'");
            sqlx::query(&clear_query).execute(pool).await?;
            return Ok(Some(api_key));
        }

        let query = format!(
            "SELECT {} FROM transcript_settings WHERE id = '1' LIMIT 1",
            api_key_column
        );
        let legacy_api_key: Option<String> =
            sqlx::query_scalar(&query).fetch_optional(pool).await?;

        if let Some(api_key) = legacy_api_key.filter(|key| !key.trim().is_empty()) {
            credential_store::set(SecretScope::Transcription, provider, &api_key)
                .map_err(credential_error)?;
            let clear_query =
                format!("UPDATE transcript_settings SET {api_key_column} = NULL WHERE id = '1'");
            sqlx::query(&clear_query).execute(pool).await?;
            return Ok(Some(api_key));
        }

        Ok(None)
    }

    pub async fn delete_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        // Custom OpenAI uses JSON config - clear the entire config
        if provider == "custom-openai" {
            credential_store::delete(SecretScope::Summary, provider).map_err(credential_error)?;
            let config = Self::get_custom_openai_config(pool).await?;
            if let Some(mut config) = config {
                config.api_key = None;
                Self::save_custom_openai_config_metadata(pool, &config).await?;
            }
            return Ok(());
        }

        let Some(api_key_column) = summary_api_key_column(provider)? else {
            return Ok(());
        };

        credential_store::delete(SecretScope::Summary, provider).map_err(credential_error)?;

        let query = format!("UPDATE settings SET {api_key_column} = NULL WHERE id = '1'");
        sqlx::query(&query).execute(pool).await?;

        Ok(())
    }

    pub async fn delete_transcript_api_key(
        pool: &SqlitePool,
        provider: &str,
    ) -> std::result::Result<(), sqlx::Error> {
        let Some(api_key_column) = transcript_api_key_column(provider)? else {
            return Ok(());
        };

        credential_store::delete(SecretScope::Transcription, provider).map_err(credential_error)?;
        let query =
            format!("UPDATE transcript_settings SET {api_key_column} = NULL WHERE id = '1'");
        sqlx::query(&query).execute(pool).await?;

        Ok(())
    }

    async fn clear_all_legacy_api_key_columns(
        pool: &SqlitePool,
    ) -> std::result::Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE settings SET
                groqApiKey = NULL,
                openaiApiKey = NULL,
                anthropicApiKey = NULL,
                ollamaApiKey = NULL,
                openRouterApiKey = NULL
            WHERE id = '1'
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            UPDATE transcript_settings SET
                whisperApiKey = NULL,
                deepgramApiKey = NULL,
                elevenLabsApiKey = NULL,
                groqApiKey = NULL,
                openaiApiKey = NULL
            WHERE id = '1'
            "#,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    // ===== CUSTOM OPENAI CONFIG METHODS =====

    /// Gets the custom OpenAI configuration from JSON
    ///
    /// # Returns
    /// * `Ok(Some(CustomOpenAIConfig))` - Config exists and is valid JSON
    /// * `Ok(None)` - No config stored
    /// * `Err(sqlx::Error)` - Database error
    pub async fn get_custom_openai_config(
        pool: &SqlitePool,
    ) -> std::result::Result<Option<CustomOpenAIConfig>, sqlx::Error> {
        use sqlx::Row;

        let row = sqlx::query(
            r#"
            SELECT customOpenAIConfig
            FROM settings
            WHERE id = '1'
            LIMIT 1
            "#,
        )
        .fetch_optional(pool)
        .await?;

        match row {
            Some(record) => {
                let config_json: Option<String> = record.get("customOpenAIConfig");

                if let Some(json) = config_json {
                    let mut config: CustomOpenAIConfig =
                        serde_json::from_str(&json).map_err(|e| {
                            sqlx::Error::Protocol(
                                format!("Invalid JSON in customOpenAIConfig: {e}").into(),
                            )
                        })?;

                    let secure_api_key =
                        credential_store::get(SecretScope::Summary, "custom-openai")
                            .map_err(credential_error)?;

                    if let Some(legacy_api_key) =
                        config.api_key.take().filter(|key| !key.trim().is_empty())
                    {
                        if secure_api_key.is_none() {
                            credential_store::set(
                                SecretScope::Summary,
                                "custom-openai",
                                &legacy_api_key,
                            )
                            .map_err(credential_error)?;
                        }
                        Self::save_custom_openai_config_metadata(pool, &config).await?;
                        config.api_key = secure_api_key.or(Some(legacy_api_key));
                    } else {
                        config.api_key = secure_api_key;
                    }

                    Ok(Some(config))
                } else {
                    Ok(None)
                }
            }
            None => Ok(None),
        }
    }

    /// Saves the custom OpenAI configuration as JSON
    ///
    /// # Arguments
    /// * `pool` - Database connection pool
    /// * `config` - CustomOpenAIConfig to save (includes endpoint, apiKey, model, maxTokens, temperature, topP)
    ///
    /// # Returns
    /// * `Ok(())` - Config saved successfully
    /// * `Err(sqlx::Error)` - Database or JSON serialization error
    pub async fn save_custom_openai_config(
        pool: &SqlitePool,
        config: &CustomOpenAIConfig,
    ) -> std::result::Result<(), sqlx::Error> {
        if let Some(api_key) = config
            .api_key
            .as_deref()
            .filter(|key| !key.trim().is_empty())
        {
            credential_store::set(SecretScope::Summary, "custom-openai", api_key)
                .map_err(credential_error)?;
        } else {
            credential_store::delete(SecretScope::Summary, "custom-openai")
                .map_err(credential_error)?;
        }

        let mut metadata = config.clone();
        metadata.api_key = None;
        Self::save_custom_openai_config_metadata(pool, &metadata).await
    }

    async fn save_custom_openai_config_metadata(
        pool: &SqlitePool,
        config: &CustomOpenAIConfig,
    ) -> std::result::Result<(), sqlx::Error> {
        debug_assert!(config.api_key.is_none());

        let config_json = serde_json::to_string(config).map_err(|e| {
            sqlx::Error::Protocol(format!("Failed to serialize custom endpoint config: {e}").into())
        })?;

        // Upsert into settings table
        sqlx::query(
            r#"
            INSERT INTO settings (id, provider, model, whisperModel, customOpenAIConfig)
            VALUES ('1', 'custom-openai', $1, 'large-v3', $2)
            ON CONFLICT(id) DO UPDATE SET
                customOpenAIConfig = excluded.customOpenAIConfig
            "#,
        )
        .bind(&config.model)
        .bind(config_json)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Move secrets written by older releases into the operating-system credential store.
    /// Plaintext columns are cleared only after every required secure-store write succeeds.
    pub async fn migrate_legacy_api_keys(
        pool: &SqlitePool,
    ) -> std::result::Result<(), sqlx::Error> {
        if let Some(setting) = Self::get_model_config(pool).await? {
            let summary_keys = [
                ("groq", setting.groq_api_key.as_ref()),
                ("openai", setting.openai_api_key.as_ref()),
                ("claude", setting.anthropic_api_key.as_ref()),
                ("ollama", setting.ollama_api_key.as_ref()),
                ("openrouter", setting.open_router_api_key.as_ref()),
            ];

            for (provider, legacy_key) in summary_keys {
                if legacy_key.is_some_and(|key| !key.trim().is_empty()) {
                    Self::get_api_key(pool, provider).await?;
                }
            }

            if setting.custom_openai_config.as_ref().is_some_and(|json| {
                serde_json::from_str::<CustomOpenAIConfig>(json)
                    .ok()
                    .and_then(|config| config.api_key)
                    .is_some_and(|key| !key.trim().is_empty())
            }) {
                Self::get_custom_openai_config(pool).await?;
            }
        }

        if let Some(setting) = Self::get_transcript_config(pool).await? {
            let transcript_keys = [
                ("localWhisper", setting.whisper_api_key.as_ref()),
                ("deepgram", setting.deepgram_api_key.as_ref()),
                ("elevenLabs", setting.eleven_labs_api_key.as_ref()),
                ("groq", setting.groq_api_key.as_ref()),
                ("openai", setting.openai_api_key.as_ref()),
            ];

            for (provider, legacy_key) in transcript_keys {
                if legacy_key.is_some_and(|key| !key.trim().is_empty()) {
                    Self::get_transcript_api_key(pool, provider).await?;
                }
            }
        }

        Self::clear_all_legacy_api_key_columns(pool).await
    }
}
