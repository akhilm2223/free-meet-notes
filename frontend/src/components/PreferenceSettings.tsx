"use client"

import { useEffect, useState, useRef } from "react"
import { Switch } from "./ui/switch"
import { BellRing, FolderOpen, HardDrive, Radar, ShieldCheck } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import Analytics from "@/lib/analytics"
import { useConfig, NotificationSettings } from "@/contexts/ConfigContext"

interface MeetingDetectionSettings {
  enabled: boolean
  zoom: boolean
  teams: boolean
  googleMeet: boolean
}

const defaultMeetingDetectionSettings: MeetingDetectionSettings = {
  enabled: true,
  zoom: true,
  teams: true,
  googleMeet: true,
}

export function PreferenceSettings() {
  const {
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
    loadPreferences,
    updateNotificationSettings
  } = useConfig();

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousNotificationsEnabled, setPreviousNotificationsEnabled] = useState<boolean | null>(null);
  const [meetingDetection, setMeetingDetection] = useState<MeetingDetectionSettings>(defaultMeetingDetectionSettings);
  const [savingMeetingDetection, setSavingMeetingDetection] = useState(false);
  const hasTrackedViewRef = useRef(false);

  // Lazy load preferences on mount (only loads if not already cached)
  useEffect(() => {
    loadPreferences();
    // Reset tracking ref on mount (every tab visit)
    hasTrackedViewRef.current = false;
  }, [loadPreferences]);

  // Track preferences viewed analytics on every tab visit (once per mount)
  useEffect(() => {
    if (hasTrackedViewRef.current) return;

    const trackPreferencesViewed = async () => {
      // Wait for notification settings to be available (either from cache or after loading)
      if (notificationSettings) {
        await Analytics.track('preferences_viewed', {
          notifications_enabled: notificationSettings.notification_preferences.show_recording_started ? 'true' : 'false'
        });
        hasTrackedViewRef.current = true;
      } else if (!isLoadingPreferences) {
        // If not loading and no settings available, track with default value
        await Analytics.track('preferences_viewed', {
          notifications_enabled: 'false'
        });
        hasTrackedViewRef.current = true;
      }
    };

    trackPreferencesViewed();
  }, [notificationSettings, isLoadingPreferences]);

  // Update notificationsEnabled when notificationSettings are loaded from global state
  useEffect(() => {
    if (notificationSettings) {
      // Notification enabled means both started and stopped notifications are enabled
      const enabled =
        notificationSettings.notification_preferences.show_recording_started &&
        notificationSettings.notification_preferences.show_recording_stopped;
      setNotificationsEnabled(enabled);
      if (isInitialLoad) {
        setPreviousNotificationsEnabled(enabled);
        setIsInitialLoad(false);
      }
    } else if (!isLoadingPreferences) {
      // If not loading and no settings, use default
      setNotificationsEnabled(true);
      if (isInitialLoad) {
        setPreviousNotificationsEnabled(true);
        setIsInitialLoad(false);
      }
    }
  }, [notificationSettings, isLoadingPreferences, isInitialLoad])

  useEffect(() => {
    invoke<MeetingDetectionSettings>('get_meeting_detection_settings')
      .then(setMeetingDetection)
      .catch((error) => console.error('Failed to load meeting detection settings:', error));
  }, []);

  const updateMeetingDetection = async (next: MeetingDetectionSettings) => {
    const previous = meetingDetection;
    setMeetingDetection(next);
    setSavingMeetingDetection(true);

    try {
      await invoke('set_meeting_detection_settings', { settings: next });
      toast.success('Meeting detection preference saved');
    } catch (error) {
      setMeetingDetection(previous);
      console.error('Failed to save meeting detection settings:', error);
      toast.error('Failed to save meeting detection preference');
    } finally {
      setSavingMeetingDetection(false);
    }
  };

  useEffect(() => {
    // Skip update on initial load or if value hasn't actually changed
    if (isInitialLoad || notificationsEnabled === null || notificationsEnabled === previousNotificationsEnabled) return;
    if (!notificationSettings) return;

    const handleUpdateNotificationSettings = async () => {
      console.log("Updating notification settings to:", notificationsEnabled);

      try {
        // Update the notification preferences
        const updatedSettings: NotificationSettings = {
          ...notificationSettings,
          notification_preferences: {
            ...notificationSettings.notification_preferences,
            show_recording_started: notificationsEnabled,
            show_recording_stopped: notificationsEnabled,
          }
        };

        console.log("Calling updateNotificationSettings with:", updatedSettings);
        await updateNotificationSettings(updatedSettings);
        setPreviousNotificationsEnabled(notificationsEnabled);
        console.log("Successfully updated notification settings to:", notificationsEnabled);

        // Track notification preference change - only fires when user manually toggles
        await Analytics.track('notification_settings_changed', {
          notifications_enabled: notificationsEnabled.toString()
        });
      } catch (error) {
        console.error('Failed to update notification settings:', error);
      }
    };

    handleUpdateNotificationSettings();
  }, [notificationsEnabled, notificationSettings, isInitialLoad, previousNotificationsEnabled, updateNotificationSettings])

  const handleOpenFolder = async (folderType: 'database' | 'models' | 'recordings') => {
    try {
      switch (folderType) {
        case 'database':
          await invoke('open_database_folder');
          break;
        case 'models':
          await invoke('open_models_folder');
          break;
        case 'recordings':
          await invoke('open_recordings_folder');
          break;
      }

      // Track storage folder access
      await Analytics.track('storage_folder_opened', {
        folder_type: folderType
      });
    } catch (error) {
      console.error(`Failed to open ${folderType} folder:`, error);
    }
  };

  // Show loading only if we're actually loading and don't have cached data
  if (isLoadingPreferences && !notificationSettings && !storageLocations) {
    return <div className="max-w-2xl mx-auto p-6">Loading Preferences...</div>
  }

  // Show loading if notificationsEnabled hasn't been determined yet
  if (notificationsEnabled === null && !isLoadingPreferences) {
    return <div className="max-w-2xl mx-auto p-6">Loading Preferences...</div>
  }

  // Ensure we have a boolean value for the Switch component
  const notificationsEnabledValue = notificationsEnabled ?? false;

  return (
    <div className="mt-6 grid gap-5">
      {/* Notifications Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <BellRing className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">Recording notifications</h3>
              <p className="mt-1 max-w-xl text-[13px] leading-5 text-slate-500">
                Get a quiet system notification when recording starts or stops.
              </p>
            </div>
          </div>
          <Switch
            checked={notificationsEnabledValue}
            onCheckedChange={setNotificationsEnabled}
            aria-label="Enable recording notifications"
          />
        </div>
      </section>

      {/* Meeting Detection Section */}
      <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-[0_16px_36px_-30px_rgba(37,99,235,0.5)]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Radar className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">Meeting detection</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-blue-700">Local</span>
              </div>
              <p className="mt-1 max-w-xl text-[13px] leading-5 text-slate-500">
                Show the compact Start recording control when a supported meeting appears.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Recording never starts without your click.
              </p>
            </div>
          </div>
          <Switch
            checked={meetingDetection.enabled}
            disabled={savingMeetingDetection}
            onCheckedChange={(enabled) => updateMeetingDetection({ ...meetingDetection, enabled })}
            aria-label="Enable automatic meeting detection"
          />
        </div>

        <div className={`mt-6 grid gap-3 sm:grid-cols-3 ${meetingDetection.enabled ? '' : 'opacity-50'}`}>
          {([
            ['zoom', 'Zoom'],
            ['teams', 'Microsoft Teams'],
            ['googleMeet', 'Google Meet'],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
              <span className="text-[12px] font-semibold text-slate-700">{label}</span>
              <Switch
                checked={meetingDetection[key]}
                disabled={!meetingDetection.enabled || savingMeetingDetection}
                onCheckedChange={(enabled) => updateMeetingDetection({ ...meetingDetection, [key]: enabled })}
                aria-label={`Detect ${label} meetings`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Data Storage Locations Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <HardDrive className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">Local storage</h3>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">Your recordings and meeting memory stay in a folder you control.</p>
          </div>
        </div>

        <div className="mt-5">
          {/* Database Location */}
          {/* <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Database</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.database || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('database')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div> */}

          {/* Models Location */}
          {/* <div className="p-4 border rounded-lg bg-gray-50">
            <div className="font-medium mb-2">Whisper Models</div>
            <div className="text-sm text-gray-600 mb-3 break-all font-mono text-xs">
              {storageLocations?.models || 'Loading...'}
            </div>
            <button
              onClick={() => handleOpenFolder('models')}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div> */}

          {/* Recordings Location */}
          <div className="flex items-center justify-between gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-slate-800">Meeting recordings</div>
              <div className="mt-1 truncate font-mono text-[10px] text-slate-500">
              {storageLocations?.recordings || 'Loading...'}
              </div>
            </div>
            <button
              onClick={() => handleOpenFolder('recordings')}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-700"
            >
              <FolderOpen className="w-4 h-4" />
              Open Folder
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-blue-50/80 px-4 py-3">
          <p className="text-[11px] leading-5 text-blue-800">
            Database and local AI models stay together in the application data folder for easier backup and management.
          </p>
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-5 py-4 text-blue-950">
        <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        <div>
          <h3 className="text-[12px] font-bold">No usage telemetry</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-blue-800">Free Meet Notes does not send product analytics or meeting data to us.</p>
        </div>
      </section>
    </div>
  )
}
