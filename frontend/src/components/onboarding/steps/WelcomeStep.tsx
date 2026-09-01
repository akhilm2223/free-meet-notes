import React from 'react';
import { Lock, Sparkles, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';

export function WelcomeStep() {
  const { goNext } = useOnboarding();

  const features = [
    {
      icon: Lock,
      title: 'Raw recordings stay on your device',
    },
    {
      icon: Sparkles,
      title: 'Use local AI or your own provider',
    },
    {
      icon: Cpu,
      title: 'Works offline with local models',
    },
  ];

  return (
    <OnboardingContainer
      title="Welcome to Free Meet Notes"
      description="A calmer way to remember every meeting—without sending a bot or your raw audio to a dashboard."
      step={1}
      hideProgress={true}
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-7">
        <div className="flex h-14 w-14 items-end gap-1.5 rounded-[18px] bg-slate-950 p-3.5 shadow-lg" aria-hidden="true">
          <span className="h-3 w-2 rounded-full bg-blue-400" />
          <span className="h-7 w-2 rounded-full bg-blue-500" />
          <span className="h-5 w-2 rounded-full bg-sky-300" />
        </div>

        {/* Features Card */}
        <div className="grid w-full max-w-xl grid-cols-3 gap-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50">
                  <Icon className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="mt-4 text-[12px] font-semibold leading-5 text-slate-700">{feature.title}</p>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="w-full max-w-xs space-y-3 pt-1">
          <Button
            onClick={goNext}
            className="h-11 w-full rounded-xl bg-slate-950 text-[13px] font-bold text-white shadow-sm hover:bg-blue-600"
          >
            Set up Free Meet Notes
          </Button>
          <p className="text-center text-[10px] font-medium text-slate-400">About 3 minutes · You stay in control</p>
        </div>
      </div>
    </OnboardingContainer>
  );
}
