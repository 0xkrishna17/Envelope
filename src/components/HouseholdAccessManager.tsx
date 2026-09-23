import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Plus, Trash2, Mail, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react';

interface HouseholdAccessManagerProps {
  compact?: boolean;
}

export const HouseholdAccessManager: React.FC<HouseholdAccessManagerProps> = ({ compact = false }) => {
  const { household, addAllowedEmail, removeAllowedEmail, isOwner } = useBudget();
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailToRemove, setEmailToRemove] = useState<string | null>(null);

  const ownerEmail = (household.owner_email || user?.email || '').trim().toLowerCase();
  const allowedEmails = Array.from(
    new Set([
      ...(ownerEmail ? [ownerEmail] : []),
      ...((household.allowed_emails || []).map(e => e.trim().toLowerCase())),
    ])
  ).filter(Boolean);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = newEmail.trim().toLowerCase();
    if (!clean) return;

    setIsSubmitting(true);
    try {
      const res = await addAllowedEmail(clean);
      if (!res.success) {
        setErrorMsg(res.error || 'Could not add email.');
      } else {
        setSuccessMsg(`Added ${clean} to allowlist.`);
        setNewEmail('');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (email: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await removeAllowedEmail(email);
      if (!res.success) {
        setErrorMsg(res.error || 'Could not remove email.');
      } else {
        setSuccessMsg(`Removed ${email} from allowlist.`);
        setEmailToRemove(null);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error removing email.');
    }
  };

  return (
    <div className={`space-y-3 ${compact ? '' : 'p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823]'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#4E785E]/10 text-[#4E785E]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
              Google Account Allowlist & Permissions
            </h3>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              Only authorized Google accounts can view or edit this shared dashboard.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4E785E]/15 text-[#4E785E]">
          {allowedEmails.length} {allowedEmails.length === 1 ? 'account' : 'accounts'}
        </span>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center gap-2 text-xs text-[#DC2626] dark:text-[#F87171]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-2.5 rounded-xl bg-[#4E785E]/10 border border-[#4E785E]/20 flex items-center gap-2 text-xs text-[#4E785E]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* List of Allowed Emails */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block">
          Authorized Accounts
        </span>
        <div className="divide-y divide-[#E8E3DA]/60 dark:divide-[#2D2823]/60 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-white/50 dark:bg-[#141210]/50 overflow-hidden">
          {allowedEmails.map(email => {
            const isHouseholdOwner = email === ownerEmail;
            const isCurrentUser = user?.email?.toLowerCase() === email;

            return (
              <div
                key={email}
                className="flex items-center justify-between p-2.5 px-3 hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-[#78716C] shrink-0" />
                  <span className="text-xs text-[#1F1B16] dark:text-[#EDE8E1] truncate font-medium">
                    {email}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {isHouseholdOwner ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#4E785E]/15 text-[#4E785E]">
                        Owner
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#78716C]/15 text-[#78716C] dark:text-[#A8A29E]">
                        Partner
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="text-[10px] font-medium px-1 py-0.2 text-[#78716C]">
                        (You)
                      </span>
                    )}
                  </div>
                </div>

                {!isHouseholdOwner && (
                  <div>
                    {emailToRemove === email ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => handleRemove(email)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DC2626] text-white hover:bg-[#B91C1C] cursor-pointer"
                        >
                          Revoke
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailToRemove(null)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-[#78716C] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEmailToRemove(email)}
                        className="p-1 rounded text-[#78716C] hover:text-[#DC2626] dark:hover:text-[#F87171] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        title={`Remove ${email} from allowlist`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Partner Form */}
      <form onSubmit={handleAdd} className="pt-2 space-y-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block">
          Add Partner Google Email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="e.g. spouse@gmail.com"
            className="flex-1 px-3 py-1.5 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#141210] text-xs text-[#1F1B16] dark:text-[#EDE8E1] outline-none placeholder-[#A8A29E]"
          />
          <button
            type="submit"
            disabled={!newEmail.trim() || isSubmitting}
            className="px-3.5 py-1.5 rounded-xl bg-[#4E785E] text-white font-medium text-xs hover:bg-[#436851] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Adding...' : 'Add'}</span>
          </button>
        </div>
        <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed pt-0.5">
          Tip: When your partner logs in with this Google email, they will instantly see the same envelopes, balances, and ledger in real time.
        </p>
      </form>
    </div>
  );
};
