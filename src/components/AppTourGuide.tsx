import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Wallet,
  RefreshCw,
  Landmark,
  Mic,
  Menu,
  CheckCircle2,
  BookOpen,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

export interface TourCardInfo {
  id: string;
  tabLabel: string;
  title: string;
  badge: string;
  icon: React.ElementType;
  iconColor: string;
  description: string;
  nomenclature: {
    term: string;
    definition: string;
  }[];
  tip?: string;
}

export const TOUR_CARDS: TourCardInfo[] = [
  {
    id: 'three-accounts',
    tabLabel: '3-Account System',
    title: 'The 3-Account Envelope System',
    badge: 'Core Philosophy',
    icon: Landmark,
    iconColor: '#4E785E',
    description:
      'This system keeps your household budget crystal clear and disciplines daily spending without relying on bank balance guesswork.',
    nomenclature: [
      {
        term: 'Primary Salary Account',
        definition: 'Where your paycheck lands. Funds stay secure here until allocated or used to clear credit card bills.',
      },
      {
        term: 'Spend Account',
        definition: 'Your dedicated day-to-day spending bank account (UPI & Debit). Only allocated envelope money goes here.',
      },
      {
        term: 'Envelopes (Categories)',
        definition: 'Virtual budget buckets (Groceries, Dining, Fuel). All spending immediately deducts from an envelope.',
      },
    ],
    tip: 'Rule of thumb: Never keep impulse money in your Salary Account!',
  },
  {
    id: 'envelopes-balances',
    tabLabel: 'Envelopes & Balances',
    title: 'Envelopes & Available Balance',
    badge: 'Safe-To-Spend',
    icon: Wallet,
    iconColor: '#AF7832',
    description:
      'Each envelope represents real money available right now in your Spend Account. Spend with confidence knowing you are never touching savings.',
    nomenclature: [
      {
        term: 'Available Now',
        definition: 'The live balance in that specific envelope. Decreases the second a transaction is logged.',
      },
      {
        term: 'Move Funds',
        definition: 'Need to cover an overspend? Transfer money between envelopes instantly without any bank transfers.',
      },
    ],
    tip: 'Tap on any envelope card to inspect its transaction history, top up funds, or log quick spending.',
  },
  {
    id: 'credit-card-reconciliation',
    tabLabel: 'Card Payback',
    title: 'Credit Card Payback (Reconciliation)',
    badge: 'Zero-Debt Loop',
    icon: RefreshCw,
    iconColor: '#B85D43',
    description:
      'Use credit cards for rewards without accumulating hidden debt. The system reserves your envelope funds so you always pay in full.',
    nomenclature: [
      {
        term: 'Pending Payback',
        definition: 'Card purchases immediately deduct from your envelope, and that amount is earmarked here as pending debt.',
      },
      {
        term: 'Payback Settlement',
        definition: 'When your card bill arrives, transfer this exact amount from Spend A/c → Salary A/c and click Reconcile.',
      },
    ],
    tip: 'Your envelope budget is safe: money was already deducted when you tapped the card!',
  },
  {
    id: 'bank-transfers',
    tabLabel: 'Bank Transfers',
    title: 'Bank Transfers to Spend Account',
    badge: 'Banking Sync',
    icon: Landmark,
    iconColor: '#7A4E15',
    description:
      'Whenever salary arrives or you deposit funds into envelopes, this checklist tracks the physical bank transfers you need to execute in your banking app.',
    nomenclature: [
      {
        term: 'Salary Allocation',
        definition: 'When your salary credit arrives, allocate planned amounts into your household envelopes.',
      },
      {
        term: 'Bank Transfer Checklist',
        definition: 'The to-do list for opening your banking app and transferring from Salary A/c into Spend A/c.',
      },
    ],
    tip: 'Once you execute the transfer in your bank app, check it off here to keep your records spotless.',
  },
  {
    id: 'quick-logging-voice',
    tabLabel: 'Voice & Quick Spend',
    title: 'Log Spend in <5s & Voice AI',
    badge: 'Frictionless Logging',
    icon: Mic,
    iconColor: '#B85D43',
    description:
      'Logging must be fast so you never fall behind. Capture expenses in seconds right when they happen.',
    nomenclature: [
      {
        term: 'Speak Button (Voice AI)',
        definition: 'Tap Speak and say your expense naturally (e.g. "Paid 450 for Groceries via UPI"). Gemini AI parses it instantly.',
      },
      {
        term: '1-Handed Quick Spend',
        definition: 'Open Log Spend from any envelope or menu with optimized presets for UPI, Debit, Credit Card, and Cash.',
      },
    ],
    tip: 'Both household partners share the exact same ledger, updating live across devices.',
  },
  {
    id: 'quick-actions-menu',
    tabLabel: 'Quick Actions',
    title: 'Quick Actions & Replay Guide',
    badge: 'Navigation Hub',
    icon: Menu,
    iconColor: '#1F1B16',
    description:
      'Everything you need is thumb-accessible through the floating menu in the bottom-right corner.',
    nomenclature: [
      {
        term: 'Quick Actions Panel',
        definition: 'Access Move Funds, Salary Arrived, Card Reconciliation, and switch screens (Ledger, Categories, Settings).',
      },
      {
        term: 'Revisit Guide Anytime',
        definition: 'Need a refresher on terms or flows? Tap the floating menu and select "App Tour & Nomenclature" anytime!',
      },
    ],
    tip: 'You can also customize your avatar and invite your household partner in Settings.',
  },
];

interface AppTourGuideProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: 'envelopes' | 'ledger' | 'categories' | 'settings';
  setActiveTab?: (tab: 'envelopes' | 'ledger' | 'categories' | 'settings') => void;
  isFirstTime?: boolean;
  onCompleteFirstTime?: () => Promise<void> | void;
}

