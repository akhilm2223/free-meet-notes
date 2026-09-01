import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressIndicator } from './shared/ProgressIndicator';
import { useOnboarding } from '@/contexts/OnboardingContext';
import type { OnboardingContainerProps } from '@/types/onboarding';

export function OnboardingContainer({
  title,
  description,
  children,
  step,
  totalSteps = 5,
  stepOffset = 0,
  hideProgress = false,
  className,
  showNavigation = false,
  onNext,
  onPrevious,
  canGoNext = true,
  canGoPrevious = true,
}: OnboardingContainerProps) {
  const { goToStep, goPrevious, goNext } = useOnboarding();

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    } else {
      goPrevious();
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      goNext();
    }
  };

  const handleStepClick = (s: number) => {
    goToStep(s + stepOffset);
  };

  return (
    <div className="fm-grid-bg fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#f6f8fc] p-6">
      <div className={cn('flex h-full max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-10 py-8 shadow-[0_30px_90px_rgba(15,23,42,0.10)]', className)}>
        {/* Progress Indicator with Navigation - Fixed */}
        {step && !hideProgress && (
          <div className="relative mb-5 flex-shrink-0">
            {/* Navigation Buttons */}
            {showNavigation && (
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none">
                <button
                  onClick={handlePrevious}
                  disabled={!canGoPrevious || step === 1}
                  className={cn(
                    'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200',
                    canGoPrevious && step !== 1
                      ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50'
                      : 'opacity-0 cursor-not-allowed'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={handleNext}
                  disabled={!canGoNext || step === totalSteps}
                  className={cn(
                    'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200',
                    canGoNext && step !== totalSteps
                      ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50'
                      : 'opacity-0 cursor-not-allowed'
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Progress Indicator */}
            <ProgressIndicator current={step} total={totalSteps} onStepClick={handleStepClick} />
          </div>
        )}

        {/* Header - Fixed */}
        <div className="mb-5 flex-shrink-0 space-y-3 text-center">
          <h1 className="animate-fade-in-up text-[36px] font-bold tracking-[-0.045em] text-slate-950">{title}</h1>
          {description && (
            <p className="animate-fade-in-up delay-75 mx-auto max-w-md text-[14px] leading-6 text-slate-500">
              {description}
            </p>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-1">
          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
