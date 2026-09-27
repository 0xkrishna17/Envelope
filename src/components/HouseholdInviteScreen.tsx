import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Invite, Membership } from '../types';
import { HouseholdAccessManager } from './HouseholdAccessManager';
import {
  Users,
  Copy,
  Check,
  Clock,
  Share2,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  X,
  UserPlus,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

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
    activeMember,
    invites,
    createInvite,
    revokeInvite,
    setActiveMemberId,
    updateMemberName,
    deleteMember,
  } = useBudget();

  const [activeInvite, setActiveInvite] = useState<Invite | null>(() => {
    return invites.find(i => !i.used_at && new Date(i.expires_at) > new Date()) || null;
  });

  const [copied, setCopied] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState<string>('');
  const [memberToDelete, setMemberToDelete] = useState<Membership | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleStartEdit = (userId: string, currentName: string) => {
    setEditingUserId(userId);
    setEditNameVal(currentName);
  };

  const handleSaveEdit = (userId: string) => {
    if (editNameVal.trim()) {
      updateMemberName(userId, editNameVal.trim());
    }
    setEditingUserId(null);
  };

  const handleConfirmDelete = () => {
    if (!memberToDelete) return;
    const res = deleteMember(memberToDelete.user_id);
    if (!res.success) {
      setDeleteError(res.error || 'Failed to delete member');
    } else {
      setMemberToDelete(null);
      setDeleteError(null);
    }
  };

  const handleGenerateCode = () => {
    const inv = createInvite();
    setActiveInvite(inv);
  };

  const getPublicShareUrl = (code?: string) => {
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const params = new URLSearchParams();
    if (household?.id) params.set('household', household.id);
    if (code) params.set('code', code);
    return `${origin}/?${params.toString()}`;
  };

  const inviteUrl = activeInvite ? getPublicShareUrl(activeInvite.code) : '';

  const copyToClipboard = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    if (!inviteUrl) return;
    const msg = encodeURIComponent(
      `Join my shared household on Envelope Budgeting! Tap here: ${inviteUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-20 animate-in fade-in">
      {/* Screen Header & Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              id="invite-back-btn"
              className="p-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
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
                Invite Partner & Household Sharing
              </h1>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Pair your partner's phone or computer so both of you share the exact same live ledger
              </p>
            </div>
          </div>
        </div>

        {onNavigateToSync && (
          <button
            onClick={onNavigateToSync}
            className="text-xs text-[#486B88] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Cloud & Sync Screen →</span>
          </button>
        )}
      </div>

      {/* Grid: Active Invite Link & Code + Quick 3-Step Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Share Link Card (2 cols on md) */}
        <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#4E785E]" />
                Single-Tap Partner Invite Link
              </span>
              <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>48h validity</span>
              </span>
            </div>

            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              Send this link to your spouse or partner. When they tap it, their device immediately connects to <strong>{household.name}</strong> with full live access.
            </p>
          </div>

          {activeInvite ? (
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center gap-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 p-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F]">
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-white dark:bg-[#1A1714] rounded-md shadow-2xs text-[#1F1B16] dark:text-[#EDE8E1]">
                  {activeInvite.code}
                </span>
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 text-xs text-[#78716C] dark:text-[#A8A29E] bg-transparent truncate focus:outline-hidden font-mono"
                />
                <button
                  onClick={copyToClipboard}
                  id="copy-invite-link-screen-btn"
                  className="px-3 py-1.5 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center gap-1 cursor-pointer hover:opacity-90 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#4E785E]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={shareViaWhatsApp}
                  id="share-whatsapp-screen-btn"
                  className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#1EBE5D] transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp</span>
                </button>

                <button
                  onClick={copyToClipboard}
                  className="py-2 px-4 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer"
                >
                  {copied ? 'Link Copied!' : 'Copy Share Link'}
                </button>

                <button
                  onClick={() => {
                    revokeInvite(activeInvite.id);
                    setActiveInvite(null);
                  }}
                  className="py-2 px-3 text-xs text-[#B85D43] hover:underline cursor-pointer"
                >
                  Revoke Code
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              id="generate-invite-link-screen-btn"
              className="w-full py-3 px-4 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Generate New 48h Partner Pairing Link</span>
            </button>
          )}
        </div>

        {/* Card 2: 3-Step Guide */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block mb-2">
              How Pairing Works
            </span>
            <div className="space-y-2.5 text-xs text-[#78716C] dark:text-[#A8A29E]">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>Send your partner the invite link above via WhatsApp or message.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>Partner taps the link on their phone or laptop.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>Both devices immediately mirror this ledger in real time!</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#E8E3DA] dark:border-[#2D2823] flex items-center gap-1.5 text-[11px] text-[#4E785E] font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero account setup needed to preview</span>
          </div>
        </div>
      </div>

      {/* Google Account Allowlist & Access Control */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs">
        <HouseholdAccessManager compact={false} />
      </div>

      {/* Connected Household Members */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              Connected Household Members Roster
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              Names and roles of everyone participating in this household budget.
            </p>
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
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span
                  className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-xs shrink-0"
                  style={{ backgroundColor: member.avatar_color }}
                >
                  {member.name.charAt(0)}
                </span>

                {editingUserId === member.user_id ? (
                  <div className="flex items-center gap-1.5 flex-1 mr-2">
                    <input
                      type="text"
                      value={editNameVal}
                      onChange={e => setEditNameVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(member.user_id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] text-[#1F1B16] dark:text-[#EDE8E1] w-full max-w-[160px] focus:outline-hidden focus:ring-1 focus:ring-[#4E785E]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(member.user_id)}
                      className="p-1 rounded bg-[#4E785E] text-white hover:opacity-90"
                      title="Save Name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="p-1 rounded text-[#78716C] hover:text-[#1F1B16]"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="truncate flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                        {member.name} {member.user_id === activeMember.user_id && '(You)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(member.user_id, member.name)}
                        className="p-1 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded cursor-pointer"
                        title="Edit Name"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={members.length <= 1}
                        onClick={() => {
                          setDeleteError(null);
                          setMemberToDelete(member);
                        }}
                        id={`delete-member-screen-${member.user_id}`}
                        className={`p-1 rounded transition-colors ${
                          members.length <= 1
                            ? 'opacity-30 cursor-not-allowed text-[#78716C]'
                            : 'text-[#78716C] hover:text-[#DC2626] dark:hover:text-[#F87171] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'
                        }`}
                        title={
                          members.length <= 1
                            ? 'Cannot delete the only member in the household'
                            : `Remove ${member.name} from household`
                        }
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[10px] text-[#78716C] capitalize block">
                      {member.role} {member.email ? `· ${member.email}` : ''}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveMemberId(member.user_id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                  member.user_id === activeMember.user_id
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714]'
                    : 'border border-[#DCD5C9] text-[#78716C] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]'
                }`}
              >
                {member.user_id === activeMember.user_id ? 'Active' : 'Switch To'}
              </button>
            </div>
          ))}
        </div>

        {memberToDelete && (
          <div className="p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 dark:border-[#DC2626]/40 flex flex-col gap-2 mt-2 animate-in fade-in duration-150">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-bold text-[#DC2626] dark:text-[#F87171] block">
                  Remove {memberToDelete.name} from Household?
                </span>
                <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                  Historical transactions and reconciliations logged by {memberToDelete.name} remain safely preserved in the ledger.
                </p>
                {deleteError && (
                  <p className="text-[11px] text-[#DC2626] font-semibold mt-1">
                    {deleteError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#DC2626]/20">
              <button
                type="button"
                onClick={() => {
                  setMemberToDelete(null);
                  setDeleteError(null);
                }}
                className="px-2.5 py-1 text-xs rounded-lg text-[#78716C] dark:text-[#A8A29E] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                id="btn-confirm-delete-member-screen"
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
