import React from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { formatPaise } from '../utils/currency';
import { getCloudSyncBadgeStatus } from '../utils/syncDisplay';
import { ActiveTab } from '../types';
import {
  User,
  Users,
  Bell,
  Plus,
  RefreshCw,
  Landmark,
  ShieldCheck,
  ArrowLeftRight,
  Cloud,
  Layers,
  FileText,
  FolderKanban,
  Settings
} from 'lucide-react';

interface HeaderProps {
  onOpenSalaryModal: () => void;
  onOpenReconcileModal: () => void;
  onOpenMoveFundsModal: () => void;
  onOpenVoiceModal?: () => void;
  onOpenInviteModal?: () => void;
  onOpenNotificationModal: () => void;
  onOpenCloudSyncModal?: () => void;
  onOpenProfileModal: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
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
    totalPendingPaybackPaise,
    cloudSyncStatus,
    cloudSetupStatus,
    lastCloudSync,
  } = useBudget();
  const cloudSyncBadgeStatus = getCloudSyncBadgeStatus(cloudSyncStatus, lastCloudSync, cloudSetupStatus);

  const rawHouseholdName = (household?.name || '').trim();
  const cleanHouseholdName =
    !rawHouseholdName ||
    /preview/i.test(rawHouseholdName) ||
    rawHouseholdName === 'Our Household Ledger' ||
    rawHouseholdName.toLowerCase() === 'preview ledger'
      ? 'Family Budget'
      : rawHouseholdName;

  const handleOpenSync = () => {
    setActiveTab('sync');
  };

  const handleOpenInvite = () => {
    setActiveTab('invite');
  };

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 dark:bg-[#1A1714]/95 backdrop-blur-md border-b border-[#E8E3DA] dark:border-[#2D2823] px-3 sm:px-4 py-2 sm:py-2.5">
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        {/* Row 1: Brand & Household Name (Left) + Cloud Status, Profile & Notifications (Right) */}
        <div className="flex items-center justify-between gap-2">
          {/* Brand & Household Name - tapping navigates to envelopes */}
          <div
            onClick={() => setActiveTab('envelopes')}
            id="brand-home-link"
            className="flex items-center gap-2 min-w-0 cursor-pointer group"
            title="Envelope Budgeting - Go to Envelopes"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105">
              <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-[#1F1B16] dark:text-[#EDE8E1] leading-tight truncate">
                Envelope Budgeting
              </h1>
              <p className="text-[10px] sm:text-[11px] text-[#78716C] dark:text-[#A8A29E] font-medium truncate">
                {cleanHouseholdName}
              </p>
            </div>
          </div>

          {/* Right Utilities: Cloud Sync Screen Button, Profile & Notification */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cloud Sync Screen Trigger */}
            <button
              onClick={handleOpenSync}
              id="cloud-sync-status-btn"
              title={user ? `Signed in as ${user.displayName || user.email} — open cloud sync` : 'Connect Cloud & Google Sign-In'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors cursor-pointer ${
                activeTab === 'sync'
                  ? 'border-[#486B88] bg-[#486B88] text-white font-semibold shadow-xs'
                  : 'border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]'
              }`}
            >
              {cloudSyncBadgeStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-[#486B88] animate-spin" />
              ) : user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google Account'}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <Cloud className={`w-3.5 h-3.5 ${cloudSyncBadgeStatus === 'synced' ? 'text-[#4E785E]' : 'text-[#486B88]'}`} />
              )}
              <span className="hidden sm:inline font-medium text-[11px]">
                {cloudSyncBadgeStatus === 'syncing'
                  ? 'Syncing...'
                  : user
                  ? user.displayName?.split(' ')[0] || 'Sync'
                  : 'Cloud'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cloudSyncBadgeStatus === 'synced'
                    ? 'bg-[#4E785E]'
                    : cloudSyncBadgeStatus === 'syncing'
                    ? 'bg-[#486B88] animate-ping'
                    : cloudSyncBadgeStatus === 'not_synced'
                    ? 'bg-[#486B88]'
                    : 'bg-[#AF7832]'
                }`}
              />
            </button>

            {/* Daily Reminder Settings (§4.5) */}
            <button
              onClick={onOpenNotificationModal}
              id="reminder-settings-btn"
              title="Daily Payback Reminder"
              className="p-1.5 rounded-full border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] transition-colors relative cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              {totalPendingPaybackPaise > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B85D43] ring-2 ring-[#FAF7F2] dark:ring-[#1A1714]" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: View Navigation ANCHORED ON THE LEFT + Month Picker on the right */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 pt-1 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60">
          {/* ON THE LEFT: Primary View Switcher (Envelopes vs Ledger) + First-Class Screens */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-x-auto scrollbar-none py-0.5">
            {/* Primary Segmented Switcher: Envelopes & Ledger (High-prominence UX) */}
            <div className="flex items-center p-0.5 bg-[#E8E3DA]/80 dark:bg-[#25201A] rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] shrink-0 shadow-2xs">
              <button
                onClick={() => setActiveTab('envelopes')}
                id="tab-envelopes"
                title="Envelope Balances & Monthly Allocations"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'envelopes'
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Envelopes</span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                id="tab-ledger"
                title="Transaction History, Filters & Card Reconciliations"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ledger</span>
              </button>
            </div>

            {/* Secondary Screen Tabs: Manage, Sync, Invite, Settings */}
            <nav className="flex items-center gap-0.5 text-xs shrink-0 pl-1 border-l border-[#E8E3DA]/80 dark:border-[#2D2823]/80">
              <button
                onClick={() => setActiveTab('categories')}
                id="tab-categories"
                title="Manage Envelopes & Target Budgets"
                className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap text-xs flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'categories'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 text-[#AF7832]" />
                <span className="hidden sm:inline">Manage</span>
              </button>

              <button
                onClick={() => setActiveTab('sync')}
                id="tab-sync-screen"
                title="Cloud & Multi-Device Synchronization Screen"
                className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap text-xs flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'sync'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <Cloud className="w-3.5 h-3.5 text-[#486B88]" />
                <span>Sync</span>
              </button>

              <button
                onClick={() => setActiveTab('invite')}
                id="tab-invite-screen"
                title="Members & Household Requests"
                className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap text-xs flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'invite'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-[#4E785E]" />
                <span>Members</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                id="tab-settings"
                title="Household & Notification Settings"
                className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap text-xs flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                    : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-[#78716C]" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </nav>
          </div>

          {/* ON THE RIGHT: Quick Card Payback Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            {totalPendingPaybackPaise > 0 ? (
              <button
                onClick={onOpenReconcileModal}
                id="pending-payback-btn"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#F9ECE8] dark:bg-[#331D16] text-[#87341D] dark:text-[#F3B3A2] border border-[#E8C5BC] dark:border-[#4D281E] hover:bg-[#F3DDD7] transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Owed: <strong className="font-amount font-semibold">{formatPaise(totalPendingPaybackPaise)}</strong></span>
              </button>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#4E785E] dark:text-[#A8D1B7] shrink-0 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Card Bills Settled</span>
                <span className="sm:hidden">Settled</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

