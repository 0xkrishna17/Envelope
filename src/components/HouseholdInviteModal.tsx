import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Invite, Membership } from '../types';
import { HouseholdAccessManager } from './HouseholdAccessManager';
import { X, Copy, Check, Users, Clock, Shield, Share2, Edit2, Trash2, AlertTriangle } from 'lucide-react';

interface HouseholdInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HouseholdInviteModal: React.FC<HouseholdInviteModalProps> = ({
  isOpen,
  onClose,
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

  if (!isOpen) return null;

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
    // In AI Studio development, origin is 'ais-dev-...'. This is private to the developer and returns 401 Unauthorized to anyone else!
    // Replacing 'ais-dev-' with 'ais-pre-' generates the public shared URL that works for partners.
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#4E785E]" />
            <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              Household Sharing & Pairing
            </h2>
          </div>
          <button
            onClick={onClose}
            id="close-invite-modal"
            className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Members in household */}
          <div>
            <label className="text-xs font-medium text-[#78716C] block mb-2">
              Connected Household Members
            </label>
            <div className="flex flex-col gap-2">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span
                      className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center shadow-xs shrink-0"
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
                          className="text-xs px-2 py-1 rounded bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] text-[#1F1B16] dark:text-[#EDE8E1] w-full max-w-[140px] focus:outline-hidden focus:ring-1 focus:ring-[#4E785E]"
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
                        <div className="flex items-center gap-1.5">
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
                            id={`delete-member-${member.user_id}`}
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
                          {member.role}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveMemberId(member.user_id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                      member.user_id === activeMember.user_id
                        ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714]'
                        : 'border border-[#DCD5C9] text-[#78716C] hover:bg-[#EFEAE1]'
                    }`}
                  >
                    {member.user_id === activeMember.user_id ? 'Active' : 'Switch To'}
                  </button>
                </div>
              ))}
            </div>

            {memberToDelete && (
              <div className="p-3 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 dark:border-[#DC2626]/40 flex flex-col gap-2 mt-2 animate-in fade-in duration-150">
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
                    id="btn-confirm-delete-member"
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors cursor-pointer"
                  >
                    Confirm Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Google Account Allowlist & Access Control */}
          <div className="bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 p-4 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F]">
            <HouseholdAccessManager compact={true} />
          </div>

          {/* Invite Partner Link Section (§4.8) */}
          <div className="bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 p-4 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                Invite Partner (48h Expiring Link)
              </span>
              <Clock className="w-3.5 h-3.5 text-[#78716C]" />
            </div>

            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              Share this single-use link over WhatsApp or SMS. When your partner opens it, both of you share the exact same ledger, categories, and credit-card payback loop (§4.8).
            </p>

            {activeInvite ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-[#FAF7F2] dark:bg-[#1A1714] p-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F]">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-[#EFEAE1] dark:bg-[#28221D] rounded">
                    {activeInvite.code}
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="flex-1 text-[11px] text-[#78716C] bg-transparent truncate focus:outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    id="copy-invite-link-btn"
                    className="p-1.5 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={shareViaWhatsApp}
                    id="share-whatsapp-btn"
                    className="flex-1 py-2 px-3 rounded-xl bg-[#25D366] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#1EBE5D] transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="py-2 px-3 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#FAF7F2] dark:hover:bg-[#1A1714] text-xs font-medium text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer"
                  >
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </button>
                </div>

                {/* 401 Explanation Callout */}
                <div className="p-2.5 rounded-xl bg-[#F9ECE8]/70 dark:bg-[#331D16]/70 border border-[#E8C5BC] dark:border-[#5E261B] text-[11px] text-[#87341D] dark:text-[#F3B3A2] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#B85D43]" />
                    <span>Why did your partner get 401 Unauthorized?</span>
                  </div>
                  <p className="leading-relaxed">
                    Private dev URLs starting with <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">ais-dev-...</code> require developer login. We have automatically converted this invite link to the public preview (<code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">ais-pre-...</code>), which works seamlessly on your partner's phone!
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#78716C]">
                  <span>Valid for 48 hours</span>
                  <button
                    onClick={() => {
                      revokeInvite(activeInvite.id);
                      setActiveInvite(null);
                    }}
                    className="text-[#B85D43] hover:underline cursor-pointer"
                  >
                    Revoke / Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                id="generate-invite-link-btn"
                className="w-full py-2.5 px-3 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Generate New Partner Invite Link</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
