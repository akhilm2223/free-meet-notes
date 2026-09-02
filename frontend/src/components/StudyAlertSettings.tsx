'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  BellDot,
  Check,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MessageSquareText,
  RotateCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from './ui/switch';
import {
  DEFAULT_STUDY_ALERT_SETTINGS,
  loadStudyAlertSettings,
  saveStudyAlertSettings,
  type StudyAlertSettings,
} from '@/lib/study-alerts';
import type { StudyAlertCategory } from '@/lib/study-alert-classifier';

const CATEGORY_OPTIONS: Array<{
  key: StudyAlertCategory;
  label: string;
  description: string;
}> = [
  { key: 'deadline', label: 'Deadlines', description: 'Due dates and submission times' },
  { key: 'action', label: 'Things to do', description: 'Writing, reading and assignments' },
  { key: 'question', label: 'Class questions', description: 'Questions directed to you or the class' },
  { key: 'important', label: 'Important points', description: 'Exam hints, definitions and key ideas' },
];

function maskedTopic(topic: string): string {
  if (!topic) return 'Not connected';
  return `${topic.slice(0, 8)}••••••••${topic.slice(-5)}`;
}

export function StudyAlertSettingsPanel() {
  const [settings, setSettings] = useState<StudyAlertSettings>(DEFAULT_STUDY_ALERT_SETTINGS);
  const [topic, setTopic] = useState('');
  const [showTopic, setShowTopic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'topic' | 'test' | null>(null);

  useEffect(() => {
    setSettings(loadStudyAlertSettings());
    invoke<string | null>('get_study_alert_topic')
      .then((savedTopic) => setTopic(savedTopic ?? ''))
      .catch(() => toast.error('Could not read the phone channel from the credential vault'))
      .finally(() => setLoading(false));
  }, []);

  const updateSettings = (next: StudyAlertSettings) => {
    setSettings(next);
    saveStudyAlertSettings(next);
  };

  const createTopic = async () => {
    setWorking('topic');
    try {
      const nextTopic = await invoke<string>('generate_study_alert_topic');
      setTopic(nextTopic);
      setShowTopic(true);
      toast.success('A new phone channel was saved securely');
    } catch (error) {
      toast.error('Could not create a phone channel', { description: String(error) });
    } finally {
      setWorking(null);
    }
  };

  const copyTopic = async () => {
    try {
      await navigator.clipboard.writeText(topic);
      toast.success('Topic copied');
    } catch {
      toast.error('Could not copy the topic');
    }
  };

  const setPhoneEnabled = (phoneEnabled: boolean) => {
    if (phoneEnabled && !topic) {
      toast.error('Create a phone channel first');
      return;
    }
    updateSettings({ ...settings, phoneEnabled });
  };

  const sendTest = async () => {
    if (!topic) {
      toast.error('Create a phone channel first');
      return;
    }

    setWorking('test');
    try {
      await invoke('send_study_alert', {
        payload: {
          title: 'Free Meet Notes is connected',
          body: settings.detailLevel === 'include-excerpt'
            ? 'Phone alerts are ready. During a recording, only detected study alerts—not raw audio—will be sent.'
            : 'Phone alerts are ready. Category-only privacy is active.',
          category: 'test',
          priority: 'high',
        },
      });
      toast.success('Test sent to your phone');
    } catch (error) {
      toast.error('The test could not be delivered', { description: String(error) });
    } finally {
      setWorking(null);
    }
  };

  const openIPhoneApp = () => {
    void invoke('open_external_url', {
      url: 'https://apps.apple.com/us/app/ntfy/id1625396347',
    });
  };

  if (loading) {
    return (
      <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label="Loading study alerts" />
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-5">
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-[0_24px_60px_-42px_rgba(37,99,235,0.6)]">
        <div className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <BellDot className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-bold tracking-[-0.025em] text-slate-950">Live study alerts</h2>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-blue-700">Preview</span>
                </div>
                <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-600">
                  While you record, detect deadlines, requests, class questions and key information from finalized transcript segments.
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Detection runs locally. It never starts a recording or uploads raw audio.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => updateSettings({ ...settings, enabled })}
              aria-label="Enable live study alerts"
            />
          </div>
        </div>

        <div className={`grid gap-3 p-6 sm:grid-cols-2 ${settings.enabled ? '' : 'pointer-events-none opacity-45'}`}>
          {CATEGORY_OPTIONS.map((option) => (
            <div key={option.key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <div className="text-[12px] font-bold text-slate-900">{option.label}</div>
                <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{option.description}</div>
              </div>
              <Switch
                checked={settings.categories[option.key]}
                onCheckedChange={(enabled) => updateSettings({
                  ...settings,
                  categories: { ...settings.categories, [option.key]: enabled },
                })}
                aria-label={`Enable ${option.label.toLowerCase()} alerts`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_-36px_rgba(15,23,42,0.5)]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">Send alerts to my phone</h3>
              <p className="mt-1 max-w-xl text-[12px] leading-5 text-slate-500">
                Uses the free, open-source ntfy phone app. This is a push notification, not an SMS message.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.phoneEnabled}
            disabled={!settings.enabled}
            onCheckedChange={setPhoneEnabled}
            aria-label="Send study alerts to phone"
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Phone topic</div>
                <div className="mt-1 font-mono text-[11px] font-semibold text-slate-800">
                  {showTopic ? (topic || 'Not connected') : maskedTopic(topic)}
                </div>
              </div>
              {topic && (
                <button
                  type="button"
                  onClick={() => setShowTopic((visible) => !visible)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900"
                  aria-label={showTopic ? 'Hide phone topic' : 'Show phone topic'}
                >
                  {showTopic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createTopic}
                disabled={working !== null}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3.5 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {working === 'topic' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                {topic ? 'Replace topic' : 'Create secure topic'}
              </button>
              {topic && (
                <button
                  type="button"
                  onClick={copyTopic}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy
                </button>
              )}
            </div>
            {topic && (
              <p className="mt-3 text-[10px] leading-4 text-slate-500">
                Treat this random topic like a password. Replacing it immediately disconnects the old phone subscription.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Connect iPhone or Android</div>
            <ol className="mt-3 grid gap-2.5 text-[11px] leading-4 text-slate-700">
              <li className="flex gap-2"><span className="font-bold text-blue-600">1.</span><span>Install <strong>ntfy</strong> on your phone.</span></li>
              <li className="flex gap-2"><span className="font-bold text-blue-600">2.</span><span>Tap <strong>+</strong>, keep server <strong>ntfy.sh</strong>, and paste this topic.</span></li>
              <li className="flex gap-2"><span className="font-bold text-blue-600">3.</span><span>Allow notifications, then send a test below.</span></li>
            </ol>
            <button
              type="button"
              onClick={openIPhoneApp}
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 hover:text-blue-900"
            >
              Open iPhone App Store <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Phone privacy</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => updateSettings({ ...settings, detailLevel: 'category-only' })}
              className={`rounded-2xl border p-4 text-left transition-colors ${settings.detailLevel === 'category-only' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[12px] font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-blue-600" /> Category only</span>
                {settings.detailLevel === 'category-only' && <Check className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Recommended. Sends “possible deadline” or “class question,” never transcript words.</p>
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ ...settings, detailLevel: 'include-excerpt' })}
              className={`rounded-2xl border p-4 text-left transition-colors ${settings.detailLevel === 'include-excerpt' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[12px] font-bold text-slate-900"><MessageSquareText className="h-4 w-4 text-amber-600" /> Include short excerpt</span>
                {settings.detailLevel === 'include-excerpt' && <Check className="h-4 w-4 text-amber-600" />}
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-slate-500">More useful, but the selected transcript excerpt passes through the ntfy.sh relay.</p>
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
          <div>
            <div className="text-[11px] font-bold text-slate-800">Test before class</div>
            <div className="mt-0.5 text-[10px] text-slate-500">Delivery may fail while the phone is offline because server-side message caching is disabled.</div>
          </div>
          <button
            type="button"
            onClick={sendTest}
            disabled={!topic || working !== null}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[11px] font-bold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {working === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
            Send test
          </button>
        </div>
      </section>

      <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-amber-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <h3 className="text-[12px] font-bold">Helpful signal, not a guarantee</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
            Alerts depend on microphone quality and live transcription. They can miss a request or flag ordinary speech, so always check the transcript and course materials.
          </p>
        </div>
      </section>
    </div>
  );
}
