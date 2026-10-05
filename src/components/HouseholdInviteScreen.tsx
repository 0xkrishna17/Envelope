import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { HouseholdAccessManager } from './HouseholdAccessManager';
import { ResetDataWarningModal } from './ResetDataWarningModal';
import { ArrowLeft, Users, ShieldCheck } from 'lucide-react';
import { getMemberDisplayName, getMemberInitial } from '../utils/memberDisplay';

interface HouseholdInviteScreenProps {
  onBack?: () => void;
  onNavigateToSync?: () => void;
}

export const HouseholdInviteScreen: React.FC<HouseholdInviteScreenProps> = ({
  onBack,
  onNavigateToSync,
}) => {
  const {
    household,
    members,
    pendingInvitations,
    sentInvitations,
    acceptInvitation,
    declineInvitation,
    revokeInvitation,
    isOwner,
  } = useBudget();
  const [invitationIdToAccept, setInvitationIdToAccept] = useState<string | null>(null);

  const runAction = async (action: () => Promise<{ ok: boolean; message?: string }>) => {
    await action();
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-28 sm:pb-20 animate-in fade-in">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              id="members-back-btn"
              className="min-h-11 px-3 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-sm sm:text-xs font-medium"
              title="Return to Envelopes"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#4E785E]/15 text-[#2C523B] dark:text-[#A1D1B1] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F1B16] dark:text-[#EDE8E1]">
                Members & Household Requests
              </h1>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Add people by Google email. Ledger IDs are internal and never shared in links.
              </p>
            </div>
          </div>
        </div>

        {onNavigateToSync && (
          <button
            onClick={onNavigateToSync}
            className="min-h-10 px-3 py-2 text-sm sm:text-xs text-[#486B88] font-semibold hover:underline inline-flex items-center justify-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Cloud & Sync Screen →</span>
          </button>
        )}
      </div>

      {pendingInvitations.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#EFF6FF] dark:bg-[#111827] border border-[#BFDBFE] dark:border-[#1D4ED8] shadow-xs flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1D4ED8] dark:text-[#93C5FD]">Requests for you</h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1">
              Accepting switches your active dashboard to the shared household.
            </p>
          </div>
          {pendingInvitations.map(invitation => (
            <div key={invitation.id} className="p-3 rounded-xl bg-white/70 dark:bg-[#1A1714] border border-[#BFDBFE] dark:border-[#1D4ED8] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs">
                <div className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">{invitation.household_name}</div>
                <div className="text-[#78716C] dark:text-[#A8A29E]">Invited by {invitation.inviter_email}</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setInvitationIdToAccept(invitation.id)}
                  className="min-h-10 px-3 py-2 rounded-lg bg-[#4E785E] text-white text-sm sm:text-xs font-semibold cursor-pointer"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => runAction(() => declineInvitation(invitation.id))}
                  className="min-h-10 px-3 py-2 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] text-sm sm:text-xs font-semibold cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs">
        <HouseholdAccessManager compact={true} />
      </div>

      {isOwner && sentInvitations.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">Pending sent requests</h2>
          {sentInvitations.map(invitation => (
            <div key={invitation.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-[#EFEAE1]/60 dark:bg-[#28221D]/60">
              <span className="text-[#78716C] dark:text-[#A8A29E]">{invitation.invitee_email} · {invitation.status}</span>
              {invitation.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => runAction(() => revokeInvitation(invitation.id))}
                  className="text-[#B85D43] font-semibold cursor-pointer"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">Connected Members</h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">Accepted members currently connected to {household.name}.</p>
          </div>
          <span className="text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
            {members.length} {members.length === 1 ? 'Member' : 'Members'}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full bg-[#4E785E]/15 text-[#4E785E] dark:bg-[#A8D1B7]/15 dark:text-[#A8D1B7] text-xs font-bold flex items-center justify-center shadow-xs shrink-0">

                  {getMemberInitial(member)}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate">{getMemberDisplayName(member)}</div>
                  <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] capitalize">{member.role}</div>
                </div>
              </div>
              {member.role === 'owner' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4E785E]/15 text-[#4E785E] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Owner
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ResetDataWarningModal
        isOpen={Boolean(invitationIdToAccept)}
        onClose={() => setInvitationIdToAccept(null)}
        onConfirm={async () => {
          if (!invitationIdToAccept) return;
          await runAction(() => acceptInvitation(invitationIdToAccept));
          setInvitationIdToAccept(null);
        }}
        title="Join Shared Household?"
        description="Accepting this request switches your active dashboard from your private ledger to the shared household. Your private ledger remains saved and will be restored if you leave the household later."
        confirmText="Yes, Join Household"
        isZeroReset={false}
        bulletPoints={[
          'Your current private dashboard will no longer be the active view',
          'The shared household dashboard will become your active view after accepting',
          'Your private ledger stays attached to your Google account',
          'Decline if you want to keep using only your own private household',
        ]}
      />
    </div>
  );
};
