import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { ShieldAlert, LogIn, RefreshCw, LogOut, Lock } from 'lucide-react';

interface AccessDeniedGateProps {
  onCheckAgain: () => Promise<unknown> | unknown;
}

export const AccessDeniedGate: React.FC<AccessDeniedGateProps> = ({ onCheckAgain }) => {
  const { user, signInWithGoogle, logout } = useAuth();
  const { household, accessBlockedReason } = useBudget();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

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
                  This shared household ledger is restricted to authorized Google accounts. Sign in to verify your access.
                </>
              ) : (
                <>
                  You are signed in as <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{user?.email}</strong>, but this Google account has not accepted a household request for <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{household?.name || 'this shared household'}</strong>.
                </>
              )}
            </p>
          </div>

          {/* Access request instructions */}
          {!isAuthRequired && (
            <div className="mb-6 p-4 rounded-2xl bg-[#EFEAE1]/60 dark:bg-[#241F1B]/60 border border-[#E8E3DA] dark:border-[#2D2823] space-y-2.5 text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
              <span className="font-semibold text-xs text-[#78716C] dark:text-[#A8A29E] uppercase tracking-wider block">
                How to Get Access:
              </span>
              <div className="space-y-1.5 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#4E785E]/15 text-[#4E785E] font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span>Ask the household owner {household?.owner_email ? `(${household.owner_email})` : ''} to open <strong>Members</strong> and send a request to your Google email.</span>
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
          </div>

          {/* Household Access Context */}
          <div className="pt-4 border-t border-[#E8E3DA] dark:border-[#2D2823] space-y-2 text-center">
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              Ledger IDs are internal. Access is granted only after the owner sends a request and you accept it with the matching Google account.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

