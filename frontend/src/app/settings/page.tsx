'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Settings2, Mic, Database as DatabaseIcon, SparkleIcon, FlaskConical, BellDot } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { TranscriptSettings } from '@/components/TranscriptSettings';
import { RecordingSettings } from '@/components/RecordingSettings';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { BetaSettings } from '@/components/BetaSettings';
import { StudyAlertSettingsPanel } from '@/components/StudyAlertSettings';
import { useConfig } from '@/contexts/ConfigContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Tabs configuration (constant)
const TABS = [
  { value: 'general', label: 'General', icon: Settings2 },
  { value: 'recording', label: 'Recordings', icon: Mic },
  { value: 'Transcriptionmodels', label: 'Transcription', icon: DatabaseIcon },
  { value: 'summaryModels', label: 'Summary', icon: SparkleIcon },
  { value: 'studyAlerts', label: 'Study alerts', icon: BellDot },
  { value: 'beta', label: 'Beta', icon: FlaskConical }
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();

  // Animation state for tabs
  const [activeTab, setActiveTab] = useState('general');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // Load saved transcript configuration on mount
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = await invoke('api_get_transcript_config') as any;
        if (config) {
          console.log('Loaded saved transcript config:', config);
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || 'large-v3',
            apiKey: config.apiKey || null
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, [setTranscriptModelConfig]);

  // Update underline position when active tab changes
  useLayoutEffect(() => {
    const activeIndex = TABS.findIndex(tab => tab.value === activeTab);
    const activeTabElement = tabRefs.current[activeIndex];

    if (activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      setUnderlineStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [activeTab]);

  return (
    <div className="flex h-screen flex-col bg-[#f6f8fc]">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-8 py-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[22px] font-bold tracking-[-0.035em] text-slate-950">Settings</h1>
              <p className="mt-0.5 text-[10px] text-slate-400">Recording, transcription, notes, and privacy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-8 pt-7">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="relative h-12 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              {TABS.map((tab, index) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    ref={el => { tabRefs.current[index] = el }}
                    className="relative z-10 flex h-9 items-center gap-2 rounded-xl border-0 bg-transparent px-5 text-[12px] font-semibold text-slate-500 shadow-none hover:text-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}

              <motion.div
                className="hidden"
                layoutId="underline"
                style={{ left: underlineStyle.left, width: underlineStyle.width }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              />
            </TabsList>

            <TabsContent value="general">
              <PreferenceSettings />
            </TabsContent>
            <TabsContent value="recording">
              <RecordingSettings />
            </TabsContent>
            <TabsContent value="Transcriptionmodels">
              <TranscriptSettings
                transcriptModelConfig={transcriptModelConfig}
                setTranscriptModelConfig={setTranscriptModelConfig}
              />
            </TabsContent>
            <TabsContent value="summaryModels">
              <SummaryModelSettings />
            </TabsContent>
            <TabsContent value="studyAlerts">
              <StudyAlertSettingsPanel />
            </TabsContent>
            <TabsContent value="beta" className="mt-6">
              <BetaSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
