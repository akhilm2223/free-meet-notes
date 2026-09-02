import { invoke } from '@tauri-apps/api/core';
import type { TranscriptUpdate } from '@/types';
import {
  detailedAlertBody,
  StudyAlertDetector,
  type StudyAlertCandidate,
  type StudyAlertCategory,
} from './study-alert-classifier';

const STORAGE_KEY = 'free-meet-notes:study-alerts:v1';

export type StudyAlertDetailLevel = 'category-only' | 'include-excerpt';

export interface StudyAlertSettings {
  enabled: boolean;
  phoneEnabled: boolean;
  detailLevel: StudyAlertDetailLevel;
  minimumGapSeconds: number;
  categories: Record<StudyAlertCategory, boolean>;
}

export const DEFAULT_STUDY_ALERT_SETTINGS: StudyAlertSettings = {
  enabled: false,
  phoneEnabled: false,
  detailLevel: 'category-only',
  minimumGapSeconds: 20,
  categories: {
    deadline: true,
    action: true,
    question: true,
    important: true,
  },
};

export function loadStudyAlertSettings(): StudyAlertSettings {
  if (typeof window === 'undefined') return DEFAULT_STUDY_ALERT_SETTINGS;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StudyAlertSettings>;
    return {
      ...DEFAULT_STUDY_ALERT_SETTINGS,
      ...saved,
      minimumGapSeconds: Math.min(120, Math.max(10, Number(saved.minimumGapSeconds) || 20)),
      detailLevel: saved.detailLevel === 'include-excerpt' ? 'include-excerpt' : 'category-only',
      categories: {
        ...DEFAULT_STUDY_ALERT_SETTINGS.categories,
        ...(saved.categories ?? {}),
      },
    };
  } catch {
    return DEFAULT_STUDY_ALERT_SETTINGS;
  }
}

export function saveStudyAlertSettings(settings: StudyAlertSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('study-alert-settings-changed'));
}

export interface StudyAlertProcessResult {
  candidate: StudyAlertCandidate;
  phoneDelivery: 'disabled' | 'delivered' | 'failed';
  deliveryError?: string;
}

class StudyAlertService {
  private detector = new StudyAlertDetector();

  reset(): void {
    this.detector.reset();
  }

  async processTranscript(update: TranscriptUpdate): Promise<StudyAlertProcessResult | null> {
    if (update.is_partial || !update.text.trim()) return null;

    const settings = loadStudyAlertSettings();
    if (!settings.enabled) return null;

    const candidate = this.detector.ingest(
      update.text,
      settings.categories,
      settings.minimumGapSeconds,
    );
    if (!candidate) return null;

    if (!settings.phoneEnabled) {
      return { candidate, phoneDelivery: 'disabled' };
    }

    const body = settings.detailLevel === 'include-excerpt'
      ? detailedAlertBody(candidate)
      : candidate.safeBody;

    try {
      await invoke('send_study_alert', {
        payload: {
          title: candidate.title,
          body,
          category: candidate.category,
          priority: candidate.priority,
        },
      });
      return { candidate, phoneDelivery: 'delivered' };
    } catch (error) {
      return {
        candidate,
        phoneDelivery: 'failed',
        deliveryError: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const studyAlertService = new StudyAlertService();
