import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useApiLoading } from '../context/ApiLoadingContext';
import { HouseholdAccessManager } from './HouseholdAccessManager';
import { ResetDataWarningModal } from './ResetDataWarningModal';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  LogOut,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Users,
  Loader2,
  Share2,
  Eye,
  ArrowLeft,
  Database,
  Lock,
  RotateCcw,
} from 'lucide-react';

interface CloudSyncScreenProps {
  onBack?: () => void;
  onNavigateToInvite?: () => void;
}

export const CloudSyncScreen: React.FC<CloudSyncScreenProps> = ({
  onBack,
  onNavigateToInvite,
}) => {
  const { user, signInWithGoogle, logout, householdId, setHouseholdId, authError } = useAuth();
  const { cloudSyncStatus, lastCloudSync, syncNow, household, resetLedgerToZero } = useBudget();
  const { startApiCall, showToast } = useApiLoading();
  const [customHouseholdId, setCustomHouseholdId] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncingManually, setIsSyncingManually] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetCleanModalOpen, setIsResetCleanModalOpen] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    const stopLoader = startApiCall('Signing in with Google Account...');
    try {
      await signInWithGoogle();
      showToast('Signed in with Google successfully', 'success');
    } catch (err: any) {
      console.error('Sign-in error:', err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setErrorMessage(
          'Popup was blocked by the browser iframe. Click "Open in New Tab" below to sign in with Google.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsSigningIn(false);
      stopLoader();
    }
  };

  const handleCopyHouseholdId = () => {
    navigator.clipboard.writeText(householdId);
    setCopied(true);
    showToast('Household ID copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPublicLink = () => {
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const publicUrl = `${origin}/?household=${encodeURIComponent(householdId)}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    showToast('Public partner link copied!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSwitchHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customHouseholdId.trim();
    if (clean) {
      setHouseholdId(clean);
      setCustomHouseholdId('');
      showToast(`Connected to household ${clean}`, 'success');
    }
  };

  const handleManualSync = async () => {
    setIsSyncingManually(true);
    const stopLoader = startApiCall('Syncing ledger with Firestore...');
    try {
      await syncNow();
      showToast('Envelopes synced to cloud', 'success');
    } finally {
      setIsSyncingManually(false);
      stopLoader();
    }
  };

  const isIframe = window.self !== window.top;

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-20 animate-in fade-in">
      {/* Screen Header & Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              id="sync-back-btn"
              className="p-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Return to Envelopes"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#486B88]/15 text-[#486B88] dark:text-[#A8C4DE] flex items-center justify-center shrink-0">
                <Cloud className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F1B16] dark:text-[#EDE8E1]">
                Cloud & Cross-Device Sync
              </h1>
            </div>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1">
              Real-time multi-device ledger mirroring powered by Google Firebase Firestore
            </p>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncingManually}
          id="sync-now-top-btn"
          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] hover:opacity-90 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingManually ? 'animate-spin' : ''}`} />
          <span>Sync Now</span>
        </button>
      </div>

      {/* Grid: Live Connection Status + Google Authentication */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Live Status */}
        <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#486B88]" />
                Connection Health
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  cloudSyncStatus === 'synced'
                    ? 'bg-[#4E785E]/15 text-[#2C523B] dark:text-[#A1D1B1]'
                    : cloudSyncStatus === 'syncing'
                    ? 'bg-[#486B88]/15 text-[#486B88]'
                    : 'bg-[#AF7832]/15 text-[#AF7832]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cloudSyncStatus === 'synced'
                      ? 'bg-[#4E785E]'
                      : cloudSyncStatus === 'syncing'
                      ? 'bg-[#486B88] animate-ping'
                      : 'bg-[#AF7832]'
                  }`}
                />
                <span className="capitalize">{cloudSyncStatus}</span>
              </span>
            </div>

            <div className="text-base font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
              {cloudSyncStatus === 'synced'
                ? 'Bidirectional Cloud Mirror Active'
                : cloudSyncStatus === 'syncing'
                ? 'Uploading Ledger Updates...'
                : 'Working Offline (Local Storage Active)'}
            </div>

            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1.5 leading-relaxed">
              Every expense, salary event, envelope transfer, and card reconciliation auto-syncs across your partner's devices with sub-second latency.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E8E3DA] dark:border-[#2D2823] flex items-center justify-between text-xs text-[#78716C] dark:text-[#A8A29E]">
            <span>Last synchronized:</span>
            <span className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              {lastCloudSync || 'Just now'}
            </span>
          </div>
        </div>

        {/* Card 2: Google Authentication */}
        <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5 mb-3">
              <Lock className="w-3.5 h-3.5 text-[#4E785E]" />
              Google Account Identity
            </span>

            {user ? (
              <div className="p-3 rounded-xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#E8E3DA] dark:border-[#2D2823] flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google Account'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border border-black/10 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] flex items-center justify-center font-bold text-sm shrink-0">
                      {user.displayName ? user.displayName[0] : 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                      {user.displayName || 'Google User'}
                    </div>
                    <div className="text-xs text-[#78716C] dark:text-[#A8A29E] truncate">
                      {user.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  id="btn-google-signout"
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#B85D43] transition-colors rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:border-[#CADBCE] cursor-pointer flex items-center gap-1"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                  Sign in with your Google Account to secure your household ledger and automatically claim co-ownership.
                </p>

                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  id="google-signin-screen-btn"
                  className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-[#28221D] border border-[#DCD5C9] dark:border-[#3D362F] hover:border-[#486B88] text-xs font-semibold shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-75"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#486B88]" />
                      <span>Connecting Google Account...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>

                {isIframe && (
                  <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 p-2 rounded-lg flex items-center justify-between border border-[#E8E3DA]">
                    <span>Viewing in AI Studio preview?</span>
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#486B88] hover:underline flex items-center gap-1"
                    >
                      <span>Open in new tab</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {errorMessage && (
              <p className="text-xs text-[#B85D43] mt-2 bg-[#F9ECE8] dark:bg-[#331D16] p-2.5 rounded-lg border border-[#E8C5BC] dark:border-[#5E261B]">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Household Ledger ID & Sharing */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              Shared Household Identifier & Partner Link
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              Both devices connect to this unique cloud ledger identifier.
            </p>
          </div>
          {onNavigateToInvite && (
            <button
              onClick={onNavigateToInvite}
              className="text-xs text-[#4E785E] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Invite Partner Screen →</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 px-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#E8E3DA] dark:border-[#2D2823] rounded-xl text-xs font-mono select-all truncate">
            {householdId}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyHouseholdId}
              id="copy-household-id-screen-btn"
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-white dark:bg-[#28221D] border border-[#DCD5C9] dark:border-[#3D362F] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#EFEAE1] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#4E785E]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy ID'}</span>
            </button>

            <button
              onClick={handleCopyPublicLink}
              id="copy-partner-link-screen-btn"
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
              title="Copy shareable link for partner"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Share Partner Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Google Account Allowlist & Access Control */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs">
        <HouseholdAccessManager compact={true} />
      </div>

      {/* Advanced Household Management */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            Connect to Existing Household or Create New
          </h2>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
            Have an existing ledger ID from your partner? Enter it below to connect.
          </p>
        </div>

        <form onSubmit={handleSwitchHousehold} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customHouseholdId}
            onChange={e => setCustomHouseholdId(e.target.value)}
            placeholder="e.g. hh_family_ledger_main"
            className="flex-1 px-3 py-2 text-xs bg-white dark:bg-black/20 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#486B88]"
          />
          <button
            type="submit"
            disabled={!customHouseholdId.trim()}
            className="px-4 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold disabled:opacity-40 cursor-pointer shadow-xs"
          >
            Connect to Ledger
          </button>
        </form>
      </div>

      {/* Clear Firebase Cloud Store & Start Clean */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#B85D43] flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4 text-[#B85D43]" />
            <span>Clear Firebase Cloud Store & Start Clean</span>
          </h2>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
            Wipes all transactions, salary arrivals, and balances from both Cloud Firestore and local storage so you can start fresh with ₹0.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsResetCleanModalOpen(true)}
          id="clear-cloud-store-btn"
          className="px-4 py-2 rounded-xl bg-[#B85D43] hover:bg-[#A04D35] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Cloud & Reset (₹0)</span>
        </button>
      </div>

      <ResetDataWarningModal
        isOpen={isResetCleanModalOpen}
        onClose={() => setIsResetCleanModalOpen(false)}
        onConfirm={async () => {
          await resetLedgerToZero(false);
          showToast('Cloud store and local ledger cleared to ₹0', 'success');
        }}
        title="Clear Cloud Database & Start Clean?"
        description="This will permanently reset all transactions, envelope balances, and credit card debts to ₹0 in Firebase Firestore and locally. Your envelope categories and Google account permissions remain intact."
        confirmText="Yes, Clear Cloud Store"
        isZeroReset={true}
        bulletPoints={[
          'All envelope balances reset to ₹0 available',
          'All transaction and salary histories wiped from Firebase Firestore',
          'Pending credit card payback reset to ₹0',
          'Ready immediately for your fresh real salary allocation',
        ]}
      />

      {/* Multi-Device Architecture Notes */}
      <div className="p-4 rounded-2xl bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 border border-[#E8E3DA] dark:border-[#2D2823] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#78716C] dark:text-[#A8A29E]">
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-[#486B88] shrink-0 mt-0.5" />
          <span>
            <strong>Real-time mirroring:</strong> Expenses, salary envelopes, and credit card reconciliations logged by either partner reflect instantly on both screens.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#4E785E] shrink-0 mt-0.5" />
          <span>
            <strong>Offline resilience:</strong> Works smoothly offline. Changes queue locally in storage and auto-commit to Firestore the moment you reconnect.
          </span>
        </div>
      </div>
    </div>
  );
};
