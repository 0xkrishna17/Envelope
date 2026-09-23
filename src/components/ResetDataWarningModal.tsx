import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, X, Check, Loader2 } from 'lucide-react';

interface ResetDataWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  confirmText?: string;
  bulletPoints?: string[];
  isZeroReset?: boolean;
}

export const ResetDataWarningModal: React.FC<ResetDataWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Reset All Ledger Data?',
  description = 'This will permanently revert all envelopes, recorded transactions, salary arrivals, and payback reconciliations back to the initial sample dataset.',
  confirmText = 'Yes, Reset Everything',
  bulletPoints = [
    'All custom envelopes and target budgets will reset to default',
    'All newly logged expenses and correction notes will be removed',
    'Pending credit card paybacks will return to initial demo balances',
    'Both local browser storage and cloud database will be reinitialized',
  ],
  isZeroReset = false,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsResetting(true);
    try {
      await onConfirm();
      setIsDone(true);
      setTimeout(() => {
        setIsResetting(false);
        setIsDone(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to reset data:', err);
      setIsResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget && !isResetting) onClose();
      }}
    >
      <div
        id="modal-reset-data-warning"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-warning-title"
        className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isZeroReset
                ? 'bg-[#B85D43]/15 text-[#B85D43]'
                : 'bg-[#FEE2E2] dark:bg-[#451A1A] text-[#DC2626] dark:text-[#F87171]'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="reset-warning-title"
                className="text-base font-bold text-[#1F1B16] dark:text-[#EDE8E1]"
              >
                {title}
              </h2>
              <span className={`text-xs font-semibold ${
                isZeroReset ? 'text-[#B85D43]' : 'text-[#DC2626] dark:text-[#F87171]'
              }`}>
                {isZeroReset ? 'Clean Slate Action' : 'Irreversible Action'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isResetting}
            id="btn-close-reset-warning"
            aria-label="Close"
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-[#1F1B16] dark:text-[#EDE8E1] leading-relaxed">
            {description}
          </p>

          <div className={`border rounded-xl p-3.5 flex flex-col gap-2 ${
            isZeroReset
              ? 'bg-[#FDF9F3] dark:bg-[#251E19] border-[#EAD5C5] dark:border-[#523A2C]'
              : 'bg-[#FFF5F5] dark:bg-[#2A1515] border-[#FCA5A5]/40 dark:border-[#7F1D1D]/50'
          }`}>
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${
              isZeroReset
                ? 'text-[#8A3F28] dark:text-[#F0B3A1]'
                : 'text-[#991B1B] dark:text-[#FCA5A5]'
            }`}>
              <span>What will happen:</span>
            </span>
            <ul className={`text-xs space-y-1.5 list-disc list-inside ${
              isZeroReset
                ? 'text-[#8A3F28]/90 dark:text-[#F0B3A1]/90'
                : 'text-[#7F1D1D] dark:text-[#FCA5A5]/90'
            }`}>
              {bulletPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] italic">
            {isZeroReset
              ? 'Your categories and household setup remain preserved so you can immediately begin budgeting your real income.'
              : 'Tip: You can use this whenever you want to test the workflow fresh or explore demonstration entries.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 bg-[#F2EDE4]/50 dark:bg-[#141210]/50 border-t border-[#E8E3DA] dark:border-[#2D2823]">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            id="btn-cancel-reset"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isResetting || isDone}
            id="btn-confirm-reset-everything"
            className={`px-4 py-2 rounded-xl active:scale-[0.98] text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
              isZeroReset
                ? 'bg-[#B85D43] hover:bg-[#A04D35]'
                : 'bg-[#DC2626] hover:bg-[#B91C1C]'
            }`}
          >
            {isResetting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Resetting...</span>
              </>
            ) : isDone ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Done!</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
