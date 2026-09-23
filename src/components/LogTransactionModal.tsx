import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useBudget } from '../context/BudgetContext';
import { PaymentMethod } from '../types';
import { rupeesToPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { X, Calendar, MessageSquare, Check, CreditCard, Landmark, Banknote, HelpCircle } from 'lucide-react';

interface LogTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCategoryId?: string;
  initialValues?: {
    amountPaise?: number;
    categoryId?: string;
    paymentMethod?: PaymentMethod;
    note?: string;
  };
}

export const LogTransactionModal: React.FC<LogTransactionModalProps> = ({
  isOpen,
  onClose,
  preselectedCategoryId,
  initialValues,
}) => {
  const {
    activeCategories,
    activeMember,
    transactions,
    addTransaction,
  } = useBudget();

  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('other');
  const [note, setNote] = useState<string>('');
  const [showNoteField, setShowNoteField] = useState<boolean>(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isRefund, setIsRefund] = useState<boolean>(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Compute most-recently-used categories by activeMember locally from transaction history (§4.2)
  const sortedCategories = useMemo(() => {
    const userTxs = transactions.filter(t => t.logged_by_user_id === activeMember.user_id && !t.deleted_at);
    const categoryFrequency = new Map<string, number>();

    // Weight recent usage heavily
    userTxs.forEach((tx, idx) => {
      const weight = Math.max(1, 100 - idx);
      categoryFrequency.set(tx.category_id, (categoryFrequency.get(tx.category_id) || 0) + weight);
    });

    return [...activeCategories].sort((a, b) => {
      // Keep unallocated last
      if (a.is_unallocated) return 1;
      if (b.is_unallocated) return -1;
      const scoreA = categoryFrequency.get(a.id) || 0;
      const scoreB = categoryFrequency.get(b.id) || 0;
      return scoreB - scoreA;
    });
  }, [activeCategories, transactions, activeMember.user_id]);

  // Default payment method in log is 'other'
  const defaultPaymentMethod: PaymentMethod = 'other';

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setAmountStr(initialValues.amountPaise ? (Math.abs(initialValues.amountPaise) / 100).toString() : '');
        setSelectedCategoryId(initialValues.categoryId || preselectedCategoryId || sortedCategories[0]?.id || '');
        setPaymentMethod(initialValues.paymentMethod || defaultPaymentMethod);
        setNote(initialValues.note || '');
        setShowNoteField(Boolean(initialValues.note));
        setIsRefund(initialValues.amountPaise ? initialValues.amountPaise < 0 : false);
      } else {
        setAmountStr('');
        setSelectedCategoryId(preselectedCategoryId || sortedCategories[0]?.id || '');
        setPaymentMethod(defaultPaymentMethod);
        setNote('');
        setShowNoteField(false);
        setIsRefund(false);
      }
      setDate(new Date().toISOString().split('T')[0]);

      // Focus amount field instantly for <5 sec entry rule
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, preselectedCategoryId, initialValues, sortedCategories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = rupeesToPaise(amountStr);
    if (!paise || !selectedCategoryId) return;

    const finalAmount = isRefund ? -Math.abs(paise) : Math.abs(paise);

    addTransaction({
      category_id: selectedCategoryId,
      amount: finalAmount,
      date,
      payment_method: paymentMethod,
      note: note.trim() || undefined,
    });

    onClose();
  };

  const selectedCategory = activeCategories.find(c => c.id === selectedCategoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              Log Expense
            </span>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${activeMember.avatar_color}20`,
                color: activeMember.avatar_color,
              }}
            >
              by {activeMember.name}
            </span>
          </div>
          <button
            onClick={onClose}
            id="close-log-tx-modal"
            className="p-1 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Amount Input with Large Typographic Field */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="tx-amount-input" className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
                Amount (₹ INR)
              </label>
              <button
                type="button"
                onClick={() => setIsRefund(!isRefund)}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                  isRefund
                    ? 'bg-[#EBF2ED] text-[#2C523B] dark:bg-[#1E2E24] dark:text-[#A8D1B7] font-semibold'
                    : 'text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]'
                }`}
              >
                {isRefund ? '✓ Refund Credit' : '+ Is this a refund?'}
              </button>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-2xl font-serif text-[#78716C] dark:text-[#A8A29E]">
                {isRefund ? '-₹' : '₹'}
              </span>
              <input
                ref={amountInputRef}
                id="tx-amount-input"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-3xl font-amount font-semibold text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none focus:ring-2 focus:ring-[#1F1B16] dark:focus:ring-[#EDE8E1]"
              />
            </div>
          </div>

          {/* Category Picker: Icon Grid ordered by Most-Recently-Used (§4.2) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
                Envelope Category
              </label>
              {selectedCategory && (
                <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                  {selectedCategory.name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
              {sortedCategories.map(cat => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    id={`cat-select-${cat.id}`}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-[#1F1B16] dark:border-[#EDE8E1] bg-[#FAF7F2] dark:bg-[#1A1714] shadow-xs'
                        : 'border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white mb-1 shadow-xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                    </div>
                    <span className="text-[11px] font-medium leading-tight truncate w-full text-[#1F1B16] dark:text-[#EDE8E1]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method Segmented Pills (§4.2) */}
          <div>
            <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#EFEAE1]/70 dark:bg-[#28221D]/70 p-1 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F]">
              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                id="method-credit-card"
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  paymentMethod === 'credit_card'
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Credit Card (Owed)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('secondary_account_debit')}
                id="method-spend-debit"
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  paymentMethod === 'secondary_account_debit'
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Spend A/c</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                id="method-cash"
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('other')}
                id="method-other"
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  paymentMethod === 'other'
                    ? 'bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Other</span>
              </button>
            </div>
            {paymentMethod === 'credit_card' && (
              <p className="text-[11px] text-[#AF7832] dark:text-[#E8C694] mt-1">
                Will mark envelope debited now and card payback as pending.
              </p>
            )}
          </div>

          {/* Date and Optional Note */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#78716C]" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                id="tx-date-input"
                className="bg-transparent text-xs font-medium text-[#1F1B16] dark:text-[#EDE8E1] border-b border-[#DCD5C9] dark:border-[#3D362F] pb-0.5 focus:outline-none"
              />
            </div>

            {!showNoteField ? (
              <button
                type="button"
                onClick={() => setShowNoteField(true)}
                className="flex items-center gap-1 text-xs text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            ) : null}
          </div>

          {showNoteField && (
            <input
              type="text"
              placeholder="e.g. Swiggy lunch, Organic milk, Petrol..."
              value={note}
              onChange={e => setNote(e.target.value)}
              id="tx-note-input"
              className="w-full px-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-lg text-xs text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none focus:ring-1 focus:ring-[#1F1B16]"
            />
          )}

          {/* Submit Button */}
          <button
            type="submit"
            id="save-tx-btn"
            disabled={!amountStr || !selectedCategoryId}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] font-medium text-sm flex items-center justify-center gap-2 shadow-xs hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save to Envelope (Instant)</span>
          </button>
        </form>
      </div>
    </div>
  );
};
