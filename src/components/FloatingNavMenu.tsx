import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  ArrowLeftRight,
  Landmark,
  Plus,
  X,
  PlusCircle,
  Menu,
  ChevronRight,
  ShieldCheck,
  Mic,
  BookOpen,
  User,
  Download,
  Smartphone,
} from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise } from '../utils/currency';

interface FloatingNavMenuProps {
  onOpenLogSpend: () => void;
  onOpenVoiceModal: () => void;
  onOpenReconcileModal: () => void;
  onOpenMoveFundsModal: () => void;
  onOpenSalaryModal: () => void;
  onOpenAddFundsModal: () => void;
  onOpenProfileModal?: () => void;
  onOpenTour?: () => void;
  onOpenInstallModal?: () => void;
}

export const FloatingNavMenu: React.FC<FloatingNavMenuProps> = ({
  onOpenLogSpend,
  onOpenVoiceModal,
  onOpenReconcileModal,
  onOpenMoveFundsModal,
  onOpenSalaryModal,
  onOpenAddFundsModal,
  onOpenProfileModal,
  onOpenTour,
  onOpenInstallModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { totalPendingPaybackPaise, activeMember } = useBudget();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (actionFn: () => void) => {
    setIsOpen(false);
    actionFn();
  };

  return (
    <div ref={menuRef} className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Action Menu Panel */}
      {isOpen && (
        <div
          id="floating-nav-panel"
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[320px] max-w-[calc(100vw-2rem)] bg-[#FAF7F2] dark:bg-[#1F1B16] border border-[#DCD5C9] dark:border-[#3D362F] rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-bottom-5 duration-150 backdrop-blur-md"
        >
          {/* Header of floating menu */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E8E3DA] dark:border-[#2D2823] px-1">
            <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-1.5">
              <span>Quick Actions & Views</span>
            </span>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-col gap-1 mb-3">
            <button
              onClick={() => handleAction(onOpenLogSpend)}
              id="floating-action-log-spend"
              className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-sm sm:text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#FAF7F2] dark:text-[#1A1714]" />
                <span>Log Spend (Under 5s)</span>
              </div>
              <span className="text-[10px] opacity-75 font-mono">⚡ 1-Handed</span>
            </button>

            <button
              onClick={() => handleAction(onOpenMoveFundsModal)}
              id="floating-action-move-funds"
              className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-sm sm:text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#486B88]" />
                <span>Move Funds Between Envelopes</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
            </button>

            <button
              onClick={() => handleAction(onOpenSalaryModal)}
              id="floating-action-salary-arrived"
              className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-sm sm:text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Landmark className="w-3.5 h-3.5 text-[#4E785E]" />
                <span>Salary Arrived Flow</span>
              </div>
              <span className="text-[10px] text-[#4E785E] font-medium">Allocate</span>
            </button>

            <button
              onClick={() => handleAction(onOpenReconcileModal)}
              id="floating-action-reconcile"
              className={`w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border text-sm sm:text-xs font-medium transition-colors cursor-pointer ${
                totalPendingPaybackPaise > 0
                  ? 'bg-[#F9ECE8] dark:bg-[#331D16] text-[#87341D] dark:text-[#F3B3A2] border-[#E8C5BC] dark:border-[#5E261B]'
                  : 'border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1]'
              }`}
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#87341D] dark:text-[#F3B3A2]" />
                <span>Reconcile Cards</span>
              </div>
              {totalPendingPaybackPaise > 0 ? (
                <span className="text-[11px] font-amount font-bold text-[#87341D] dark:text-[#F3B3A2]">
                  {formatPaise(totalPendingPaybackPaise)}
                </span>
              ) : (
                <span className="text-[10px] text-[#4E785E] flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> Settled
                </span>
              )}
            </button>

            <button
              onClick={() => handleAction(onOpenAddFundsModal)}
              id="floating-action-add-funds"
              className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-sm sm:text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="w-3.5 h-3.5 text-[#2C523B]" />
                <span>Direct Envelope Top-Up</span>
              </div>
              <span className="text-[10px] text-[#78716C]">Non-salary</span>
            </button>

            {onOpenProfileModal && (
              <button
                onClick={() => handleAction(onOpenProfileModal)}
                id="floating-action-profile"
                className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-sm sm:text-xs font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {activeMember.avatar_url ? (
                    <img
                      src={activeMember.avatar_url}
                      alt={activeMember.name}
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: activeMember.avatar_color }}
                      className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                    >
                      {activeMember.name.charAt(0)}
                    </div>
                  )}
                  <span>Profile ({activeMember.name})</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
              </button>
            )}

            {onOpenTour && (
              <button
                onClick={() => handleAction(onOpenTour)}
                id="floating-action-guide"
                className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#78716C] dark:text-[#A8A29E] text-sm sm:text-xs font-medium transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#B85D43]" />
                  <span>Interactive Guide & Rules</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#78716C]" />
              </button>
            )}

            {onOpenInstallModal && (
              <button
                onClick={() => handleAction(onOpenInstallModal)}
                id="floating-action-install-pwa"
                className="w-full flex items-center justify-between px-3 py-2.5 min-h-11 rounded-xl border border-[#4E785E]/30 bg-[#4E785E]/10 hover:bg-[#4E785E]/20 text-[#2C523B] dark:text-[#A8D1B7] text-sm sm:text-xs font-semibold transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-[#4E785E]" />
                  <span>Install Web App (PWA)</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#4E785E]/20 text-[#4E785E]">
                  Offline
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Trigger Buttons: Dedicated Speak Button + Menu FAB */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenVoiceModal}
          id="fab-voice-btn"
          aria-label="Speak Expense with Voice AI"
          title="Speak Expense"
          className="h-11 px-3.5 sm:px-4 rounded-full shadow-lg flex items-center gap-2 bg-[#B85D43] text-white hover:bg-[#A34E36] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-[#E8C5BC]/30 group"
        >
          <Mic className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold tracking-wide">Speak</span>
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          id="fab-floating-menu"
          aria-label="Floating Action Menu"
          title={isOpen ? 'Close Menu' : 'Open Actions & Navigation'}
          className={`h-11 w-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer border ${
            isOpen
              ? 'bg-[#B85D43] text-white border-transparent rotate-90 scale-95'
              : 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] border-black/10 hover:scale-105 active:scale-95'
          }`}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
