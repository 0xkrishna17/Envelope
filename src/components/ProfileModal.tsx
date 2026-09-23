import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  User,
  Check,
  Sparkles,
  Trash2,
  Shield,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnboarding?: boolean;
}

const PRESET_COLORS = [
  '#4E785E', // Sage Green
  '#B85D43', // Terracotta Rust
  '#486B88', // Slate Navy
  '#8B687F', // Dusty Plum
  '#AF7832', // Warm Amber
  '#3E7072', // Teal Forest
  '#7A5F48', // Mocha
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  isOnboarding = false,
}) => {
  const { members, activeMember, updateMemberProfile, setActiveMemberId, householdId } = useBudget();
  const { user } = useAuth();

  const [name, setName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarColor, setAvatarColor] = useState<string>('#4E785E');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [copiedHh, setCopiedHh] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize fields from active member or Google user
  useEffect(() => {
    if (isOpen) {
      if (activeMember) {
        setName(activeMember.name === 'You' ? '' : (activeMember.name || ''));
        setAvatarUrl(activeMember.avatar_url || (user?.photoURL || undefined));
        setAvatarColor(activeMember.avatar_color || '#4E785E');
        setSelectedMemberId(activeMember.user_id);
      } else if (user) {
        setName(user.displayName || '');
        setAvatarUrl(user.photoURL || undefined);
      }
      setSavedSuccess(false);
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

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = name.trim() || (activeMember?.name && activeMember.name !== 'You' ? activeMember.name : '') || 'You';
    const targetUserId = selectedMemberId || activeMember?.user_id;

    if (targetUserId) {
      updateMemberProfile(targetUserId, {
        name: finalName,
        avatar_url: avatarUrl || '',
        avatar_color: avatarColor,
      });
      setActiveMemberId(targetUserId);
    }

    localStorage.setItem('env_budget_profile_completed', 'true');
    localStorage.setItem('env_budget_user_name', finalName);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  const handleCopyHousehold = () => {
    navigator.clipboard.writeText(householdId);
    setCopiedHh(true);
    setTimeout(() => setCopiedHh(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl relative text-[#1F1B16] dark:text-[#EDE8E1]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded-full transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="w-8 h-8 rounded-xl bg-[#4E785E]/15 text-[#4E785E] flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight leading-tight">
              {isOnboarding ? 'Welcome! Set Up Your Profile' : 'My Profile & Photo'}
            </h2>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              {isOnboarding
                ? 'Tell us your name and optionally add a photo for your household'
                : 'Custom name, profile photo, and avatar color'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Photo / Avatar Section */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#E8E3DA] dark:border-[#2D2823]">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || 'Profile'}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#FAF7F2] dark:border-[#1A1714] shadow-xs"
                />
              ) : (
                <div
                  style={{ backgroundColor: avatarColor }}
                  className="w-14 h-14 rounded-full text-white flex items-center justify-center text-xl font-bold border-2 border-[#FAF7F2] dark:border-[#1A1714] shadow-xs"
                >
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
                        setName(m.name);
                        setAvatarUrl(m.avatar_url);
                        setAvatarColor(m.avatar_color);
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
                          alt={m.name}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span
                          style={{ backgroundColor: m.avatar_color }}
                          className="w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                        >
                          {m.name.charAt(0)}
                        </span>
                      )}
                      <div className="truncate">
                        <span className="text-xs truncate block">{m.name}</span>
                        <span className="text-[10px] text-[#78716C] capitalize block">{m.role}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Avatar Color Swatches */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block mb-1.5">
              Avatar Color
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                    avatarColor === color ? 'scale-125 ring-2 ring-offset-2 ring-[#1F1B16] dark:ring-[#EDE8E1]' : 'hover:scale-110'
                  }`}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Household Context */}
          <div className="pt-2 border-t border-[#E8E3DA]/60 dark:border-[#2D2823]/60 flex items-center justify-between text-[11px] text-[#78716C] dark:text-[#A8A29E]">
            <span className="truncate">Household ID: <strong className="font-mono">{householdId}</strong></span>
            <button
              type="button"
              onClick={handleCopyHousehold}
              className="flex items-center gap-1 text-[#486B88] font-medium hover:underline cursor-pointer"
            >
              {copiedHh ? <Check className="w-3 h-3 text-[#4E785E]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHh ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] text-xs font-medium hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-profile-btn"
              className="flex-1 py-2 px-3 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4E785E]" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>{isOnboarding ? 'Save & Start Budgeting' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
