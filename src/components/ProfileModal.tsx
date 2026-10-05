import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  X,
  Camera,
  Upload,
  User,
  Sparkles,
  Trash2,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { getMemberDisplayName, getMemberInitial } from '../utils/memberDisplay';
import { useActionFeedback } from '../hooks/useActionFeedback';

interface ProfileModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  isOnboarding?: boolean;
}

export const ProfileScreen: React.FC<ProfileModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  isOnboarding = false,
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };
  const { members, activeMember, updateMemberProfile, setActiveMemberId } = useBudget();
  const { user, markUserProfileCompleted } = useAuth();
  const feedback = useActionFeedback();

  const [name, setName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize fields from active member or Google user
  useEffect(() => {
    if (isOpen) {
      if (activeMember) {
        const googleFallbackName = user?.displayName || user?.email?.split('@')[0] || '';
        const memberName = activeMember.name && activeMember.name !== 'You'
          ? getMemberDisplayName(activeMember)
          : googleFallbackName;
        setName(memberName);
        setAvatarUrl(activeMember.avatar_url || (user?.photoURL || undefined));
        setSelectedMemberId(activeMember.user_id);
      } else if (user) {
        setName(user.displayName || '');
        setAvatarUrl(user.photoURL || undefined);
      }
    }
  }, [isOpen, activeMember, user]);

  if (!isOpen) return null;

  // Handle local image file upload with downscaling/compression to compact data URL
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Draw into 200x200 canvas for fast loading & compact storage in Firestore/localStorage
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Crop square centering
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setAvatarUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = name.trim()
      || (activeMember?.name && activeMember.name !== 'You' ? activeMember.name : '')
      || user?.displayName
      || user?.email?.split('@')[0]
      || 'You';
    const targetUserId = selectedMemberId || activeMember?.user_id;

    if (targetUserId) {
      updateMemberProfile(targetUserId, {
        name: finalName,
        avatar_url: avatarUrl || '',
      });
      setActiveMemberId(targetUserId);
    }

    localStorage.setItem('env_budget_profile_completed', 'true');
    if (user?.uid) {
      localStorage.setItem(`env_budget_profile_completed_${user.uid}`, 'true');
    }
    localStorage.setItem('env_budget_user_name', finalName);
    void markUserProfileCompleted();
    handleBack();
    feedback.profileSaved();
  };

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-2xl mx-auto pb-24 animate-in fade-in duration-200">
      {/* Screen Navigation Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <button
          type="button"
          onClick={handleBack}
          id="close-profile-screen-btn"
          className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2.5 sm:py-1.5 rounded-xl bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#78716C]" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#4E785E]/15 text-[#4E785E] flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            {isOnboarding ? 'Set Up Your Profile' : 'Profile & Member Details'}
          </h2>
        </div>
      </div>

      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl shadow-xs overflow-hidden text-[#1F1B16] dark:text-[#EDE8E1]">
        {/* Subtitle Bar */}
        <div className="px-5 py-3 border-b border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30">
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
            {isOnboarding
              ? 'Tell your household members what name to show when you log spending'
              : 'Customize your avatar and display name for shared activity'}
          </p>
        </div>

        <div className="p-5 sm:p-7">
          <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Photo / Avatar Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 p-3 rounded-2xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#E8E3DA] dark:border-[#2D2823]">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || 'Profile'}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#FAF7F2] dark:border-[#1A1714] shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#4E785E]/15 text-[#4E785E] dark:bg-[#A8D1B7]/15 dark:text-[#A8D1B7] flex items-center justify-center text-xl font-bold border-2 border-[#FAF7F2] dark:border-[#1A1714] shadow-xs">

                  {name ? name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change Photo"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] hover:scale-105 transition-transform shadow-xs cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold block text-[#1F1B16] dark:text-[#EDE8E1]">
                Profile Photo
              </span>
              <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mb-2">
                Upload a photo from your phone or camera
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  id="profile-photo-upload-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-[#28221D] border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#FAF7F2] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload</span>
                </button>

                {user?.photoURL && avatarUrl !== user.photoURL && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(user.photoURL || undefined)}
                    className="px-2 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-[#28221D] border border-[#DCD5C9] dark:border-[#3D362F] text-[#486B88] hover:bg-[#FAF7F2] cursor-pointer transition-colors"
                  >
                    Google Photo
                  </button>
                )}

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="p-1 text-[11px] text-[#B85D43] hover:text-[#913822] rounded-lg transition-colors cursor-pointer"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex, Sam, or Jordan"
              autoFocus={isOnboarding}
              id="profile-name-input"
              className="w-full px-3 py-2 bg-white dark:bg-black/20 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#1F1B16]"
            />
          </div>

          {/* Switch Active Member Profile in Household */}
          {members.length > 1 && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block mb-1">
                Select Your Profile in this Ledger:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {members.map(m => {
                  const isSelected = selectedMemberId === m.user_id;
                  return (
                    <button
                      type="button"
                      key={m.user_id}
                      onClick={() => {
                        setSelectedMemberId(m.user_id);
                        setName(getMemberDisplayName(m));
                        setAvatarUrl(m.avatar_url);
                      }}
                      className={`p-2 rounded-xl text-left border flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#1F1B16] dark:border-[#EDE8E1] bg-white dark:bg-[#28221D] shadow-2xs font-semibold'
                          : 'border-[#E8E3DA] dark:border-[#2D2823] bg-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      {m.avatar_url ? (
                        <img
                          src={m.avatar_url}
                          alt={getMemberDisplayName(m)}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-[#4E785E]/15 text-[#4E785E] dark:bg-[#A8D1B7]/15 dark:text-[#A8D1B7] text-[11px] font-bold flex items-center justify-center shrink-0">

                          {getMemberInitial(m)}
                        </span>
                      )}
                      <div className="truncate">
                        <span className="text-xs truncate block">{getMemberDisplayName(m)}</span>
                        <span className="text-[10px] text-[#78716C] capitalize block">{m.role}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Household Context */}
          <div className="pt-2 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
            <span>Your profile is used to label transactions and shared household activity.</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-2 px-3 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] text-xs font-medium hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-profile-btn"
              className="flex-1 py-2 px-3 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{isOnboarding ? 'Save & Start Budgeting' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export const ProfileModal = ProfileScreen;

