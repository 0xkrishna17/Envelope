import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useApiLoading } from '../context/ApiLoadingContext';
import { X, Home, PlusCircle, Sparkles, Shield, Users, Check, ArrowRight } from 'lucide-react';

interface CreateHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateHouseholdModal: React.FC<CreateHouseholdModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { createNewHousehold } = useBudget();
  const { showToast } = useApiLoading();
  const [householdName, setHouseholdName] = useState(
    user?.displayName ? `${user.displayName.split(' ')[0]}'s Household` : 'Our Family Budget'
  );
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = householdName.trim() || 'Our Family Budget';
    setIsCreating(true);
    try {
      const newId = await createNewHousehold(name);
      showToast(`Created household "${name}" successfully!`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Error creating household:', err);
      showToast('Failed to create household: ' + (err.message || err), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-3xl p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#4E785E]/10 text-[#4E785E] flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
                Create New Household
              </h2>
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                Start a fresh, private envelope budget
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1.5">
              Household Name
            </label>
            <input
              type="text"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="e.g. Sharma Family Budget"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#141210] text-sm text-[#1F1B16] dark:text-[#EDE8E1] focus:ring-2 focus:ring-[#4E785E] outline-none"
            />
          </div>

          {/* Account Status / Ownership Info */}
          <div className="p-3.5 rounded-xl bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] text-xs space-y-2">
            <div className="flex items-center gap-2 text-[#4E785E] font-medium text-[11px]">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>
                {user ? 'Google Account Protected' : 'Open Local Workspace'}
              </span>
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              {user ? (
                <>
                  You are signed in as <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{user.email}</strong>. You will be set as the primary owner. You can allowlist your spouse or family Google emails so both can view & edit the same dashboard.
                </>
              ) : (
                <>
                  You are not currently signed in. This will create a fresh workspace you can test immediately. You can sign in with Google anytime in Settings to lock it to your family allowlist.
                </>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] text-xs font-medium text-[#78716C] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !householdName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4E785E] text-white text-xs font-semibold hover:bg-[#436851] transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {isCreating ? (
                <span>Creating...</span>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Household</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
