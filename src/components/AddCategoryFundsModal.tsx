import React, { useState, useEffect, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import { getMemberDisplayName } from '../utils/memberDisplay';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { useActionFeedback } from '../hooks/useActionFeedback';
import { clampDateInputToToday, getTodayDateInputValue } from '../utils/dateUtils';
import {
  ArrowLeft,
  X,
  PlusCircle,
  Check,
  ChevronDown,
  Gift,
  Briefcase,
  TrendingUp,
  Tag,
  Banknote,
  Layers,
} from 'lucide-react';

interface AddCategoryFundsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  initialCategoryId?: string;
  initialAmountRupees?: number;
}

const TOPUP_SOURCES = [
  { id: 'Unallocated Surplus', label: 'Unallocated Surplus', icon: Layers, color: '#486B88' },
  { id: 'Gift / Family', label: 'Gift / Family', icon: Gift, color: '#B85D43' },
  { id: 'Reimbursement', label: 'Reimbursement', icon: Briefcase, color: '#486B88' },
  { id: 'Bonus / Extra', label: 'Bonus / Extra', icon: TrendingUp, color: '#2C523B' },
  { id: 'Cashback / Refund', label: 'Cashback / Refund', icon: Tag, color: '#AF7832' },
  { id: 'Cash Deposit', label: 'Cash on Hand', icon: Banknote, color: '#5B7065' },
  { id: 'Manual Top-Up', label: 'Other Top-Up', icon: PlusCircle, color: '#78716C' },
];

