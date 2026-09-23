import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useApiLoading } from '../context/ApiLoadingContext';
import { CreateHouseholdModal } from './CreateHouseholdModal';
import {
  X,
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
  PlusCircle,
  Eye,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const { user, signInWithGoogle, logout, householdId, setHouseholdId, authError } = useAuth();
  const { cloudSyncStatus, lastCloudSync, syncNow, household, enterPreviewMode } = useBudget();
  const { startApiCall, showToast } = useApiLoading();
  const [customHouseholdId, setCustomHouseholdId] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncingManually, setIsSyncingManually] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateHouseholdOpen, setIsCreateHouseholdOpen] = useState(false);

  if (!isOpen) return null;

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
    // In AI Studio development, origin is 'ais-dev-...'. This returns 401 to partners.
    // Replacing 'ais-dev-' with 'ais-pre-' gives the public shared link.
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
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      >
      <div
        className="w-full max-w-sm sm:max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 shadow-2xl relative text-[#1F1B16] dark:text-[#EDE8E1]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded-full transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-[#486B88]/15 text-[#486B88] dark:text-[#A8C4DE] flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight leading-tight">
              Cloud & Cross-Device Sync
            </h2>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              Powered by Google Firebase Firestore
            </p>
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="mb-3 p-2.5 sm:p-3 rounded-xl bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#E8E3DA] dark:border-[#2D2823] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {cloudSyncStatus === 'syncing' ? (
                <span className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-[#486B88] border-t-transparent" />
              ) : cloudSyncStatus === 'synced' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4E785E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4E785E]" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#AF7832]" />
              )}
            </span>
            <div>
              <div className="text-xs font-semibold capitalize flex items-center gap-1">
                {cloudSyncStatus === 'synced'
                  ? 'Real-Time Cloud Synced'
                  : cloudSyncStatus === 'syncing'
                  ? 'Syncing to Firebase...'
                  : 'Offline Cache Active'}
              </div>
              <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">
                {lastCloudSync ? `Last: ${lastCloudSync}` : 'Firestore active'}
              </div>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncingManually}
            className="px-2 py-1 text-[11px] font-medium rounded-lg bg-white/80 dark:bg-black/20 border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-white flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingManually ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>

        {/* Google Authentication Section */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block mb-1.5">
            Google Account
          </label>

          {user ? (
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/20 border border-[#E8E3DA] dark:border-[#2D2823] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-black/10 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] flex items-center justify-center font-bold text-xs shrink-0">
                    {user.displayName ? user.displayName[0] : 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight truncate">
                    {user.displayName || 'Google User'}
                  </div>
                  <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E] truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 text-[#78716C] hover:text-[#B85D43] transition-colors rounded-lg border border-transparent hover:border-[#CADBCE] cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                id="google-signin-btn"
                className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#28221D] border border-[#DCD5C9] dark:border-[#3D362F] hover:border-[#486B88] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-75 disabled:cursor-wait"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#486B88]" />
                    <span>Connecting Google Account...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E] bg-[#FAF7F2] p-1.5 rounded-lg flex items-center justify-between border border-[#E8E3DA]">
                  <span>Viewing in preview?</span>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#486B88] hover:underline flex items-center gap-1"
                  >
                    <span>Open in new tab</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <p className="text-xs text-[#B85D43] mt-1.5 bg-[#F9ECE8] dark:bg-[#331D16] p-2 rounded-lg border border-[#E8C5BC] dark:border-[#5E261B]">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Shared Household Sync ID */}
        <div className="mb-2.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block mb-1">
            Shared Household ID
          </label>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 px-2.5 py-1.5 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#E8E3DA] dark:border-[#2D2823] rounded-lg text-[11px] font-mono select-all truncate">
              {householdId}
            </div>
            <button
              onClick={handleCopyHouseholdId}
              id="copy-household-id-btn"
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-[#28221D] border border-[#DCD5C9] dark:border-[#3D362F] text-[11px] font-medium flex items-center gap-1 shadow-xs hover:bg-[#EFEAE1] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-[#4E785E]" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleCopyPublicLink}
              id="copy-partner-link-btn"
              className="px-2.5 py-1.5 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-[11px] font-semibold flex items-center gap-1 shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
              title="Copy link for partner (avoids 401 Unauthorized)"
            >
              {copiedLink ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              <span>{copiedLink ? 'Copied!' : 'Share Link'}</span>
            </button>
          </div>
          <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mt-1">
            Share this ID or link with your partner so both devices mirror this live ledger without 401 errors.
          </p>
        </div>

        {/* Join Other Household Form */}
        <form onSubmit={handleSwitchHousehold} className="mb-2.5 pt-2 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60">
          <label className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
            Connect to an existing Household ID:
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={customHouseholdId}
              onChange={e => setCustomHouseholdId(e.target.value)}
              placeholder="e.g. hh_family_ledger"
              className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-black/20 border border-[#DCD5C9] dark:border-[#3D362F] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#486B88]"
            />
            <button
              type="submit"
              disabled={!customHouseholdId.trim()}
              className="px-2.5 py-1 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Connect
            </button>
          </div>
        </form>

        {/* Quick Household Actions */}
        <div className="flex items-center gap-2 mb-2.5 pt-2 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60">
          <button
            type="button"
            onClick={() => setIsCreateHouseholdOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#4E785E]/10 text-[#4E785E] text-xs font-semibold hover:bg-[#4E785E]/20 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Household</span>
          </button>
          <button
            type="button"
            onClick={() => {
              enterPreviewMode();
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] text-xs font-medium text-[#78716C] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Mode</span>
          </button>
        </div>

        {/* Cross Device Instructions */}
        <div className="p-2.5 rounded-xl bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 border border-[#E8E3DA] dark:border-[#2D2823] text-[11px] space-y-1.5 text-[#78716C] dark:text-[#A8A29E]">
          <div className="flex items-start gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#486B88] shrink-0 mt-0.5" />
            <span>
              <strong>Cross-Device:</strong> Expenses, transfers, or salary logged on one phone sync to the other in real time.
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4E785E] shrink-0 mt-0.5" />
            <span>
              <strong>Offline Resilient:</strong> Keeps working with poor connectivity, auto-syncing when back online.
            </span>
          </div>
        </div>
      </div>
    </div>

    {isCreateHouseholdOpen && (
      <CreateHouseholdModal
        isOpen={isCreateHouseholdOpen}
        onClose={() => setIsCreateHouseholdOpen(false)}
      />
    )}
  </>
  );
};
