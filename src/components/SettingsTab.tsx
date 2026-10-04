import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../App';
import { HouseholdAccessManager } from './HouseholdAccessManager';
import { Users, Bell, Mic, RefreshCw, Shield, Database, Sparkles, CheckCircle2, Cloud, User, Camera, RotateCcw, AlertTriangle, BookOpen, Download, Smartphone } from 'lucide-react';
import { ResetDataWarningModal } from './ResetDataWarningModal';
import { getCloudSyncBadgeStatus } from '../utils/syncDisplay';

interface SettingsTabProps {
  onOpenInviteModal: () => void;
  onOpenNotificationModal: () => void;
  onOpenVoiceModal: () => void;
  onOpenCloudSyncModal: () => void;
  onOpenProfileModal: () => void;
  onInstallPwa: () => Promise<void> | void;
  isPwaInstalled: boolean;
  onOpenTour?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  onOpenInviteModal,
  onOpenNotificationModal,
  onOpenVoiceModal,
  onOpenCloudSyncModal,
  onOpenProfileModal,
  onInstallPwa,
  isPwaInstalled,
  onOpenTour,
}) => {
  const { user } = useAuth();
  const [isResetZeroModalOpen, setIsResetZeroModalOpen] = useState(false);
  const {
    household,
    members,
    activeMember,
    pushSettings,
    resetLedgerToZero,
    cloudSyncStatus,
    cloudSetupStatus,
    lastCloudSync,
  } = useBudget();
  const cloudSyncBadgeStatus = getCloudSyncBadgeStatus(cloudSyncStatus, lastCloudSync, cloudSetupStatus);
  const shouldShowNotificationSettings = false;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in pb-28 sm:pb-20">
      {/* Household & User Profile Card */}
      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3">
            {activeMember.avatar_url ? (
              <img
                src={activeMember.avatar_url}
                alt={activeMember.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover border border-[#DCD5C9] dark:border-[#3D362F] shadow-xs"
              />
            ) : (
              <div
                style={{ backgroundColor: activeMember.avatar_color }}
                className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow-xs"
              >
                {activeMember.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-2">
                <span>{activeMember.name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] text-[#78716C] dark:text-[#A8A29E] font-medium capitalize">
                  {activeMember.role}
                </span>
              </h2>
              <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Shared ledger: <strong>{household.name}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap w-full sm:w-auto">
            <button
              onClick={onOpenProfileModal}
              id="settings-edit-profile-btn"
              className="min-h-11 px-3 py-2.5 sm:py-1.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-sm sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#4E785E]" />
              <span>Edit Profile & Photo</span>
            </button>
            <button
              onClick={onOpenInviteModal}
              id="settings-invite-partner-btn"
              className="min-h-11 px-3 py-2.5 sm:py-1.5 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-sm sm:text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Members
            </button>
          </div>
        </div>

        <p className="text-xs text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
          Both partners share this exact ledger. Spending is tagged to an envelope and deducted immediately, while card debt is marked pending until paid back from Spend to Salary account (§1 & §3).
        </p>

        {/* Members Roster & Management */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-3 border-t border-[#E8E3DA]/80 dark:border-[#2D2823]/80">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#78716C] dark:text-[#A8A29E] font-medium">
              Members ({members.length}):
            </span>
            {members.map(m => (
              <span
                key={m.user_id}
                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] border border-[#DCD5C9] dark:border-[#3D362F]"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: m.avatar_color }}
                />
                <span>{m.name}</span>
                {m.user_id === activeMember.user_id && (
                  <span className="text-[10px] text-[#78716C]">(You)</span>
                )}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenInviteModal}
            id="settings-manage-members-btn"
            className="min-h-10 px-2 -mx-2 text-sm sm:text-[11px] font-semibold text-[#4E785E] hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Manage & Delete Members</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Google Account Household Access Requests */}
      <HouseholdAccessManager />

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Firebase Cloud Sync & Cross-Device */}
        <div
          onClick={onOpenCloudSyncModal}
          id="card-cloud-sync-setting"
          className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 cursor-pointer hover:border-[#D0C7B9] transition-all shadow-xs col-span-1 sm:col-span-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#486B88]/20 text-[#486B88] dark:text-[#A8C4DE] flex items-center justify-center shrink-0">
                <Cloud className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-2">
                  <span className="truncate">Cloud & Cross-Device Sync</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      cloudSyncBadgeStatus === 'synced'
                        ? 'bg-[#4E785E]'
                        : cloudSyncBadgeStatus === 'syncing'
                        ? 'bg-[#486B88] animate-ping'
                        : cloudSyncBadgeStatus === 'not_synced'
                        ? 'bg-[#486B88]'
                        : 'bg-[#AF7832]'
                    }`}
                  />
                </h3>
                <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                  Real-time multi-device ledger mirroring powered by Google Firebase Firestore
                </p>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-[#486B88] hover:underline shrink-0 self-start sm:self-auto pl-8 sm:pl-0">
              {user ? 'Manage Sync →' : 'Connect Account →'}
            </span>
          </div>
        </div>

        {/* Profile & Photo Settings */}
        <div
          onClick={onOpenProfileModal}
          id="card-profile-setting"
          className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 cursor-pointer hover:border-[#D0C7B9] transition-all shadow-xs flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-xl bg-[#4E785E]/20 text-[#4E785E] flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              My Profile & Photo
            </h3>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              Change your name, upload a profile photo, or select your role in this ledger.
            </p>
          </div>
        </div>

        {/* Daily Reminder */}
        {shouldShowNotificationSettings && (
          <div
            onClick={onOpenNotificationModal}
            id="card-reminder-setting"
            className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 cursor-pointer hover:border-[#D0C7B9] transition-all shadow-xs flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-[#AF7832]/20 text-[#AF7832] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                Daily Payback Reminder (§4.5)
              </h3>
              <p className="text-[11px] text-[#78716C] mt-0.5">
                Scheduled at {pushSettings.reminder_time} IST. Alerts if card spend is awaiting payback.
              </p>
            </div>
          </div>
        )}

        {/* Voice AI */}
        <div
          onClick={onOpenVoiceModal}
          id="card-voice-setting"
          className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 cursor-pointer hover:border-[#D0C7B9] transition-all shadow-xs flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-xl bg-[#B85D43]/20 text-[#B85D43] flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              Voice Intent Plugin (§4.9)
            </h3>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              Powered by server-side Gemini 3.1 Flash Lite (always free tier). Always requires confirmation before saving.
            </p>
          </div>
        </div>

        {/* Interactive Tour & Nomenclature Guide */}
        {onOpenTour && (
          <div
            onClick={onOpenTour}
            id="card-tour-setting"
            className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 cursor-pointer hover:border-[#D0C7B9] transition-all shadow-xs flex items-start gap-3 col-span-1 sm:col-span-2"
          >
            <div className="w-8 h-8 rounded-xl bg-[#B85D43]/15 text-[#B85D43] flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                  Interactive Tour & Nomenclature
                </h3>
                <span className="text-[10px] bg-[#B85D43]/10 text-[#B85D43] px-1.5 py-0.5 rounded font-semibold">
                  Guide
                </span>
              </div>
              <p className="text-[11px] text-[#78716C] mt-0.5">
                Replay the walkthrough explaining Salary vs. Spend accounts, Envelopes, and Credit Card Payback.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Architectural Guarantees Card (§1, §2, §5) */}
      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#4E785E]" />
          System Rules & Principles
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#78716C]">
          <div className="flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4E785E] shrink-0 mt-0.5" />
            <span>
              <strong>Integer paise everywhere:</strong> 100% free from floating-point rounding errors.
            </span>
          </div>

          <div className="flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4E785E] shrink-0 mt-0.5" />
            <span>
              <strong>Never-reset balances:</strong> Envelopes carry forward continuously across months.
            </span>
          </div>

          <div className="flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4E785E] shrink-0 mt-0.5" />
            <span>
              <strong>FIFO Payback loop:</strong> Partial and multi-transaction payoffs handled cleanly.
            </span>
          </div>

          <div className="flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4E785E] shrink-0 mt-0.5" />
            <span>
              <strong>Soft deletes & corrections:</strong> No accidental data loss for the couple.
            </span>
          </div>
        </div>
      </div>

      {/* PWA Install & Device App Section */}
      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4E785E]/15 text-[#4E785E] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-1.5">
              <span>Install Web App (PWA)</span>
              {isPwaInstalled && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#4E785E]/15 text-[#4E785E]">
                  Installed
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              {isPwaInstalled
                ? 'App is installed on your device with offline support and home screen icon.'
                : 'Add to your phone or desktop home screen for full-screen offline access.'}
            </p>
          </div>
        </div>

        {!isPwaInstalled && (
          <button
            type="button"
            onClick={onInstallPwa}
            id="install-pwa-btn"
            className="px-4 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}
      </div>

      {/* Danger Zone: Reset Data */}
      <div className="pt-2 flex flex-col items-start gap-3">
        <div className="flex flex-col items-start">
          <span className="text-xs font-semibold text-[#B83A3A] dark:text-[#E06A6A] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
            Data Management & Danger Zone
          </span>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
            Reset all recorded expenses, salary arrivals, and envelope balances to start fresh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Reset to Clean ₹0 State Button */}
          <button
            type="button"
            onClick={() => setIsResetZeroModalOpen(true)}
            id="reset-zero-data-btn"
            className="px-4 py-2.5 rounded-xl bg-[#B85D43] hover:bg-[#A04D35] active:scale-[0.98] text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all duration-150"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Balances & Transactions (₹0)</span>
          </button>
        </div>
      </div>

      {/* Warning Confirmation Modal */}
      <ResetDataWarningModal
        isOpen={isResetZeroModalOpen}
        onClose={() => setIsResetZeroModalOpen(false)}
        onConfirm={async () => {
          await resetLedgerToZero(false);
        }}
        title="Reset All Ledger Data to ₹0?"
        description="This will permanently reset all envelope balances, transactions, and pending credit card paybacks to ₹0. Your envelope categories and partner setup remain untouched."
        confirmText="Yes, Reset to ₹0"
        isZeroReset={true}
        bulletPoints={[
          'All envelope balances reset to ₹0 available',
          'All transactions and salary records are cleared',
          'Pending credit card payback is set to ₹0',
          'Ready immediately for your real salary allocation',
        ]}
      />

      {/* App Version Info inside Settings at bottom */}
      <div className="pt-6 mt-4 border-t border-[#E8E3DA] dark:border-[#2D2823] flex items-center justify-between text-xs text-[#78716C] dark:text-[#A8A29E]">
        <span>Envelope Budgeting</span>
        <span className="font-mono text-[11px] font-semibold text-[#78716C] dark:text-[#A8A29E] bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 px-2.5 py-1 rounded-lg border border-[#E8E3DA] dark:border-[#2D2823]">
          Version: {APP_VERSION}
        </span>
      </div>
    </div>
  );
};
