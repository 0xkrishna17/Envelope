import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { HouseholdAccessManager } from './HouseholdAccessManager';
import { CreateHouseholdModal } from './CreateHouseholdModal';
import { Users, Bell, Mic, RefreshCw, Shield, Database, Sparkles, CheckCircle2, Cloud, User, Camera, RotateCcw, AlertTriangle, BookOpen, PlusCircle } from 'lucide-react';
import { ResetDataWarningModal } from './ResetDataWarningModal';

interface SettingsTabProps {
  onOpenInviteModal: () => void;
  onOpenNotificationModal: () => void;
  onOpenVoiceModal: () => void;
  onOpenCloudSyncModal: () => void;
  onOpenProfileModal: () => void;
  onOpenTour?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  onOpenInviteModal,
  onOpenNotificationModal,
  onOpenVoiceModal,
  onOpenCloudSyncModal,
  onOpenProfileModal,
  onOpenTour,
}) => {
  const { user, householdId } = useAuth();
  const [resetModalMode, setResetModalMode] = useState<'sample' | 'zero' | null>(null);
  const [isCreateHhOpen, setIsCreateHhOpen] = useState(false);
  const {
    household,
    members,
    activeMember,
    pushSettings,
    resetToSampleData,
    resetLedgerToZero,
    cloudSyncStatus,
    lastCloudSync,
  } = useBudget();

  return (
    <div className="flex flex-col gap-4 animate-in fade-in pb-16">
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
                Ledger: <strong>{household.name}</strong> • ID: <code className="text-[11px] font-mono">{householdId}</code>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsCreateHhOpen(true)}
              id="settings-new-household-btn"
              className="px-3 py-1.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-[#4E785E]"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Household</span>
            </button>
            <button
              onClick={onOpenProfileModal}
              id="settings-edit-profile-btn"
              className="px-3 py-1.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#4E785E]" />
              <span>Edit Profile & Photo</span>
            </button>
            <button
              onClick={onOpenInviteModal}
              id="settings-invite-partner-btn"
              className="px-3 py-1.5 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Invite Partner
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
            className="text-[11px] font-semibold text-[#4E785E] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Manage & Delete Members</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Google Account Allowlist & Access Control */}
      <HouseholdAccessManager />

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Firebase Cloud Sync & Cross-Device */}
        <div
          onClick={onOpenCloudSyncModal}
          id="card-cloud-sync-setting"
          className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-4 cursor-pointer hover:border-[#D0C7B9] transition-all shadow-xs flex items-start gap-3 col-span-1 sm:col-span-2"
        >
          <div className="w-8 h-8 rounded-xl bg-[#486B88]/20 text-[#486B88] dark:text-[#A8C4DE] flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-1.5">
                <span>Cloud & Cross-Device Sync (Firebase Firestore)</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    cloudSyncStatus === 'synced'
                      ? 'bg-[#4E785E]'
                      : cloudSyncStatus === 'syncing'
                      ? 'bg-[#486B88] animate-ping'
                      : 'bg-[#AF7832]'
                  }`}
                />
              </h3>
              <span className="text-[11px] font-semibold text-[#486B88] hover:underline">
                {user ? 'Manage Sync →' : 'Connect Account →'}
              </span>
            </div>
            <p className="text-[11px] text-[#78716C] mt-0.5">
              {user
                ? `Signed in as ${user.displayName || user.email}. Household ID: ${householdId}. Both phones stay updated in real time.`
                : 'Sign in with Google to sync envelope balances across all phones and laptops.'}
            </p>
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

      {/* Danger Zone: Reset Data */}
      <div className="pt-2 flex flex-col items-start gap-3">
        <div className="flex flex-col items-start">
          <span className="text-xs font-semibold text-[#B83A3A] dark:text-[#E06A6A] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
            Data Management & Danger Zone
          </span>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
            Clear demo values to start fresh with real money, or reload sample demo records anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Reset to Clean ₹0 State Button */}
          <button
            type="button"
            onClick={() => setResetModalMode('zero')}
            id="reset-zero-data-btn"
            className="px-4 py-2.5 rounded-xl bg-[#B85D43] hover:bg-[#A04D35] active:scale-[0.98] text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all duration-150"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start Clean (₹0 All Envelopes)</span>
          </button>

          {/* Restore Sample Demo Data Button */}
          <button
            type="button"
            onClick={() => setResetModalMode('sample')}
            id="reset-demo-data-btn"
            className="px-4 py-2.5 rounded-xl bg-[#DC2626]/90 hover:bg-[#DC2626] active:scale-[0.98] text-white text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all duration-150"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Sample Demo Data</span>
          </button>
        </div>
      </div>

      {/* Warning Confirmation Modal */}
      <ResetDataWarningModal
        isOpen={resetModalMode !== null}
        onClose={() => setResetModalMode(null)}
        onConfirm={resetModalMode === 'zero' ? () => resetLedgerToZero(false) : resetToSampleData}
        title={resetModalMode === 'zero' ? 'Start Clean with ₹0 Ledger?' : 'Restore Sample Demo Data?'}
        description={
          resetModalMode === 'zero'
            ? 'This will immediately reset all envelope balances, transactions, and pending credit card paybacks to ₹0. Your category configuration and partner setup remain untouched.'
            : 'This will re-populate all envelopes, transactions, and payback reconciliations with the rich demonstration dataset.'
        }
        confirmText={resetModalMode === 'zero' ? 'Yes, Reset to ₹0' : 'Yes, Restore Demo Data'}
        isZeroReset={resetModalMode === 'zero'}
        bulletPoints={
          resetModalMode === 'zero'
            ? [
                'All envelope balances reset to ₹0 available',
                'All mock transactions and paybacks are cleared',
                'Pending card reconciliation is set to ₹0',
                'Ready immediately for your real salary allocation',
              ]
            : [
                'Default demo envelopes and targets will reload',
                'Sample grocery, fuel, and dining expenses will appear',
                'Pending credit card payback will return to demo values',
                'Great for practicing and previewing features',
              ]
        }
      />

      {isCreateHhOpen && (
        <CreateHouseholdModal
          isOpen={isCreateHhOpen}
          onClose={() => setIsCreateHhOpen(false)}
        />
      )}
    </div>
  );
};
