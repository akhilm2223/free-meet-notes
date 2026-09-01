import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { PermissionWarning } from '@/components/PermissionWarning';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Copy, GlobeIcon, LockKeyhole, Radio } from 'lucide-react';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { ModalType } from '@/hooks/useModalState';
import { useIsLinux } from '@/hooks/usePlatform';
import { useMemo } from 'react';

/**
 * TranscriptPanel Component
 *
 * Displays transcript content with controls for copying and language settings.
 * Uses TranscriptContext, ConfigContext, and RecordingStateContext internally.
 */

interface TranscriptPanelProps {
  // indicates stop-processing state for transcripts; derived from backend statuses.
  isProcessingStop: boolean;
  isStopping: boolean;
  showModal: (name: ModalType, message?: string) => void;
}

export function TranscriptPanel({
  isProcessingStop,
  isStopping,
  showModal
}: TranscriptPanelProps) {
  // Contexts
  const { transcripts, transcriptContainerRef, copyTranscript } = useTranscripts();
  const { transcriptModelConfig } = useConfig();
  const { isRecording, isPaused } = useRecordingState();
  const { checkPermissions, isChecking, hasSystemAudio, hasMicrophone } = usePermissionCheck();
  const isLinux = useIsLinux();

  // Convert transcripts to segments for virtualized view
  const segments = useMemo(() =>
    transcripts.map(t => ({
      id: t.id,
      timestamp: t.audio_start_time ?? 0,
      endTime: t.audio_end_time,
      text: t.text,
      confidence: t.confidence,
    })),
    [transcripts]
  );

  return (
    <section ref={transcriptContainerRef} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc]">
      <header className="flex h-[68px] flex-shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-8 backdrop-blur-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">
              {isRecording ? 'Live meeting' : 'New meeting'}
            </h1>
            {isRecording && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                <Radio className="h-3 w-3" />
                {isPaused ? 'Paused' : 'Listening'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {isRecording ? 'Your transcript appears here as the conversation unfolds.' : 'Capture a conversation without adding a bot to the call.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 lg:inline-flex">
            <LockKeyhole className="h-3 w-3 text-blue-600" />
            Audio stays local
          </span>
          <ButtonGroup>
                {transcripts?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyTranscript}
                    title="Copy Transcript"
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs text-slate-600 shadow-none hover:bg-slate-50 hover:text-slate-950"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span className='hidden md:inline'>
                      Copy
                    </span>
                  </Button>
                )}
                {transcriptModelConfig.provider === "localWhisper" &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showModal('languageSettings')}
                    title="Language"
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs text-slate-600 shadow-none hover:bg-slate-50 hover:text-slate-950"
                  >
                    <GlobeIcon className="h-3.5 w-3.5" />
                    <span className='hidden md:inline'>
                      Language
                    </span>
                  </Button>
                }
          </ButtonGroup>
        </div>
      </header>

      {/* Permission Warning - Not needed on Linux */}
      {!isRecording && !isChecking && !isLinux && (
        <div className="flex flex-shrink-0 justify-center px-8 pt-5">
          <PermissionWarning
            hasMicrophone={hasMicrophone}
            hasSystemAudio={hasSystemAudio}
            onRecheck={checkPermissions}
            isRechecking={isChecking}
          />
        </div>
      )}

      {/* Transcript content */}
      <div className="min-h-0 flex-1 px-8 pb-28 pt-4">
        <div className="mx-auto h-full w-full max-w-[860px]">
            <VirtualizedTranscriptView
              segments={segments}
              isRecording={isRecording}
              isPaused={isPaused}
              isProcessing={isProcessingStop}
              isStopping={isStopping}
              enableStreaming={isRecording}
              showConfidence={true}
            />
        </div>
      </div>
    </section>
  );
}
