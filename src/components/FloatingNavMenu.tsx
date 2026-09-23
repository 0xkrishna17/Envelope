import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  FileText,
  FolderKanban,
  Settings,
  RefreshCw,
  ArrowLeftRight,
  Landmark,
  Plus,
  X,
  PlusCircle,
  Menu,
  ChevronRight,
  ShieldCheck,
  Check,
  Mic,
  BookOpen,
} from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise } from '../utils/currency';

interface FloatingNavMenuProps {
  activeTab: 'envelopes' | 'ledger' | 'categories' | 'settings';
  setActiveTab: (tab: 'envelopes' | 'ledger' | 'categories' | 'settings') => void;
  onOpenLogSpend: () => void;
  onOpenVoiceModal: () => void;
  onOpenReconcileModal: () => void;
  onOpenMoveFundsModal: () => void;
  onOpenSalaryModal: () => void;
  onOpenAddFundsModal: () => void;
  onOpenTour?: () => void;
  appVersion?: string;
}

export const FloatingNavMenu: React.FC<FloatingNavMenuProps> = ({
  activeTab,
  setActiveTab,
  onOpenLogSpend,
  onOpenVoiceModal,
  onOpenReconcileModal,
  onOpenMoveFundsModal,
  onOpenSalaryModal,
  onOpenAddFundsModal,
  onOpenTour,
  appVersion,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { totalPendingPaybackPaise } = useBudget();
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

  const handleSelectTab = (tab: 'envelopes' | 'ledger' | 'categories' | 'settings') => {
    setActiveTab(tab);
    setIsOpen(false);
  };

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
          className="mb-3 w-[290px] sm:w-[320px] max-w-[calc(100vw-2.5rem)] bg-[#FAF7F2] dark:bg-[#1F1B16] border border-[#DCD5C9] dark:border-[#3D362F] rounded-2xl shadow-2xl p-3 animate-in fade-in slide-in-from-bottom-5 duration-150 backdrop-blur-md"
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
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
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
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-xs font-medium transition-colors cursor-pointer"
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
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-xs font-medium transition-colors cursor-pointer"
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
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
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="w-3.5 h-3.5 text-[#2C523B]" />
                <span>Direct Envelope Top-Up</span>
              </div>
              <span className="text-[10px] text-[#78716C]">Non-salary</span>
            </button>
          </div>

          {/* Navigation Views Switcher */}
          <div className="pt-2 border-t border-[#E8E3DA] dark:border-[#2D2823]">
            <div className="text-[10px] uppercase font-semibold text-[#78716C] dark:text-[#A8A29E] px-1 mb-1.5 tracking-wider">
              Switch Screen
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleSelectTab('envelopes')}
                id="floating-nav-envelopes"
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  activeTab === 'envelopes'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#4E785E]" />
                  <span>Envelopes</span>
                </div>
                {activeTab === 'envelopes' && <Check className="w-3 h-3 text-[#4E785E]" />}
              </button>

              <button
                onClick={() => handleSelectTab('ledger')}
                id="floating-nav-ledger"
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  activeTab === 'ledger'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#486B88]" />
                  <span>Ledger</span>
                </div>
                {activeTab === 'ledger' && <Check className="w-3 h-3 text-[#486B88]" />}
              </button>

              <button
                onClick={() => handleSelectTab('categories')}
                id="floating-nav-categories"
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  activeTab === 'categories'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-[#AF7832]" />
                  <span>Manage</span>
                </div>
                {activeTab === 'categories' && <Check className="w-3 h-3 text-[#AF7832]" />}
              </button>

              <button
                onClick={() => handleSelectTab('settings')}
                id="floating-nav-settings"
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-[#78716C]" />
                  <span>Settings</span>
                </div>
                {activeTab === 'settings' && <Check className="w-3 h-3 text-[#78716C]" />}
              </button>

              {onOpenTour && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenTour();
                  }}
                  id="floating-nav-guide"
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714] transition-colors mt-0.5 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60 pt-1.5 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#B85D43]" />
                    <span>Guide & Concepts</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-[#78716C]" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger Buttons: Dedicated Speak Button (The only Speak module in the app) + Menu FAB */}
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

      {/* App Version at bottom right in small text */}
      {appVersion && (
        <span
          id="app-version-bottom-right"
          className="text-[10px] text-[#78716C]/70 dark:text-[#A8A29E]/70 font-mono select-none pointer-events-none mt-1 mr-1"
        >
          {appVersion}
        </span>
      )}
    </div>
  );
};
