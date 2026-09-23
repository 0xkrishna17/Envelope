import React, { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Transaction, PaymentMethod } from '../types';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { X, Trash2, Check, Lock, AlertCircle, RefreshCw } from 'lucide-react';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  const {
    activeCategories,
    updateTransaction,
    deleteTransaction,
    logCorrection,
    members,
  } = useBudget();

  const [amountStr, setAmountStr] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [showCorrectionDialog, setShowCorrectionDialog] = useState<boolean>(false);
  const [correctionDifference, setCorrectionDifference] = useState<string>('');
  const [correctionNote, setCorrectionNote] = useState<string>('');

  useEffect(() => {
    if (transaction && isOpen) {
      setAmountStr((Math.abs(transaction.amount) / 100).toString());
      setCategoryId(transaction.category_id);
      setPaymentMethod(transaction.payment_method);
      setDate(transaction.date);
      setNote(transaction.note || '');
      setShowCorrectionDialog(false);
      setCorrectionDifference('');
      setCorrectionNote('');
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const isLocked = transaction.reconciliation_status === 'partially_reconciled' || transaction.reconciliation_status === 'reconciled';
  const member = members.find(m => m.user_id === transaction.logged_by_user_id);
  const currentCategory = activeCategories.find(c => c.id === transaction.category_id);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    if (isLocked) {
      // Amount and category are locked, only date and note can be updated
      updateTransaction(transaction.id, {
        date,
        note: note.trim() || undefined,
      });
    } else {
      const paise = rupeesToPaise(amountStr);
      if (!paise || !categoryId) return;
      const isNegative = transaction.amount < 0;
      const finalPaise = isNegative ? -Math.abs(paise) : Math.abs(paise);

      updateTransaction(transaction.id, {
        amount: finalPaise,
        category_id: categoryId,
        payment_method: paymentMethod,
        date,
        note: note.trim() || undefined,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (isLocked) {
      alert('This transaction has already been partially or fully reconciled in a credit card payback. You cannot delete it directly. Please use "Log a correction" to offset the amount.');
      return;
    }
    if (window.confirm('Delete this transaction? The category balance will recompute instantly.')) {
      deleteTransaction(transaction.id);
      onClose();
    }
  };

  const handleCreateCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    const diffPaise = rupeesToPaise(correctionDifference);
    if (!diffPaise) return;

    logCorrection(transaction, diffPaise, correctionNote || `Correction for tx #${transaction.id.slice(-4)}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              Edit Entry
            </span>
            <span className="text-xs text-[#78716C] ml-2">
              (Logged by {member?.name || 'Partner'})
            </span>
          </div>
          <button
            onClick={onClose}
            id="close-edit-tx-modal"
            className="p-1 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Locked warning banner if reconciled (§4.3) */}
        {isLocked && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[#F7EFE4] dark:bg-[#312415] border border-[#E5D4B8] dark:border-[#4A3721] text-xs text-[#7A4E15] dark:text-[#E8C694] flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Amount & Category Locked</strong>
              This transaction has already been {transaction.reconciliation_status === 'reconciled' ? 'fully paid off' : 'partially paid off'} in a credit card payback.
              To adjust the balance, log a correction entry below.
            </div>
          </div>
        )}

        {showCorrectionDialog ? (
          /* Correction Entry Form (§4.3) */
          <form onSubmit={handleCreateCorrection} className="p-5 flex flex-col gap-4">
            <div className="text-xs text-[#78716C]">
              Log an offsetting transaction in <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">{currentCategory?.name}</strong> to adjust for an error.
            </div>

            <div>
              <label className="text-xs font-medium text-[#78716C] block mb-1">
                Correction Amount (₹) — Enter negative for credit/reduction
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-lg font-serif text-[#78716C]">₹</span>
                <input
                  type="number"
                  step="any"
                  placeholder="-500"
                  value={correctionDifference}
                  onChange={e => setCorrectionDifference(e.target.value)}
                  required
                  autoFocus
                  id="correction-amount-input"
                  className="w-full pl-8 pr-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-lg font-amount font-semibold text-[#1F1B16] dark:text-[#EDE8E1]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#78716C] block mb-1">
                Reason / Note
              </label>
              <input
                type="text"
                placeholder="e.g. Overcharged by ₹300, merchant refunded"
                value={correctionNote}
                onChange={e => setCorrectionNote(e.target.value)}
                id="correction-note-input"
                className="w-full px-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#1F1B16] dark:text-[#EDE8E1]"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCorrectionDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#DCD5C9] text-xs font-medium text-[#78716C]"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-correction-btn"
                className="flex-1 py-2.5 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold"
              >
                Log Correction
              </button>
            </div>
          </form>
        ) : (
          /* Main Edit Form */
          <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                Amount (₹ INR) {isLocked && '• Locked'}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xl font-serif text-[#78716C]">
                  {transaction.amount < 0 ? '-₹' : '₹'}
                </span>
                <input
                  type="number"
                  step="any"
                  value={amountStr}
                  disabled={isLocked}
                  onChange={e => setAmountStr(e.target.value)}
                  id="edit-amount-input"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-2xl font-amount font-semibold ${
                    isLocked
                      ? 'bg-transparent border border-dashed border-[#DCD5C9] text-[#78716C] cursor-not-allowed'
                      : 'bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] text-[#1F1B16] dark:text-[#EDE8E1]'
                  }`}
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                Category {isLocked && '• Locked'}
              </label>
              <select
                value={categoryId}
                disabled={isLocked}
                onChange={e => setCategoryId(e.target.value)}
                id="edit-category-select"
                className={`w-full px-3 py-2 rounded-xl text-xs font-medium ${
                  isLocked
                    ? 'bg-transparent border border-dashed border-[#DCD5C9] text-[#78716C] cursor-not-allowed'
                    : 'bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] text-[#1F1B16] dark:text-[#EDE8E1]'
                }`}
              >
                {activeCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Note (Always freely editable per §4.3) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  id="edit-date-input"
                  className="w-full px-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs font-medium text-[#1F1B16] dark:text-[#EDE8E1]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                  Payment Method
                </label>
                <span className="block px-3 py-2 bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#78716C] capitalize">
                  {transaction.payment_method.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                Note / Description
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Description of spend..."
                id="edit-note-input"
                className="w-full px-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#1F1B16] dark:text-[#EDE8E1]"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    id="delete-tx-btn"
                    className="p-3 rounded-xl border border-[#E8C5BC] text-[#87341D] hover:bg-[#F9ECE8] transition-colors"
                    title="Delete Entry (Soft Delete)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="submit"
                  id="update-tx-btn"
                  className="flex-1 py-3 px-4 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Entry</span>
                </button>
              </div>

              {isLocked && (
                <button
                  type="button"
                  onClick={() => setShowCorrectionDialog(true)}
                  id="log-correction-btn"
                  className="w-full py-2.5 px-3 rounded-xl border border-[#AF7832] text-[#AF7832] text-xs font-semibold hover:bg-[#F7EFE4] transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Log a Correction for this Spend</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
