import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { CreateHouseholdModal } from './CreateHouseholdModal';
import { ShieldAlert, LogIn, RefreshCw, LogOut, ArrowRight, PlusCircle, CheckCircle2, Lock, Eye, Sparkles } from 'lucide-react';

interface AccessDeniedGateProps {
  onCheckAgain: () => void;
}

export const AccessDeniedGate: React.FC<AccessDeniedGateProps> = ({ onCheckAgain }) => {
  const { user, signInWithGoogle, logout, setHouseholdId } = useAuth();
  const { household, householdId, accessBlockedReason, enterPreviewMode } = useBudget();
  const [customHhInput, setCustomHhInput] = useState('');
  const [isSwitchingHh, setIsSwitchingHh] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error('Sign in error:', e);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCheckAgain = async () => {
    setIsChecking(true);
    try {
      await onCheckAgain();
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  const handleSwitchHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (customHhInput.trim()) {
      setHouseholdId(customHhInput.trim());
      setCustomHhInput('');
      setIsSwitchingHh(false);
    }
  };

  const isAuthRequired = accessBlockedReason === 'auth_required' || !user;

  return (
    <>
      <div className="min-h-screen bg-[#F4EFE6] dark:bg-[#141210] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-3xl p-6 sm:p-8 shadow-xl">
          {/* Icon & Status */}
          <div className="flex items-center justify-center mb-5">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                isAuthRequired
                  ? 'bg-[#4E785E]/10 text-[#4E785E] border border-[#4E785E]/20'
                  : 'bg-[#B85D43]/10 text-[#B85D43] border border-[#B85D43]/20'
              }`}
            >
              {isAuthRequired ? <Lock className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
            </div>
          </div>

          {/* Title & Description */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
              {isAuthRequired ? 'Google Sign-In Required' : 'Access Restricted by Owner'}
            </h1>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-2 leading-relaxed">
              {isAuthRequired ? (
                <>
                  Household <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{household?.name || householdId}</strong> is restricted to authorized Google accounts. Sign in to verify your access, or preview the app below.
                </>
              ) : (
                <>
                  You are signed in as <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{user?.email}</strong>, but this Google account has not been added to the allowlist for Household <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{household?.name || householdId}</strong>.
                </>
              )}
            </p>
          </div>

          {/* Not in allowlist - Instructions Box */}
          {!isAuthRequired && (
            <div className="mb-6 p-4 rounded-2xl bg-[#EFEAE1]/60 dark:bg-[#241F1B]/60 border border-[#E8E3DA] dark:border-[#2D2823] space-y-2.5 text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
              <span className="font-semibold text-xs text-[#78716C] dark:text-[#A8A29E] uppercase tracking-wider block">
                How to Get Access:
              </span>
              <div className="space-y-1.5 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#4E785E]/15 text-[#4E785E] font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span>Ask the household owner {household?.owner_email ? `(${household.owner_email})` : ''} to open <strong>Settings → Google Account Allowlist</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#4E785E]/15 text-[#4E785E] font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <span>Have them add <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{user?.email}</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#4E785E]/15 text-[#4E785E] font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <span>Tap <strong>Check Access Again</strong> below.</span>
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 mb-6">
            {isAuthRequired ? (
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-[#4E785E] text-white font-medium text-sm hover:bg-[#436851] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? 'Signing In...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCheckAgain}
                  disabled={isChecking}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#4E785E] text-white font-medium text-xs hover:bg-[#436851] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Verifying with Cloud...' : 'Check Access Again'}</span>
                </button>

                <button
                  onClick={() => logout()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] border border-[#E8E3DA] dark:border-[#2D2823] font-medium text-xs hover:bg-[#E5DFD5] dark:hover:bg-[#332C26] transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#78716C]" />
                  <span>Switch Google Account</span>
                </button>
              </>
            )}

            {/* Quick Preview App Button */}
            <button
              onClick={() => enterPreviewMode()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#EDE8E1] dark:bg-[#2A241F] text-[#1F1B16] dark:text-[#EDE8E1] hover:bg-[#E5DFD5] dark:hover:bg-[#342D27] font-semibold text-xs transition-colors cursor-pointer border border-[#DCD5C9] dark:border-[#3D362F]"
            >
              <Eye className="w-3.5 h-3.5 text-[#4E785E]" />
              <span>Preview App (Open Demo Workspace)</span>
            </button>
          </div>

          {/* Household Switcher & Create Own */}
          <div className="pt-4 border-t border-[#E8E3DA] dark:border-[#2D2823] space-y-3">
            {!isSwitchingHh ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[#4E785E] hover:underline font-semibold cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create New Household</span>
                </button>

                <button
                  onClick={() => setIsSwitchingHh(true)}
                  className="w-full text-center text-[11px] text-[#78716C] dark:text-[#A8A29E] hover:underline cursor-pointer"
                >
                  Connect to a different Household ID →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSwitchHousehold} className="space-y-2">
                <label className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E] block">
                  Enter Household ID:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customHhInput}
                    onChange={e => setCustomHhInput(e.target.value)}
                    placeholder="e.g. hh_family_ledger_main"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#141210] text-xs text-[#1F1B16] dark:text-[#EDE8E1] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!customHhInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#4E785E] text-white text-xs font-semibold hover:bg-[#436851] transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Join
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSwitchingHh(false)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#E8E3DA] dark:border-[#2D2823] text-xs text-[#78716C] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="text-center pt-2 text-[10px] text-[#78716C] dark:text-[#A8A29E]">
              Current Household ID: <code className="font-mono">{householdId}</code>
            </div>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <CreateHouseholdModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
    </>
  );
};

