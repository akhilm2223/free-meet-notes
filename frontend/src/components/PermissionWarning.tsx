import React from 'react';
import { AlertTriangle, Mic, Speaker, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { invoke } from '@tauri-apps/api/core';
import { useIsLinux } from '@/hooks/usePlatform';

interface PermissionWarningProps {
  hasMicrophone: boolean;
  hasSystemAudio: boolean;
  onRecheck: () => void;
  isRechecking?: boolean;
}

export function PermissionWarning({
  hasMicrophone,
  hasSystemAudio,
  onRecheck,
  isRechecking = false
}: PermissionWarningProps) {
  const isLinux = useIsLinux();

  // Don't show on Linux - permission handling is not needed
  if (isLinux) {
    return null;
  }

  // Don't show if both permissions are granted
  if (hasMicrophone && hasSystemAudio) {
    return null;
  }

  const isMacOS = navigator.userAgent.includes('Mac');

  const openMicrophoneSettings = async () => {
    if (isMacOS) {
      try {
        await invoke('open_system_settings', { preferencePane: 'Privacy_Microphone' });
      } catch (error) {
        console.error('Failed to open microphone settings:', error);
      }
    }
  };

  const openScreenRecordingSettings = async () => {
    if (isMacOS) {
      try {
        await invoke('open_system_settings', { preferencePane: 'Privacy_ScreenCapture' });
      } catch (error) {
        console.error('Failed to open screen recording settings:', error);
      }
    }
  };

  return (
    <div className="mb-1 w-full max-w-[860px]">
      {(!hasMicrophone || !hasSystemAudio) && (
        <Alert className="flex items-center gap-3 rounded-2xl border-amber-200 bg-amber-50/90 px-4 py-3 text-amber-950 shadow-none">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <AlertTitle className="text-[12px] font-bold text-amber-950">
              Audio setup needs attention
            </AlertTitle>
            <AlertDescription className="mt-0.5 text-[10px] leading-4 text-amber-800">
              {!hasMicrophone && !hasSystemAudio
                ? 'Microphone and system audio are unavailable. Check access before recording.'
                : !hasMicrophone
                  ? 'Microphone access is unavailable. Check the connected device and permission.'
                  : 'System audio is unavailable. Microphone-only recording is still possible.'}
            </AlertDescription>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {isMacOS && !hasMicrophone && (
              <button
                onClick={openMicrophoneSettings}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 text-[10px] font-bold text-amber-900 transition-colors hover:bg-amber-100"
              >
                <Mic className="h-3.5 w-3.5" />
                Microphone
              </button>
            )}
            {isMacOS && !hasSystemAudio && (
              <button
                onClick={openScreenRecordingSettings}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 text-[10px] font-bold text-amber-900 transition-colors hover:bg-amber-100"
              >
                <Speaker className="h-3.5 w-3.5" />
                System audio
              </button>
            )}
            <button
              onClick={onRecheck}
              disabled={isRechecking}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 text-[10px] font-bold text-amber-900 transition-colors hover:bg-amber-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
              Recheck
            </button>
          </div>
        </Alert>
      )}
    </div>
  );
}
