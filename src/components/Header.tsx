import React from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { formatPaise } from '../utils/currency';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Bell,
  Plus,
  RefreshCw,
  Landmark,
  ShieldCheck,
  ArrowLeftRight,
  Cloud
} from 'lucide-react';

interface HeaderProps {
  onOpenSalaryModal: () => void;
  onOpenReconcileModal: () => void;
  onOpenMoveFundsModal: () => void;
  onOpenVoiceModal?: () => void;
  onOpenInviteModal: () => void;
  onOpenNotificationModal: () => void;
  onOpenCloudSyncModal: () => void;
  onOpenProfileModal: () => void;
  activeTab: 'envelopes' | 'ledger' | 'categories' | 'settings';
  setActiveTab: (tab: 'envelopes' | 'ledger' | 'categories' | 'settings') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSalaryModal,
  onOpenReconcileModal,
  onOpenMoveFundsModal,
  onOpenVoiceModal,
  onOpenInviteModal,
  onOpenNotificationModal,
  onOpenCloudSyncModal,
  onOpenProfileModal,
  activeTab,
  setActiveTab,
}) => {
  const { user } = useAuth();
  const {
    household,
    members,
    activeMember,
    setActiveMemberId,
    selectedMonth,
    setSelectedMonth,
    totalPendingPaybackPaise,
    cloudSyncStatus,
  } = useBudget();

  // Navigate months
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const formattedMonth = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 dark:bg-[#1A1714]/95 backdrop-blur-md border-b border-[#E8E3DA] dark:border-[#2D2823] px-3 sm:px-4 py-2 sm:py-2.5">
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        {/* Row 1: Brand & Household Name (Left) + Utility Icons (Right) */}
        <div className="flex items-center justify-between gap-2">
          {/* Brand & Household Name - tapping icon navigates to home (envelopes) screen */}
          <div
            onClick={() => setActiveTab('envelopes')}
            id="brand-home-link"
            className="flex items-center gap-2 min-w-0 cursor-pointer group"
            title="Go to Home / Envelopes"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
              <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#1F1B16] dark:text-[#EDE8E1] leading-tight truncate">
                Envelope Budgeting
              </h1>
              <p className="text-[10px] sm:text-[11px] text-[#78716C] dark:text-[#A8A29E] font-medium truncate">
                {household.name}
              </p>
            </div>
          </div>

          {/* Right Utilities: Cloud Sync, Voice & Notifications */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cloud Sync & Google Auth Trigger */}
            <button
              onClick={onOpenCloudSyncModal}
              id="cloud-sync-status-btn"
              title={user ? `Signed in as ${user.displayName || user.email} (Firebase Firestore Synced)` : 'Connect Cloud & Google Sign-In'}
              className="flex items-center gap-1 px-2 py-1 rounded-full border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs transition-colors cursor-pointer"
            >
              {cloudSyncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-[#486B88] animate-spin" />
              ) : user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google Account'}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <Cloud className={`w-3.5 h-3.5 ${cloudSyncStatus === 'synced' ? 'text-[#4E785E]' : 'text-[#486B88]'}`} />
              )}
              <span className="hidden md:inline font-medium text-[11px]">
                {cloudSyncStatus === 'syncing'
                  ? 'Syncing...'
                  : user
                  ? user.displayName?.split(' ')[0] || 'Sync'
                  : 'Cloud'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cloudSyncStatus === 'synced'
                    ? 'bg-[#4E785E]'
                    : cloudSyncStatus === 'syncing'
                    ? 'bg-[#486B88] animate-ping'
                    : 'bg-[#AF7832]'
                }`}
              />
            </button>

            {/* Member Profile & Photo Trigger */}
            <button
              onClick={onOpenProfileModal}
              id="header-profile-btn"
              title={`Profile: ${activeMember.name} (${activeMember.role}) - Tap to update photo & name`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs transition-colors cursor-pointer shrink-0"
            >
              {activeMember.avatar_url ? (
                <img
                  src={activeMember.avatar_url}
                  alt={activeMember.name}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <span
                  style={{ backgroundColor: activeMember.avatar_color }}
                  className="w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none shrink-0"
                >
                  {activeMember.name.charAt(0)}
                </span>
              )}
              <span className="font-medium text-[11px] max-w-[65px] sm:max-w-[90px] truncate">
                {activeMember.name}
              </span>
            </button>

            {/* Daily Reminder Settings (§4.5) */}
            <button
              onClick={onOpenNotificationModal}
              id="reminder-settings-btn"
              title="Daily Payback Reminder"
              className="p-1.5 rounded-full border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] transition-colors relative"
            >
              <Bell className="w-3.5 h-3.5" />
              {totalPendingPaybackPaise > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B85D43] ring-2 ring-[#FAF7F2] dark:ring-[#1A1714]" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Month Picker (Left) + View Navigation Tabs & Quick Status (Right) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60">
          {/* Month Selector (§4.6: changes ONLY this month's stats, never Available Now) */}
          <div className="flex items-center gap-0.5 bg-[#EFEAE1]/70 dark:bg-[#28221D]/70 px-1.5 py-0.5 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] shrink-0">
            <button
              onClick={handlePrevMonth}
              id="prev-month-btn"
              className="p-1 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] sm:text-xs font-semibold px-1 min-w-[95px] sm:min-w-[110px] text-center text-[#1F1B16] dark:text-[#EDE8E1] truncate">
              {formattedMonth}
            </span>
            <button
              onClick={handleNextMonth}
              id="next-month-btn"
              className="p-1 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Navigation Tabs (and Desktop Action Badges) */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none">
            <nav className="flex items-center gap-1 text-xs font-medium shrink-0">
              <button
                onClick={() => setActiveTab('envelopes')}
                id="tab-envelopes"
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap text-xs ${
                  activeTab === 'envelopes'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                Envelopes
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                id="tab-ledger"
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap text-xs ${
                  activeTab === 'ledger'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                Ledger
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                id="tab-categories"
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap text-xs ${
                  activeTab === 'categories'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                Manage
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                id="tab-settings"
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap text-xs ${
                  activeTab === 'settings'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                Settings
              </button>
            </nav>

            {/* Desktop quick badge for card owed */}
            {totalPendingPaybackPaise > 0 ? (
              <button
                onClick={onOpenReconcileModal}
                id="pending-payback-btn"
                className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-[#F9ECE8] dark:bg-[#331D16] text-[#87341D] dark:text-[#F3B3A2] border border-[#E8C5BC] dark:border-[#4D281E] hover:bg-[#F3DDD7] transition-all shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Owed: <strong className="font-amount font-semibold">{formatPaise(totalPendingPaybackPaise)}</strong></span>
              </button>
            ) : (
              <span className="hidden lg:flex items-center gap-1 px-2 py-0.5 text-[11px] text-[#4E785E] dark:text-[#A8D1B7] shrink-0">
                <ShieldCheck className="w-3 h-3" />
                <span>Settled</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
