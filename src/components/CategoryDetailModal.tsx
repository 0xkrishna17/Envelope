import React, { useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { formatSelectedMonth } from '../utils/dateUtils';
import { Transaction } from '../types';
import { X, Plus, PlusCircle, CreditCard, RefreshCw, Calendar, ArrowDownLeft, ArrowUpRight, Edit3, ArrowLeftRight } from 'lucide-react';

interface CategoryDetailModalProps {
  categoryId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onQuickSpend: (catId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onReconcileCategory: (catId: string) => void;
  onMoveFunds?: (catId: string) => void;
  onAddFunds?: (catId: string) => void;
}

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({
  categoryId,
  isOpen,
  onClose,
  onQuickSpend,
  onEditTransaction,
  onReconcileCategory,
  onMoveFunds,
  onAddFunds,
}) => {
  const {
    categories,
    categoryBalances,
    transactions,
    allocations,
    envelopeTransfers,
    selectedMonth,
    members,
  } = useBudget();

  const balanceInfo = useMemo(() => {
    return categoryBalances.find(b => b.category.id === categoryId);
  }, [categoryBalances, categoryId]);

  const monthLabelShort = useMemo(() => {
    return formatSelectedMonth(selectedMonth, 'short');
  }, [selectedMonth]);

  const monthLabelLong = useMemo(() => {
    return formatSelectedMonth(selectedMonth, 'long');
  }, [selectedMonth]);

  // Filter transactions for this category in the selected month
  const categoryTransactions = useMemo(() => {
    if (!categoryId) return [];
    return transactions
      .filter(t => t.category_id === categoryId && !t.deleted_at && t.date.slice(0, 7) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [categoryId, transactions, selectedMonth]);

  // Monthly allocations for this category
  const categoryAllocations = useMemo(() => {
    if (!categoryId) return [];
    return allocations
      .filter(a => a.category_id === categoryId && !a.deleted_at && a.created_at.slice(0, 7) === selectedMonth)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [categoryId, allocations, selectedMonth]);

  // Transfers involving this category
  const categoryTransfers = useMemo(() => {
    if (!categoryId) return [];
    return envelopeTransfers
      .filter(t => t.from_category_id === categoryId || t.to_category_id === categoryId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [categoryId, envelopeTransfers]);

  // Direct envelope top-ups
  const categoryTopUps = useMemo(() => {
    if (!categoryId) return [];
    return allocations
      .filter(a => a.category_id === categoryId && !a.deleted_at && (Boolean(a.source) || a.salary_event_id.startsWith('env_topup_')))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [categoryId, allocations]);

  if (!isOpen || !balanceInfo) return null;

  const { category, availableNow, thisMonthAllocated, thisMonthSpent, pendingCardDebt } = balanceInfo;
  const isOverspent = availableNow < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-200 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
              style={{ backgroundColor: category.color }}
            >
              {renderCategoryIcon(category.icon, 'w-5 h-5')}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                {category.name}
              </h3>
              <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                {monthLabelLong} Activity Breakdown
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-category-detail-modal"
            className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Hero */}
        <div className="p-4 sm:p-5 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border-b border-[#E8E3DA] dark:border-[#2D2823] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <span className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-0.5">
              Available Now (Running Balance)
            </span>
            <span
              className={`text-2xl sm:text-3xl font-amount font-semibold ${
                isOverspent ? 'text-[#B85D43]' : 'text-[#1F1B16] dark:text-[#EDE8E1]'
              }`}
            >
              {formatPaise(availableNow)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingCardDebt > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReconcileCategory(category.id);
                }}
                className="px-3 py-2 rounded-xl bg-[#F9ECE8] dark:bg-[#331D16] text-[#87341D] dark:text-[#F3B3A2] border border-[#E8C5BC] dark:border-[#4D281E] text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Pay Back {formatPaise(pendingCardDebt)}</span>
              </button>
            )}

            {onMoveFunds && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onMoveFunds(category.id);
                }}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors ${
                  isOverspent
                    ? 'border-[#E8C5BC] bg-[#F9ECE8] dark:bg-[#331D16] text-[#87341D] dark:text-[#F3B3A2] hover:bg-[#F3DDD7]'
                    : 'border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1]'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#486B88]" />
                <span>{isOverspent ? 'Cover Deficit' : 'Move Funds'}</span>
              </button>
            )}

            {onAddFunds && (
              <button
                type="button"
                id="category-detail-add-funds-btn"
                onClick={() => {
                  onClose();
                  onAddFunds(category.id);
                }}
                className="px-3 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#2C523B]" />
                <span>Add Money</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onQuickSpend(category.id);
              }}
              className="px-3 py-2 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-[#FAF7F2] dark:bg-[#1A1714] border-b border-[#E8E3DA] dark:border-[#2D2823] text-xs">
          <div className="p-2.5 rounded-xl bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 border border-[#E8E3DA] dark:border-[#2D2823]">
            <span className="text-[11px] text-[#78716C] block">{monthLabelShort} allocated:</span>
            <strong className="font-amount font-semibold text-sm text-[#2C523B] dark:text-[#A8D1B7]">
              +{formatPaise(thisMonthAllocated)}
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 border border-[#E8E3DA] dark:border-[#2D2823]">
            <span className="text-[11px] text-[#78716C] block">{monthLabelShort} spent:</span>
            <strong className="font-amount font-semibold text-sm text-[#87341D] dark:text-[#F3B3A2]">
              -{formatPaise(thisMonthSpent)}
            </strong>
          </div>
        </div>

        {/* Transactions list */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
              Transactions in {monthLabelLong} ({categoryTransactions.length})
            </h4>
          </div>

          {categoryTransactions.length === 0 ? (
            <p className="text-xs text-[#78716C] text-center py-6">
              No transactions recorded for this envelope in {monthLabelLong}.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {categoryTransactions.map(tx => {
                const member = members.find(m => m.user_id === tx.logged_by_user_id);
                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      onClose();
                      onEditTransaction(tx);
                    }}
                    id={`cat-tx-${tx.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] hover:border-[#1F1B16] dark:hover:border-[#EDE8E1] cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 mr-3">
                      <div className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                        {tx.note || 'Expense'}
                      </div>
                      <div className="text-[11px] text-[#78716C] flex items-center gap-1.5 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="capitalize">{tx.payment_method.replace(/_/g, ' ')}</span>
                        <span>•</span>
                        <span>{member?.name || 'Partner'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-amount font-semibold text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
                        {tx.amount < 0 ? `+${formatPaise(Math.abs(tx.amount))}` : `-${formatPaise(tx.amount)}`}
                      </span>
                      {tx.payment_method === 'credit_card' && (
                        <span
                          className={`text-[9px] block font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${
                            tx.reconciliation_status === 'reconciled'
                              ? 'bg-[#EBF2ED] text-[#2C523B]'
                              : tx.reconciliation_status === 'partially_reconciled'
                              ? 'bg-[#F7EFE4] text-[#7A4E15]'
                              : 'bg-[#F9ECE8] text-[#87341D]'
                          }`}
                        >
                          {tx.reconciliation_status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Envelope Reallocations & Transfers */}
          {categoryTransfers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E8E3DA] dark:border-[#2D2823]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2.5">
                Envelope Reallocations ({categoryTransfers.length})
              </h4>
              <div className="flex flex-col gap-2">
                {categoryTransfers.map(tr => {
                  const isIncoming = tr.to_category_id === category.id;
                  const otherCat = categories.find(c => c.id === (isIncoming ? tr.from_category_id : tr.to_category_id));
                  return (
                    <div
                      key={tr.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 text-xs"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="font-medium text-[#1F1B16] dark:text-[#EDE8E1] block truncate">
                          {isIncoming ? `Received from ${otherCat?.name || 'Envelope'}` : `Moved to ${otherCat?.name || 'Envelope'}`}
                        </span>
                        <span className="text-[10px] text-[#78716C] block mt-0.5">
                          {tr.date} {tr.note ? `· "${tr.note}"` : ''}
                        </span>
                      </div>
                      <span className={`font-amount font-semibold shrink-0 ${isIncoming ? 'text-[#2C523B] dark:text-[#A8D1B7]' : 'text-[#87341D] dark:text-[#F3B3A2]'}`}>
                        {isIncoming ? '+' : '-'}{formatPaise(tr.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direct Envelope Top-Ups */}
          {categoryTopUps.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E8E3DA] dark:border-[#2D2823]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2.5">
                Direct Top-Ups & Inflows ({categoryTopUps.length})
              </h4>
              <div className="flex flex-col gap-2">
                {categoryTopUps.map(topup => (
                  <div
                    key={topup.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EBF2ED]/40 dark:bg-[#1E3326]/40 text-xs"
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <span className="font-medium text-[#1F1B16] dark:text-[#EDE8E1] block truncate">
                        {topup.source || 'Direct Top-Up'}
                      </span>
                      <span className="text-[10px] text-[#78716C] block mt-0.5">
                        {topup.created_at.slice(0, 10)} {topup.note ? `· "${topup.note}"` : ''} · {topup.transferred ? 'Available' : 'Pending Transfer'}
                      </span>
                    </div>
                    <span className="font-amount font-semibold shrink-0 text-[#2C523B] dark:text-[#A8D1B7]">
                      +{formatPaise(topup.planned_amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
