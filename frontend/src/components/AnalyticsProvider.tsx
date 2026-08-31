'use client';

import React, { useEffect, ReactNode, createContext } from 'react';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

interface AnalyticsProviderProps {
  children: ReactNode;
}

interface AnalyticsContextType {
  isAnalyticsOptedIn: boolean;
  setIsAnalyticsOptedIn: (optedIn: boolean) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextType>({
  isAnalyticsOptedIn: false,
  setIsAnalyticsOptedIn: () => { },
});

export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  useEffect(() => {
    const disableInheritedAnalytics = async () => {
      const store = await load('analytics.json', {
        autoSave: false,
        defaults: { analyticsOptedIn: false }
      });
      await store.set('analyticsOptedIn', false);
      await store.save();
      await invoke('disable_analytics');
    };
    disableInheritedAnalytics().catch(console.error);
  }, []);

  return (
    <AnalyticsContext.Provider value={{ isAnalyticsOptedIn: false, setIsAnalyticsOptedIn: () => {} }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
