import React, { useState, useEffect, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import {
  X,
  PlusCircle,
  Check,
  Calendar,
  Wallet,
  Sparkles,
  Gift,
  Briefcase,
  TrendingUp,
  Tag,
  Banknote,
  Building2,
  HelpCircle,
  User,
} from 'lucide-react';

interface AddCategoryFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategoryId?: string;
  initialAmountRupees?: number;
}

const TOPUP_SOURCES = [
  { id: 'Gift / Family', label: 'Gift / Family', icon: Gift, color: '#B85D43' },
  { id: 'Reimbursement', label: 'Reimbursement', icon: Briefcase, color: '#486B88' },
  { id: 'Bonus / Extra', label: 'Bonus / Extra', icon: TrendingUp, color: '#2C523B' },
  { id: 'Cashback / Refund', label: 'Cashback / Refund', icon: Tag, color: '#AF7832' },
  { id: 'Cash Deposit', label: 'Cash on Hand', icon: Banknote, color: '#5B7065' },
  { id: 'Manual Top-Up', label: 'Other Top-Up', icon: PlusCircle, color: '#78716C' },
];

export const AddCategoryFundsModal: React.FC<AddCategoryFundsModalProps> = ({
  isOpen,
  onClose,
  initialCategoryId,
  initialAmountRupees,
}) => {
  const {
    categories,
    categoryBalances,
    members,
    activeMember,
    addCategoryFunds,
  } = useBudget();

  // Active envelopes excluding archived and deleted
  const activeEnvelopes = useMemo(() => {
    return categories.filter(c => !c.deleted_at && !c.is_archived);
  }, [categories]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('Gift / Family');
  const [depositHolding, setDepositHolding] = useState<'secondary_account' | 'cash' | 'primary_account'>('secondary_account');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loggedByUserId, setLoggedByUserId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setDate(today);

      const targetCatId = initialCategoryId && activeEnvelopes.some(c => c.id === initialCategoryId)
        ? initialCategoryId
        : (activeEnvelopes[0]?.id || '');
      setSelectedCategoryId(targetCatId);

      setAmountRupees(initialAmountRupees ? String(initialAmountRupees) : '');
      setSelectedSource('Gift / Family');
      setDepositHolding('secondary_account');
      setNote('');
      setLoggedByUserId(activeMember?.user_id || members[0]?.user_id || '');
      setErrorMessage(null);
    }
  }, [isOpen, initialCategoryId, initialAmountRupees, activeEnvelopes, activeMember, members]);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const selectedBalanceInfo = useMemo(() => {
    return categoryBalances.find(b => b.category.id === selectedCategoryId);
  }, [categoryBalances, selectedCategoryId]);

  const currentAvailablePaise = selectedBalanceInfo?.availableNow || 0;
  const parsedAmountPaise = useMemo(() => {
    const num = parseFloat(amountRupees);
    return isNaN(num) || num <= 0 ? 0 : rupeesToPaise(num);
  }, [amountRupees]);

  const projectedAvailablePaise = currentAvailablePaise + (depositHolding === 'primary_account' ? 0 : parsedAmountPaise);

  const handleQuickAdd = (rupees: number) => {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees(String(current + rupees));
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedCategoryId) {
      setErrorMessage('Please select an envelope to receive funds.');
      return;
    }

    if (parsedAmountPaise <= 0) {
      setErrorMessage('Please enter a valid amount greater than ₹0.');
      return;
    }

    const res = addCategoryFunds({
      categoryId: selectedCategoryId,
      amountPaise: parsedAmountPaise,
      source: selectedSource,
      note: note.trim() || undefined,
      date,
      depositHolding,
      transferred: depositHolding !== 'primary_account',
      loggedByUserId: loggedByUserId || activeMember.user_id,
    });

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to add funds to envelope.');
      return;
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-funds-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2C523B]/10 dark:bg-[#2C523B]/30 text-[#2C523B] dark:text-[#A8D1B7] flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="add-funds-modal-title" className="text-base font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
                Add Money to Envelope
              </h3>
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                Direct funding without going through monthly salary flow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-add-funds-modal-btn"
            className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 flex flex-col gap-4 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FDF2F0] dark:bg-[#2C1814] border border-[#E8C5BC] dark:border-[#5E261B] text-[#B85D43] dark:text-[#F3B3A2] text-xs">
              {errorMessage}
            </div>
          )}

          {/* 1. Envelope Selection */}
          <div>
            <label className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1.5">
              Select Envelope to Fund
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {activeEnvelopes.map(cat => {
                const bal = categoryBalances.find(b => b.category.id === cat.id)?.availableNow || 0;
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setErrorMessage(null);
                    }}
                    id={`select-envelope-btn-${cat.id}`}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-[#1F1B16] dark:text-[#EDE8E1] ring-1 ring-[#2C523B]'
                        : 'border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#201C18] text-[#78716C] dark:text-[#A8A29E] hover:border-[#DCD5C9]'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-xs shadow-2xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      {renderCategoryIcon(cat.icon, 'w-3.5 h-3.5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-[#1F1B16] dark:text-[#EDE8E1] text-[11px]">
                        {cat.name}
                      </div>
                      <div className="text-[10px] text-[#78716C] dark:text-[#A8A29E] font-amount">
                        {formatPaise(bal)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Amount Input & Quick Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="topup-amount-rupees" className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                Amount to Add (₹)
              </label>
              {selectedCategory && (
                <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                  Current available: <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{formatPaise(currentAvailablePaise)}</strong>
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#78716C] dark:text-[#A8A29E]">
                ₹
              </span>
              <input
                id="topup-amount-rupees"
                type="number"
                step="any"
                min="1"
                placeholder="0"
                value={amountRupees}
                onChange={e => {
                  setAmountRupees(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full pl-8 pr-4 py-2.5 text-xl font-amount font-bold rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-2 focus:ring-[#2C523B]"
                autoFocus
              />
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5">
              <span className="text-[10px] text-[#78716C] shrink-0 font-medium">Quick:</span>
              {[500, 1000, 2000, 5000, 10000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAdd(val)}
                  className="px-2 py-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-[10px] font-medium whitespace-nowrap transition-colors"
                >
                  +₹{val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Funding Origin / Reason */}
          <div>
            <label className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1.5">
              Funding Source
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {TOPUP_SOURCES.map(src => {
                const IconComponent = src.icon;
                const isSelected = selectedSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSelectedSource(src.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-[#1F1B16] dark:text-[#EDE8E1] font-semibold ring-1 ring-[#2C523B]'
                        : 'border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#201C18] text-[#78716C] dark:text-[#A8A29E] hover:border-[#DCD5C9]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" style={{ color: src.color }} />
                    <span className="truncate text-[11px]">{src.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Deposit Location / Holding Account */}
          <div>
            <label className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1.5">
              Where is the money held?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDepositHolding('secondary_account')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  depositHolding === 'secondary_account'
                    ? 'border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-[#1F1B16] dark:text-[#EDE8E1] ring-1 ring-[#2C523B]'
                    : 'border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#201C18] text-[#78716C] dark:text-[#A8A29E] hover:border-[#DCD5C9]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[#1F1B16] dark:text-[#EDE8E1]">
                  <Wallet className="w-3.5 h-3.5 text-[#2C523B]" />
                  <span>Spend Account / UPI</span>
                </div>
                <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mt-1 leading-tight">
                  Available in envelope immediately
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDepositHolding('cash')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  depositHolding === 'cash'
                    ? 'border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-[#1F1B16] dark:text-[#EDE8E1] ring-1 ring-[#2C523B]'
                    : 'border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#201C18] text-[#78716C] dark:text-[#A8A29E] hover:border-[#DCD5C9]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[#1F1B16] dark:text-[#EDE8E1]">
                  <Banknote className="w-3.5 h-3.5 text-[#AF7832]" />
                  <span>Cash on Hand</span>
                </div>
                <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mt-1 leading-tight">
                  Physical cash envelope; available now
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDepositHolding('primary_account')}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  depositHolding === 'primary_account'
                    ? 'border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-[#1F1B16] dark:text-[#EDE8E1] ring-1 ring-[#2C523B]'
                    : 'border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#201C18] text-[#78716C] dark:text-[#A8A29E] hover:border-[#DCD5C9]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[#1F1B16] dark:text-[#EDE8E1]">
                  <Building2 className="w-3.5 h-3.5 text-[#486B88]" />
                  <span>Primary Salary A/c</span>
                </div>
                <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mt-1 leading-tight">
                  Adds to Bank Transfer Checklist
                </p>
              </button>
            </div>
          </div>

          {/* 5. Date & Logged By Member */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="topup-date" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
                Date
              </label>
              <div className="relative">
                <input
                  id="topup-date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="topup-logged-by" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
                Received / Logged By
              </label>
              <select
                id="topup-logged-by"
                value={loggedByUserId}
                onChange={e => setLoggedByUserId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B]"
              >
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Memo / Note */}
          <div>
            <label htmlFor="topup-note" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
              Note (Optional)
            </label>
            <input
              id="topup-note"
              type="text"
              placeholder="e.g. Birthday gift from grandparents, office travel claim approved"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B]"
            />
          </div>

          {/* Summary Preview Box */}
          {parsedAmountPaise > 0 && selectedCategory && (
            <div className="p-3 rounded-xl bg-[#EFEAE1]/70 dark:bg-[#28221D]/70 border border-[#E8E3DA] dark:border-[#2D2823] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E] block">
                  Envelope outcome:
                </span>
                <span className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                  {selectedCategory.name} Available Now
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#2C523B] dark:text-[#A8D1B7] font-semibold block">
                  +{formatPaise(parsedAmountPaise)}
                </span>
                <span className="text-xs font-amount font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
                  {formatPaise(projectedAvailablePaise)}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E8E3DA] dark:border-[#2D2823]">
            <button
              type="button"
              onClick={onClose}
              id="cancel-add-funds-btn"
              className="px-4 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] dark:text-[#A8A29E] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="confirm-add-funds-btn"
              disabled={parsedAmountPaise <= 0 || !selectedCategoryId}
              className="px-5 py-2.5 rounded-xl bg-[#2C523B] hover:bg-[#23422F] text-white font-semibold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>
                Add {parsedAmountPaise > 0 ? formatPaise(parsedAmountPaise) : 'Funds'} to Envelope
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