export const AppTourGuide: React.FC<AppTourGuideProps> = ({
  isOpen,
  onClose,
  isFirstTime = false,
  onCompleteFirstTime,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFinish();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex]);

  const handleNext = () => {
    if (currentIndex < TOUR_CARDS.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleFinish = async () => {
    if (isFirstTime && onCompleteFirstTime) {
      setIsResetting(true);
      try {
        await onCompleteFirstTime();
      } finally {
        setIsResetting(false);
      }
    } else {
      try {
        localStorage.setItem('env_budget_tour_completed', 'true');
      } catch (e) {
        console.error('Error saving tour preference:', e);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const card = TOUR_CARDS[currentIndex];
  const CardIcon = card.icon;

  return (
    <div
      id="guide-cards-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget && !isResetting) {
          handleFinish();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-card-title"
        className="w-full max-w-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header with Topic Navigation Pills */}
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#B85D43]/15 text-[#B85D43] flex items-center justify-center font-bold shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1F1B16] dark:text-[#EDE8E1] tracking-tight">
                  Envelope Budgeting Guide
                </span>
                <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E] ml-2">
                  Card {currentIndex + 1} of {TOUR_CARDS.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isFirstTime && (
                <span className="hidden sm:inline-block text-[10px] font-bold bg-[#B85D43]/15 text-[#B85D43] px-2 py-0.5 rounded-full">
                  First-Time Intro
                </span>
              )}
              <button
                onClick={handleFinish}
                disabled={isResetting}
                id="btn-close-guide"
                aria-label="Close guide"
                className="p-1.5 rounded-xl text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Tab Selector for Direct Jump */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {TOUR_CARDS.map((c, idx) => (
              <button
                key={c.id}
                onClick={() => setCurrentIndex(idx)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714]'
                    : 'bg-[#EFEAE1]/70 dark:bg-[#28221D]/70 text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                {c.tabLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Card Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
          {/* Badge & Title */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#B85D43] bg-[#B85D43]/10 px-2 py-0.5 rounded-md">
                {card.badge}
              </span>
            </div>
            <h3
              id="guide-card-title"
              className="text-lg sm:text-xl font-bold text-[#1F1B16] dark:text-[#EDE8E1] tracking-tight flex items-center gap-2"
            >
              <CardIcon className="w-5 h-5 text-[#B85D43] shrink-0" />
              <span>{card.title}</span>
            </h3>
            <p className="text-xs sm:text-sm text-[#59524B] dark:text-[#B5AEA5] mt-1.5 leading-relaxed">
              {card.description}
            </p>
          </div>

          {/* Key Nomenclature Definitions */}
          <div className="bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 border border-[#E8E3DA] dark:border-[#383129] rounded-2xl p-3.5 flex flex-col gap-2.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B85D43]" />
              Key Concepts & Nomenclature
            </span>
            <div className="grid grid-cols-1 gap-2">
              {card.nomenclature.map((item, i) => (
                <div
                  key={i}
                  className="text-xs bg-white/70 dark:bg-[#1E1A16]/70 border border-[#E8E3DA]/80 dark:border-[#332B24] rounded-xl p-2.5 leading-relaxed"
                >
                  <strong className="text-[#1F1B16] dark:text-[#EDE8E1] font-bold block mb-0.5">
                    {item.term}
                  </strong>
                  <span className="text-[#59524B] dark:text-[#B5AEA5]">
                    {item.definition}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro-Tip or First-Time Reset Notice */}
          {currentIndex === TOUR_CARDS.length - 1 && isFirstTime ? (
            <div className="flex items-start gap-2.5 text-xs text-[#B85D43] font-medium bg-[#B85D43]/10 dark:bg-[#B85D43]/20 p-3 rounded-xl border border-[#B85D43]/20">
              <RotateCcw className="w-4 h-4 shrink-0 text-[#B85D43] mt-0.5" />
              <div>
                <strong className="font-bold">First-Time Setup:</strong> Finishing or closing this guide resets the mock demonstration balances to ₹0 so you can start cleanly with your real household income.
              </div>
            </div>
          ) : card.tip ? (
            <div className="flex items-center gap-2 text-xs text-[#4E785E] dark:text-[#88BA99] font-medium bg-[#4E785E]/10 dark:bg-[#4E785E]/20 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{card.tip}</span>
            </div>
          ) : null}
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#F2EDE4]/50 dark:bg-[#141210]/50 border-t border-[#E8E3DA] dark:border-[#2D2823]">
          {/* Step Indicator Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_CARDS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentIndex
                    ? 'w-5 bg-[#B85D43]'
                    : 'w-1.5 bg-[#DCD5C9] dark:bg-[#3D362F] hover:bg-[#B85D43]/60'
                }`}
                aria-label={`Go to card ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {currentIndex > 0 ? (
              <button
                onClick={handlePrev}
                id="btn-prev-guide-card"
                className="px-3.5 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                onClick={handleFinish}
                id="btn-skip-guide"
                disabled={isResetting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{isFirstTime ? 'Skip to ₹0' : 'Close'}</span>
              </button>
            )}

            <button
              onClick={handleNext}
              id="btn-next-guide-card"
              disabled={isResetting}
              className="px-4 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>
                {isResetting
                  ? 'Resetting to ₹0...'
                  : currentIndex === TOUR_CARDS.length - 1
                  ? isFirstTime
                    ? 'Finish & Start Clean (₹0)'
                    : 'Got It!'
                  : 'Next Card'}
              </span>
              {currentIndex === TOUR_CARDS.length - 1 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#4E785E]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