export const AddFundsScreen: React.FC<AddCategoryFundsModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  initialCategoryId,
  initialAmountRupees,
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };
  const {
    categories,
    categoryBalances,
    members,
    activeMember,
    addCategoryFunds,
    moveEnvelopeFunds,
  } = useBudget();
  const feedback = useActionFeedback();

  // Active envelopes excluding archived and deleted
  const activeEnvelopes = useMemo(() => {
    return categories.filter(c => !c.deleted_at && !c.is_archived);
  }, [categories]);

  const unallocatedCat = useMemo(() => {
    return categories.find(c => c.is_unallocated);
  }, [categories]);

  const unallocatedBalance = useMemo(() => {
    if (!unallocatedCat) return 0;
    const b = categoryBalances.find(info => info.category.id === unallocatedCat.id);
    return b ? b.availableNow : 0;
  }, [categoryBalances, unallocatedCat]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('Gift / Family');
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState<boolean>(false);
  const [isLoggedByMenuOpen, setIsLoggedByMenuOpen] = useState<boolean>(false);
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loggedByUserId, setLoggedByUserId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen) {
      const today = getTodayDateInputValue();
      setDate(today);

      const isInitUnallocated = initialCategoryId && unallocatedCat && initialCategoryId === unallocatedCat.id;

      // If initial was unallocated envelope, user wants to add money FROM surplus into an envelope!
      const targetCatId = isInitUnallocated
        ? (activeEnvelopes.find(c => !c.is_unallocated)?.id || activeEnvelopes[0]?.id || '')
        : (initialCategoryId && activeEnvelopes.some(c => c.id === initialCategoryId)
            ? initialCategoryId
            : (activeEnvelopes[0]?.id || ''));
      setSelectedCategoryId(targetCatId);

      setAmountRupees(initialAmountRupees ? String(initialAmountRupees) : '');
      setSelectedSource(isInitUnallocated ? 'Unallocated Surplus' : 'Gift / Family');
      setNote('');
      setLoggedByUserId(activeMember?.user_id || members[0]?.user_id || '');
      setIsSourceMenuOpen(false);
      setIsLoggedByMenuOpen(false);
      setErrorMessage(null);
    }
  }, [isOpen, initialCategoryId, initialAmountRupees, activeEnvelopes, activeMember, members, unallocatedCat]);

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

  const selectedSourceOption = useMemo(() => {
    return TOPUP_SOURCES.find(src => src.id === selectedSource) || TOPUP_SOURCES[0];
  }, [selectedSource]);

  const selectedLoggedByMember = useMemo(() => {
    return members.find(m => m.user_id === loggedByUserId);
  }, [members, loggedByUserId]);

  const resolvedDepositHolding = selectedSource === 'Cash Deposit' ? 'cash' : 'secondary_account';
  const projectedAvailablePaise = currentAvailablePaise + parsedAmountPaise;

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

    if (selectedSource === 'Unallocated Surplus') {
      if (!unallocatedCat) {
        setErrorMessage('Unallocated Surplus envelope not found.');
        return;
      }
      if (selectedCategoryId === unallocatedCat.id) {
        setErrorMessage('Please select a different envelope to receive money from Surplus.');
        return;
      }
      if (parsedAmountPaise > unallocatedBalance) {
        setErrorMessage(`Insufficient surplus funds. Only ${formatPaise(unallocatedBalance)} available in Unallocated Surplus.`);
        return;
      }

      const res = moveEnvelopeFunds({
        fromCategoryId: unallocatedCat.id,
        toCategoryId: selectedCategoryId,
        amountPaise: parsedAmountPaise,
        date: clampDateInputToToday(date),
        note: note.trim() || 'Funded from Unallocated Surplus',
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to allocate funds from surplus.');
        return;
      }

      handleBack();
      feedback.fundsMoved(parsedAmountPaise, unallocatedCat.name, selectedCategory?.name || 'Envelope');
      return;
    }

    const res = addCategoryFunds({
      categoryId: selectedCategoryId,
      amountPaise: parsedAmountPaise,
      source: selectedSource,
      note: note.trim() || undefined,
      date: clampDateInputToToday(date),
      depositHolding: resolvedDepositHolding,
      transferred: true,
      loggedByUserId: loggedByUserId || activeMember.user_id,
    });

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to add funds to envelope.');
      return;
    }

    handleBack();
    feedback.fundsAdded(parsedAmountPaise, selectedCategory?.name || 'Envelope');
  };

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-3xl mx-auto pb-24 animate-in fade-in duration-200">
      {/* Screen Navigation Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <button
          type="button"
          onClick={handleBack}
          id="close-add-funds-modal-btn"
          className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2.5 sm:py-1.5 rounded-xl bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#78716C]" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2C523B]/10 dark:bg-[#2C523B]/30 text-[#2C523B] dark:text-[#A8D1B7] flex items-center justify-center shrink-0">
            <PlusCircle className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            Add Money to Envelope
          </h2>
        </div>
      </div>

      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs overflow-hidden">
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 flex flex-col gap-5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FDF2F0] dark:bg-[#2C1814] border border-[#E8C5BC] dark:border-[#5E261B] text-[#B85D43] dark:text-[#F3B3A2] text-xs">
              {errorMessage}
            </div>
          )}

          {/* 1. Envelope Selection */}
          <div>
            <label className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1.5">
              Envelope to Fund
            </label>
            {initialCategoryId && selectedCategory && selectedCategory.id === initialCategoryId && !selectedCategory.is_unallocated ? (
              <div
                id="locked-selected-envelope-card"
                className="flex items-center gap-3 p-3 rounded-xl border border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-left ring-1 ring-[#2C523B]"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: selectedCategory.color }}
                >
                  {renderCategoryIcon(selectedCategory.icon, 'w-4 h-4')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate text-[#1F1B16] dark:text-[#EDE8E1] text-sm">
                    {selectedCategory.name}
                  </div>
                  <div className="text-xs text-[#78716C] dark:text-[#A8A29E] font-amount">
                    Current available: {formatPaise(currentAvailablePaise)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 sm:max-h-32 overflow-y-auto pr-1">
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
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all min-w-0 ${
                        isSelected
                          ? 'border-[#2C523B] bg-[#2C523B]/10 dark:bg-[#2C523B]/20 text-[#1F1B16] dark:text-[#EDE8E1] ring-1 ring-[#2C523B]'
                          : 'border-[#E8E3DA] dark:border-[#2D2823] bg-white dark:bg-[#201C18] text-[#78716C] dark:text-[#A8A29E] hover:border-[#DCD5C9]'
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 text-xs shadow-2xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        {renderCategoryIcon(cat.icon, 'w-3 h-3')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-[#1F1B16] dark:text-[#EDE8E1] text-[10px] leading-tight">
                          {cat.name}
                        </div>
                        <div className="text-[9px] text-[#78716C] dark:text-[#A8A29E] font-amount leading-tight">
                          {formatPaise(bal)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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

          {/* 3. Funding Source & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="topup-funding-source" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
                Funding Source
              </label>
              <div className="relative">
                <button
                  type="button"
                  id="topup-funding-source"
                  aria-haspopup="listbox"
                  aria-expanded={isSourceMenuOpen}
                  onClick={() => {
                    setIsSourceMenuOpen(prev => !prev);
                    setIsLoggedByMenuOpen(false);
                  }}
                  className="w-full min-h-11 sm:min-h-10 px-3 py-2 text-sm sm:text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B] flex items-center justify-between gap-2 text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {React.createElement(selectedSourceOption.icon, {
                      className: 'w-3.5 h-3.5 shrink-0',
                      style: { color: selectedSourceOption.color },
                    })}
                    <span className="truncate">{selectedSourceOption.label}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-[#78716C] transition-transform ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSourceMenuOpen && (
                  <div
                    id="topup-funding-source-menu"
                    role="listbox"
                    aria-labelledby="topup-funding-source"
                    className="absolute z-30 mt-1 w-full rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] shadow-lg overflow-hidden"
                  >
                    {TOPUP_SOURCES.map(src => {
                      const IconComponent = src.icon;
                      const isSelected = selectedSource === src.id;
                      return (
                        <button
                          key={src.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedSource(src.id);
                            setIsSourceMenuOpen(false);
                            setErrorMessage(null);
                          }}
                          className={`w-full min-h-10 px-3 py-2 text-left text-sm sm:text-xs flex items-center gap-2 transition-colors ${
                            isSelected
                              ? 'bg-[#2C523B]/10 text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]'
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5 shrink-0" style={{ color: src.color }} />
                          <span className="truncate">{src.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedSource === 'Unallocated Surplus' && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-[#486B88]/10 border border-[#486B88]/25 text-xs flex items-center justify-between text-[#1F1B16] dark:text-[#EDE8E1]">
                  <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-[#486B88]" />
                    Available in Unallocated Surplus:
                  </span>
                  <strong className="font-amount font-semibold text-[#486B88]">{formatPaise(unallocatedBalance)}</strong>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="topup-date" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
                Date
              </label>
              <input
                id="topup-date"
                type="date"
                value={date}
                max={getTodayDateInputValue()}
                onChange={e => setDate(clampDateInputToToday(e.target.value))}
                className="w-full min-h-11 sm:min-h-10 px-3 py-2 text-sm sm:text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B]"
              />
            </div>
          </div>

          {/* 4. Logged By & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="topup-logged-by" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
                Received / Logged By
              </label>
              <div className="relative">
                <button
                  type="button"
                  id="topup-logged-by"
                  aria-haspopup="listbox"
                  aria-expanded={isLoggedByMenuOpen}
                  onClick={() => {
                    setIsLoggedByMenuOpen(prev => !prev);
                    setIsSourceMenuOpen(false);
                  }}
                  className="w-full min-h-11 sm:min-h-10 px-3 py-2 text-sm sm:text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B] flex items-center justify-between gap-2 text-left"
                >
                  <span className="truncate">
                    {selectedLoggedByMember ? `${getMemberDisplayName(selectedLoggedByMember)} (${selectedLoggedByMember.role})` : 'Select member'}
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-[#78716C] transition-transform ${isLoggedByMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isLoggedByMenuOpen && (
                  <div
                    id="topup-logged-by-menu"
                    role="listbox"
                    aria-labelledby="topup-logged-by"
                    className="absolute z-30 mt-1 w-full rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] shadow-lg overflow-hidden"
                  >
                    {members.map(m => {
                      const isSelected = loggedByUserId === m.user_id;
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setLoggedByUserId(m.user_id);
                            setIsLoggedByMenuOpen(false);
                          }}
                          className={`w-full min-h-10 px-3 py-2 text-left text-sm sm:text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#2C523B]/10 text-[#1F1B16] dark:text-[#EDE8E1] font-semibold'
                              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]'
                          }`}
                        >
                          {getMemberDisplayName(m)} ({m.role})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="topup-note" className="block font-semibold text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
                Note (Optional)
              </label>
              <input
                id="topup-note"
                type="text"
                placeholder="e.g. Birthday gift, reimbursement"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full min-h-11 sm:min-h-10 px-3 py-2 text-sm sm:text-xs rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-white dark:bg-[#201C18] text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-hidden focus:ring-1 focus:ring-[#2C523B]"
              />
            </div>
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
              onClick={handleBack}
              id="cancel-add-funds-btn"
              className="px-4 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] dark:text-[#A8A29E] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] font-medium text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="confirm-add-funds-btn"
              disabled={parsedAmountPaise <= 0 || !selectedCategoryId}
              className="px-5 py-2.5 rounded-xl bg-[#2C523B] hover:bg-[#23422F] text-white font-semibold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
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

export const AddCategoryFundsModal = AddFundsScreen;

