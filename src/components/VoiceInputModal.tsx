import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useApiLoading } from '../context/ApiLoadingContext';
import { ParsedVoiceIntent } from '../types';
import { formatPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Check,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Cpu,
  Layers,
  CheckCircle2,
  Zap,
  ShieldCheck,
} from 'lucide-react';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommitAddTransaction: (params: {
    amountPaise: number;
    categoryId: string;
    paymentMethod: any;
    note?: string;
  }) => void;
  onOpenSalaryFlow: () => void;
  onOpenReconcileFlow: (categoryId?: string) => void;
  onOpenMoveFundsFlow?: (fromCatId?: string, toCatId?: string, amountPaise?: number) => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  onCommitAddTransaction,
  onOpenSalaryFlow,
  onOpenReconcileFlow,
  onOpenMoveFundsFlow,
}) => {
  const { activeCategories, activeMember } = useBudget();
  const { startApiCall } = useApiLoading();

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<'transcribing' | 'querying' | 'structuring'>('transcribing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceIntent | null>(null);
  const [parsedModelUsed, setParsedModelUsed] = useState<string | null>(null);
  const [isFallbackUsed, setIsFallbackUsed] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Web Speech API
  const [recognition, setRecognition] = useState<any>(null);
  const transcriptRef = useRef<string>('');
  const parseRef = useRef<(text: string) => void>(() => {});
  const isLoadingRef = useRef<boolean>(false);
  const autoParseTimerRef = useRef<any>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = 'en-IN'; // Indian English

      recog.onresult = (event: any) => {
        let currentTranscript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }
        const text = currentTranscript.trim();
        if (text) {
          setTranscript(text);
          transcriptRef.current = text;

          // If a final phrase is recognized, trigger auto-parse shortly after speaking pauses
          if (isFinal) {
            if (autoParseTimerRef.current) clearTimeout(autoParseTimerRef.current);
            autoParseTimerRef.current = setTimeout(() => {
              if (transcriptRef.current && !isLoadingRef.current) {
                try {
                  recog.stop();
                } catch {}
                setIsListening(false);
                parseRef.current(transcriptRef.current);
              }
            }, 600);
          }
        }
      };

      recog.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recog.onend = () => {
        setIsListening(false);
        // Automatically parse transcript if speech finished and not already loading
        const textToParse = transcriptRef.current.trim();
        if (textToParse && !isLoadingRef.current) {
          parseRef.current(textToParse);
        }
      };

      setRecognition(recog);
    }
  }, []);

  const handleParseWithGemini = useCallback(async (textToParse: string) => {
    // Client-side sanitization: strip HTML tags and limit length
    const sanitizedText = textToParse
      .slice(0, 350)
      .replace(/<[^>]*>/g, '')
      .trim();
    if (!sanitizedText) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setLoadingStage('transcribing');
    setErrorMessage(null);
    setParsedResult(null);
    setParsedModelUsed(null);
    setIsFallbackUsed(false);

    const stopGlobalLoader = startApiCall('Processing voice expense...');

    // Progress stage simulation for rich UX feedback
    const stageTimer1 = setTimeout(() => {
      setLoadingStage('querying');
    }, 450);
    const stageTimer2 = setTimeout(() => {
      setLoadingStage('structuring');
    }, 950);

    try {
      const availableCategories = activeCategories.map(c => c.name);
      const res = await fetch('/api/parse-voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sanitizedText,
          availableCategories,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server failed to parse intent');
      }

      setParsedResult(data.result);
      setParsedModelUsed(data.modelUsed || 'Gemini 3.1 Flash Lite');
      setIsFallbackUsed(Boolean(data.isFallback));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Gemini parse request aborted by user');
      } else {
        console.error('Gemini intent parse failed:', err);
        setErrorMessage(err.message || 'Could not parse intent. Please try manual entry.');
      }
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsLoading(false);
      stopGlobalLoader();
      abortControllerRef.current = null;
    }
  }, [activeCategories, startApiCall]);

  useEffect(() => {
    parseRef.current = handleParseWithGemini;
  }, [handleParseWithGemini]);

  useEffect(() => {
    let autoListenTimer: any;
    if (isOpen) {
      setTranscript('');
      setParsedResult(null);
      setErrorMessage(null);
      setIsLoading(false);

      // Auto-start listening as requested: "we should start auto listening when voice modal opens up"
      autoListenTimer = setTimeout(() => {
        if (recognition) {
          try {
            recognition.start();
            setIsListening(true);
          } catch (err) {
            // Already started or waiting for user interaction/permission
            console.log('Auto speech recognition start notice:', err);
          }
        }
      }, 250);
    } else {
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
      setIsListening(false);
    }

    return () => {
      if (autoListenTimer) clearTimeout(autoListenTimer);
    };
  }, [isOpen, recognition]);

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. You can type your request directly.');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setParsedResult(null);
      setErrorMessage(null);
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCancelParse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  };

  const handleConfirmIntent = () => {
    if (!parsedResult) return;

    if (parsedResult.intent === 'add_transaction') {
      // Find matching category
      const matchedCat =
        activeCategories.find(
          c =>
            c.name.toLowerCase() === (parsedResult.categoryName || '').toLowerCase()
        ) ||
        activeCategories.find(
          c =>
            c.name.toLowerCase().includes((parsedResult.categoryName || '').toLowerCase())
        ) ||
        activeCategories[0];

      onCommitAddTransaction({
        amountPaise: parsedResult.amountInPaise,
        categoryId: matchedCat.id,
        paymentMethod: parsedResult.paymentMethod || 'credit_card',
        note: parsedResult.note || transcript,
      });
      onClose();
    } else if (parsedResult.intent === 'mark_salary_arrived') {
      onClose();
      onOpenSalaryFlow();
    } else if (parsedResult.intent === 'mark_reconciled') {
      onClose();
      onOpenReconcileFlow();
    } else if (parsedResult.intent === 'move_funds') {
      const fromCat = activeCategories.find(c =>
        c.name.toLowerCase().includes((parsedResult.fromCategoryName || '').toLowerCase())
      );
      const toCat = activeCategories.find(c =>
        c.name.toLowerCase().includes((parsedResult.toCategoryName || '').toLowerCase())
      );

      onClose();
      if (onOpenMoveFundsFlow) {
        onOpenMoveFundsFlow(fromCat?.id, toCat?.id, parsedResult.amountInPaise);
      }
    } else {
      // Query balance or other
      onClose();
    }
  };

  const sampleVoicePrompts = [
    'Spent 450 on Groceries with UPI',
    'Paid 1800 at Dining with card',
    'Move 1500 from Groceries to Dining',
    'Salary arrived 150000 this month',
    'Reconcile 3000 for dining card payback',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B85D43]" />
            <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1] leading-tight">
              Voice Assistant
            </h2>
          </div>
          <button
            onClick={onClose}
            id="close-voice-modal"
            className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Mic Action Area */}
          <div className="flex flex-col items-center justify-center py-4 bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823]">
            <button
              onClick={toggleListening}
              id="voice-mic-trigger"
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-[#B85D43] text-white shadow-lg animate-pulse ring-4 ring-[#B85D43]/30'
                  : 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] hover:scale-105'
              }`}
            >
              {isListening ? <Mic className="w-8 h-8" /> : <Mic className="w-7 h-7" />}
            </button>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-3 font-medium text-center">
              {isListening
                ? 'Listening... speaks naturally. It will auto-parse as soon as you finish!'
                : 'Tap mic to speak (auto-parses) or type below and press Enter'}
            </p>
          </div>

          {/* Transcript / Text Input */}
          <div className="relative">
            <textarea
              rows={2}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && transcript.trim() && !isLoading) {
                  e.preventDefault();
                  handleParseWithGemini(transcript);
                }
              }}
              placeholder="e.g. Spent 850 on fuel at Shell (press Enter to parse)..."
              id="voice-transcript-input"
              className="w-full px-3 py-2.5 bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none focus:ring-1 focus:ring-[#1F1B16]"
            />
            {transcript && !isLoading && !parsedResult && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleParseWithGemini(transcript)}
                  id="parse-voice-intent-btn"
                  className="flex-1 py-2 px-3 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parse with Gemini (or Press Enter)</span>
                </button>
              </div>
            )}
          </div>

          {/* Sample Prompts */}
          {!parsedResult && !isLoading && (
            <div>
              <span className="text-[11px] text-[#78716C] block mb-1">Quick examples:</span>
              <div className="flex flex-wrap gap-1.5">
                {sampleVoicePrompts.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setTranscript(prompt);
                      handleParseWithGemini(prompt);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#E5DFD4]"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced AI Loader UX */}
          {isLoading && (
            <div className="p-4 rounded-2xl bg-linear-to-b from-[#FAF7F2] to-[#EFEAE1]/70 dark:from-[#1E1A16] dark:to-[#171412] border border-[#DCD5C9] dark:border-[#3D362F] shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
              {/* Header with animated neural equalizer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#B85D43]/15 text-[#B85D43] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] block leading-tight">
                      Processing Expense
                    </span>
                    <span className="text-[10px] text-[#78716C] dark:text-[#A8A29E] font-medium">
                      Interpreting financial intent
                    </span>
                  </div>
                </div>

                {/* Animated Audio / Neural Equalizer Bars */}
                <div className="flex items-end gap-1 h-5 px-2 py-1 rounded-full bg-black/5 dark:bg-white/5">
                  <span className="w-1 bg-[#B85D43] rounded-full animate-[pulse_0.7s_infinite] h-2.5" />
                  <span className="w-1 bg-[#486B88] rounded-full animate-[pulse_0.5s_infinite] h-4" />
                  <span className="w-1 bg-[#4E785E] rounded-full animate-[pulse_0.9s_infinite] h-5" />
                  <span className="w-1 bg-[#AF7832] rounded-full animate-[pulse_0.6s_infinite] h-3.5" />
                  <span className="w-1 bg-[#B85D43] rounded-full animate-[pulse_0.8s_infinite] h-2" />
                </div>
              </div>

              {/* Progress Steps Timeline */}
              <div className="grid grid-cols-3 gap-2 py-1">
                <div
                  className={`flex flex-col gap-1 p-2 rounded-xl text-[10px] transition-all ${
                    loadingStage === 'transcribing'
                      ? 'bg-[#EBF2ED] text-[#2C523B] dark:bg-[#1E2E24] dark:text-[#A8D1B7] font-semibold ring-1 ring-[#CADBCE]'
                      : 'bg-black/5 dark:bg-white/5 text-[#78716C]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {loadingStage !== 'transcribing' ? (
                      <Check className="w-3 h-3 text-[#4E785E]" />
                    ) : (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    )}
                    <span>1. Speech</span>
                  </div>
                  <span className="text-[9px] truncate">Phonetics</span>
                </div>

                <div
                  className={`flex flex-col gap-1 p-2 rounded-xl text-[10px] transition-all ${
                    loadingStage === 'querying'
                      ? 'bg-[#EBF2ED] text-[#2C523B] dark:bg-[#1E2E24] dark:text-[#A8D1B7] font-semibold ring-1 ring-[#CADBCE]'
                      : loadingStage === 'structuring'
                      ? 'bg-black/5 dark:bg-white/5 text-[#78716C]'
                      : 'bg-black/5 dark:bg-white/5 text-[#78716C] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {loadingStage === 'structuring' ? (
                      <Check className="w-3 h-3 text-[#4E785E]" />
                    ) : loadingStage === 'querying' ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Cpu className="w-3 h-3" />
                    )}
                    <span>2. AI Parse</span>
                  </div>
                  <span className="text-[9px] truncate">API Reasoning</span>
                </div>

                <div
                  className={`flex flex-col gap-1 p-2 rounded-xl text-[10px] transition-all ${
                    loadingStage === 'structuring'
                      ? 'bg-[#EBF2ED] text-[#2C523B] dark:bg-[#1E2E24] dark:text-[#A8D1B7] font-semibold ring-1 ring-[#CADBCE]'
                      : 'bg-black/5 dark:bg-white/5 text-[#78716C] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {loadingStage === 'structuring' ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Layers className="w-3 h-3" />
                    )}
                    <span>3. Envelopes</span>
                  </div>
                  <span className="text-[9px] truncate">Ledger Check</span>
                </div>
              </div>

              {/* Shimmering Intent Skeleton Preview Card */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-black/20 border border-black/5 dark:border-white/5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 bg-[#DCD5C9]/60 dark:bg-[#3D362F]/60 rounded-full animate-pulse" />
                  <div className="h-4 w-16 bg-[#DCD5C9]/50 dark:bg-[#3D362F]/50 rounded-md animate-pulse" />
                </div>
                <div className="h-3 w-4/5 bg-[#DCD5C9]/40 dark:bg-[#3D362F]/40 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-[#FAF7F2] dark:bg-[#1A1714] flex flex-col gap-1">
                    <div className="h-2 w-10 bg-[#DCD5C9]/50 dark:bg-[#3D362F]/50 rounded" />
                    <div className="h-4 w-16 bg-[#DCD5C9]/80 dark:bg-[#3D362F]/80 rounded animate-pulse" />
                  </div>
                  <div className="p-2 rounded-lg bg-[#FAF7F2] dark:bg-[#1A1714] flex flex-col gap-1">
                    <div className="h-2 w-12 bg-[#DCD5C9]/50 dark:bg-[#3D362F]/50 rounded" />
                    <div className="h-4 w-20 bg-[#DCD5C9]/80 dark:bg-[#3D362F]/80 rounded animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Cancel Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleCancelParse}
                  className="text-[11px] text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
                >
                  Cancel request
                </button>
              </div>
            </div>
          )}

          {/* Error with Retry */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#F9ECE8] dark:bg-[#331D16] border border-[#E8C5BC] text-xs text-[#87341D] dark:text-[#F3B3A2] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {transcript && (
                <button
                  type="button"
                  onClick={() => handleParseWithGemini(transcript)}
                  className="px-2.5 py-1 rounded-lg bg-[#B85D43] text-white text-[11px] font-medium shrink-0 hover:bg-[#A04E36] transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {/* Parsed Result & Mandatory Confirm Screen (§4.9) */}
          {parsedResult && (
            <div className="p-4 rounded-xl bg-[#EBF2ED] dark:bg-[#1E2E24] border border-[#CADBCE] dark:border-[#2C4A36] flex flex-col gap-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2C523B] dark:text-[#A8D1B7]">
                  Parsed Intent Confirmation (§4.9)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/30 font-medium text-[#2C523B] dark:text-[#A8D1B7] flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-[#B85D43]" />
                    {parsedModelUsed === 'gemini-3.1-flash-lite' ? 'Gemini Flash Lite' : (parsedModelUsed || 'Gemini Flash Lite')}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/30 font-medium">
                    {parsedResult.intent.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
                {parsedResult.summaryExplanation}
              </div>

              {parsedResult.intent === 'add_transaction' && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-white/60 dark:bg-black/20 p-2.5 rounded-lg">
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Amount:</span>
                    <strong className="font-amount font-semibold text-sm">
                      {formatPaise(parsedResult.amountInPaise)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Envelope:</span>
                    <strong className="font-medium truncate block">
                      {parsedResult.categoryName || 'General'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Method:</span>
                    <span className="capitalize">{parsedResult.paymentMethod?.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Note:</span>
                    <span className="truncate block">{parsedResult.note || 'None'}</span>
                  </div>
                </div>
              )}

              {parsedResult.intent === 'move_funds' && (
                <div className="grid grid-cols-2 gap-2 text-xs bg-white/60 dark:bg-black/20 p-2.5 rounded-lg">
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Amount:</span>
                    <strong className="font-amount font-semibold text-sm text-[#486B88]">
                      {formatPaise(parsedResult.amountInPaise)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">Action:</span>
                    <strong className="font-medium truncate block text-[#486B88]">
                      Move Envelope Funds
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">From Envelope:</span>
                    <strong className="truncate block">{parsedResult.fromCategoryName || 'Source'}</strong>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px]">To Envelope:</span>
                    <strong className="truncate block">{parsedResult.toCategoryName || 'Destination'}</strong>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#2C523B] dark:text-[#A8D1B7]">
                Requires confirmation before writing to ledger.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setParsedResult(null)}
                  className="flex-1 py-2 rounded-xl border border-[#CADBCE] text-xs font-medium text-[#78716C]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIntent}
                  id="confirm-voice-intent-btn"
                  className="flex-1 py-2 rounded-xl bg-[#2C523B] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Save</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
