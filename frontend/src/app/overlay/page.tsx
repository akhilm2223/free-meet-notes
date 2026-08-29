'use client'

import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { ExternalLink, EyeOff, Pause, Play, Square } from 'lucide-react'

import { recordingService, type RecordingState } from '@/services/recordingService'

import styles from './overlay.module.css'

const idleState: RecordingState = {
  is_recording: false,
  is_paused: false,
  is_active: false,
  recording_duration: null,
  active_duration: null,
}

type OverlayAction = 'start' | 'pause' | 'resume' | 'stop' | 'open' | 'hide'

function formatDuration(totalSeconds: number | null) {
  const seconds = Math.max(0, Math.floor(totalSeconds ?? 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60

  if (hours > 0) {
    return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':')
  }

  return [minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':')
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default function MeetingOverlayPage() {
  const [recordingState, setRecordingState] = useState<RecordingState>(idleState)
  const [meetingName, setMeetingName] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<OverlayAction | null>(null)
  const [waitingToStart, setWaitingToStart] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncState = useCallback(async () => {
    try {
      const nextState = await recordingService.getRecordingState()
      setRecordingState(nextState)

      if (nextState.is_recording) {
        setWaitingToStart(false)
        const name = await recordingService.getRecordingMeetingName()
        setMeetingName(name)
      } else {
        setMeetingName(null)
      }
    } catch (syncError) {
      console.error('[MeetingOverlay] Failed to sync recording state', syncError)
    }
  }, [])

  useEffect(() => {
    syncState()
    const interval = window.setInterval(syncState, 500)
    return () => window.clearInterval(interval)
  }, [syncState])

  const runAction = async (action: OverlayAction) => {
    setError(null)
    setPendingAction(action)

    if (action === 'start') {
      setWaitingToStart(true)
    }

    try {
      await invoke('overlay_recording_action', { action })
      await syncState()
    } catch (actionError) {
      setWaitingToStart(false)
      setError(errorMessage(actionError))
    } finally {
      setPendingAction(null)
    }
  }

  const isRecording = recordingState.is_recording
  const isPaused = recordingState.is_paused
  const isStopping = pendingAction === 'stop'
  const status = isStopping
    ? 'Saving meeting'
    : waitingToStart && !isRecording
      ? 'Starting recorder'
      : isPaused
        ? 'Recording paused'
        : isRecording
          ? 'Recording locally'
          : 'Ready when you are'
  const detail = error
    ?? (isRecording
      ? meetingName ?? 'Unfiled meeting'
      : waitingToStart
        ? 'Checking devices and transcription model…'
        : 'Mic + system audio stay on this computer')

  return (
    <main className={styles.viewport}>
      <section className={styles.overlay} aria-label="Free Meet Notes recording controls">
        <div className={styles.dragArea} data-tauri-drag-region>
          <span
            className={`${styles.statusDot} ${isRecording && !isPaused ? styles.statusDotActive : ''}`}
            aria-hidden="true"
          />
          <div className={styles.copy} data-tauri-drag-region>
            <div className={styles.statusRow} data-tauri-drag-region>
              <span data-tauri-drag-region>{status}</span>
              {(isRecording || isStopping) && (
                <time data-tauri-drag-region>{formatDuration(recordingState.recording_duration)}</time>
              )}
            </div>
            <p className={error ? styles.error : undefined} data-tauri-drag-region>{detail}</p>
          </div>
        </div>

        <div className={styles.controls}>
          <button
            className={styles.iconButton}
            type="button"
            title="Open Free Meet Notes"
            aria-label="Open Free Meet Notes"
            onClick={() => runAction('open')}
          >
            <ExternalLink size={16} strokeWidth={2} />
          </button>

          {!isRecording ? (
            <button
              className={styles.startButton}
              type="button"
              onClick={() => runAction('start')}
              disabled={pendingAction !== null || waitingToStart}
            >
              <span className={styles.recordGlyph} aria-hidden="true" />
              Record
            </button>
          ) : (
            <>
              <button
                className={styles.iconButton}
                type="button"
                title={isPaused ? 'Resume recording' : 'Pause recording'}
                aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
                onClick={() => runAction(isPaused ? 'resume' : 'pause')}
                disabled={pendingAction !== null}
              >
                {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
              </button>
              <button
                className={styles.stopButton}
                type="button"
                title="Stop and save recording"
                aria-label="Stop and save recording"
                onClick={() => runAction('stop')}
                disabled={pendingAction !== null}
              >
                <Square size={14} fill="currentColor" />
              </button>
            </>
          )}

          <button
            className={styles.iconButton}
            type="button"
            title="Hide meeting controls"
            aria-label="Hide meeting controls"
            onClick={() => runAction('hide')}
          >
            <EyeOff size={16} />
          </button>
        </div>
      </section>
    </main>
  )
}
