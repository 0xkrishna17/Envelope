import React, { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import {
  calculateCategoryPendingDebt,
} from '../utils/budgetLogic';
import { ArrowLeft, X, Check, ArrowRight, RefreshCw, AlertCircle, History, Trash2 } from 'lucide-react';

interface ReconciliationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  preselectedCategoryId?: string;
}

export const ReconcileScreen: React.FC<ReconciliationModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  preselectedCategoryId,
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };
  const {
    activeCategories,
    transactions,
    reconciliationLines,
    reconciliations,
    reconcileCategoryCardSpend,
    deleteReconciliation,
    members,
  } = useBudget();

  // Selected category to pay back
  const [selectedCatId, setSelectedCatId] = useState<string>(preselectedCategoryId || '');
  const [payAmountRupees, setPayAmountRupees] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [justSettled, setJustSettled] = useState<boolean>(false);

  // Group pending card spend by category
  const categoriesWithDebt = useMemo(() => {
    return activeCategories.map(cat => {
      const { totalPendingDebt, pendingTransactions } = calculateCategoryPendingDebt(
        cat.id,
        transactions,
        reconciliationLines
      );
      return {
        category: cat,
        totalPendingDebt,
        pendingTransactions,
      };
    }).filter(item => item.totalPendingDebt > 0);
  }, [activeCategories, transactions, reconciliationLines]);

  const totalOwedAll = useMemo(() => {
    return categoriesWithDebt.reduce((sum, item) => sum + item.totalPendingDebt, 0);
  }, [categoriesWithDebt]);

  // If a category is selected or set
  const activeDebtItem = useMemo(() => {
    if (!selectedCatId && categoriesWithDebt.length > 0) {
      return categoriesWithDebt[0];
    }
    return categoriesWithDebt.find(item => item.category.id === selectedCatId) || categoriesWithDebt[0];
  }, [selectedCatId, categoriesWithDebt]);

  // When active item changes, default pay amount to full debt amount
  React.useEffect(() => {
    if (activeDebtItem) {
      setSelectedCatId(activeDebtItem.category.id);
      setPayAmountRupees((activeDebtItem.totalPendingDebt / 100).toString());
    }
  }, [activeDebtItem?.category.id, activeDebtItem?.totalPendingDebt]);

  if (!isOpen) return null;

  const handlePaybackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDebtItem) return;

    const amountPaise = rupeesToPaise(payAmountRupees);
    if (amountPaise <= 0) return;

    // Never editable above the amount owed (§4.4)
    const cappedPaise = Math.min(amountPaise, activeDebtItem.totalPendingDebt);

    reconcileCategoryCardSpend(activeDebtItem.category.id, cappedPaise, date);

    setJustSettled(true);
    setTimeout(() => {
      setJustSettled(false);
      // Check if all settled
      if (categoriesWithDebt.length <= 1) {
        handleBack();
      }
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 animate-in fade-in duration-200">
      {/* Screen Navigation Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <button
          type="button"
          onClick={handleBack}
          id="close-reconcile-modal"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#78716C]" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F9ECE8] dark:bg-[#331D16] text-[#87341D] dark:text-[#F3B3A2] flex items-center justify-center shadow-xs">
            <RefreshCw className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            Credit Card Payback (Spend → Salary)
          </h2>
        </div>
      </div>

      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-5 py-3 border-b border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
            Transfer envelope money back to your Primary Salary bank account to cover credit card bills (§4.4)
          </p>
          <span className="text-xs text-[#78716C] dark:text-[#A8A29E] shrink-0">
            Total Pending:{' '}
            <strong className="text-[#87341D] dark:text-[#F3B3A2] font-amount font-semibold">
              {formatPaise(totalOwedAll)}
            </strong>
          </span>
        </div>

        {/* View Switcher: Payback vs Recent Reconciliations */}
        <div className="px-5 pt-3.5 pb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            {showHistory ? 'Payback Transfer History' : 'Pending Envelope Debts'}
          </span>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-[#486B88] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>{showHistory ? '← Back to Active Payback' : 'View Past Payback Log'}</span>
          </button>
        </div>

        {showHistory ? (
          /* Past Reconciliations List with Undo/Delete (§4.3) */
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Past Card Payback Transfers
            </h3>
            {reconciliations.filter(r => !r.deleted_at).length === 0 ? (
              <p className="text-xs text-[#78716C] py-4 text-center">No past transfers recorded yet.</p>
            ) : (
              reconciliations
                .filter(r => !r.deleted_at)
                .map(r => {
                  const cat = activeCategories.find(c => c.id === r.category_id);
                  const member = members.find(m => m.user_id === r.logged_by_user_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: cat?.color || '#78716C' }}
                        >
                          {renderCategoryIcon(cat?.icon || 'Wallet', 'w-4 h-4')}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                            {cat?.name || 'Category'}
                          </div>
                          <div className="text-[11px] text-[#78716C]">
                            Paid {r.date} by {member?.name || 'Household'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-amount font-semibold text-xs text-[#2C523B] dark:text-[#A8D1B7]">
                          +{formatPaise(r.total_amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteReconciliation(r.id)}
                          title="Undo this reconciliation (restores card debt status)"
                          className="p-1.5 rounded-lg text-[#78716C] hover:text-[#B85D43] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        ) : categoriesWithDebt.length === 0 ? (
          /* All Settled State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EBF2ED] text-[#2C523B] dark:bg-[#1E2E24] dark:text-[#A8D1B7] flex items-center justify-center mb-3">
              <Check className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              All Credit Cards Settled!
            </h3>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] max-w-xs mt-1">
              Every card purchase has been paid back from its respective spend account envelope.
            </p>
          </div>
        ) : (
          /* Main Payback Form */
          <form onSubmit={handlePaybackSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Category Cards with Outstanding Debt */}
            <div>
              <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-2">
                1. Select Category to Pay Back
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoriesWithDebt.map(item => {
                  const isSelected = item.category.id === activeDebtItem?.category.id;
                  return (
                    <button
                      key={item.category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCatId(item.category.id);
                        setPayAmountRupees((item.totalPendingDebt / 100).toString());
                      }}
                      id={`payback-cat-${item.category.id}`}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#B85D43] bg-[#F9ECE8]/70 dark:bg-[#331D16]/70 shadow-xs'
                          : 'border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 hover:bg-[#EFEAE1]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: item.category.color }}
                        >
                          {renderCategoryIcon(item.category.icon, 'w-3.5 h-3.5')}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] block truncate">
                            {item.category.name}
                          </span>
                          <span className="text-[10px] text-[#78716C]">
                            {item.pendingTransactions.length} pending swipe{item.pendingTransactions.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-amount font-semibold text-[#87341D] dark:text-[#F3B3A2]">
                          {formatPaise(item.totalPendingDebt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payback Input & Banking App instruction */}
            {activeDebtItem && (
              <div className="bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 p-4 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                    2. Transfer in your banking app
                  </span>
                  <span className="text-[11px] text-[#78716C]">
                    Spend A/c → Salary A/c
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-[#78716C] block mb-1">
                      Amount transferred (₹)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-base font-serif text-[#78716C]">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        max={activeDebtItem.totalPendingDebt / 100}
                        value={payAmountRupees}
                        onChange={e => setPayAmountRupees(e.target.value)}
                        required
                        id="payback-amount-input"
                        className="w-full pl-8 pr-3 py-2 bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-lg text-base font-amount font-semibold text-[#1F1B16] dark:text-[#EDE8E1]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-[#78716C] block mb-1">
                      Transfer Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                      id="payback-date-input"
                      className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-lg text-xs font-medium text-[#1F1B16] dark:text-[#EDE8E1]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#78716C] pt-1">
                  <span>FIFO matching: pays oldest credit card transactions first.</span>
                  <button
                    type="button"
                    onClick={() => setPayAmountRupees((activeDebtItem.totalPendingDebt / 100).toString())}
                    className="text-[#B85D43] font-semibold hover:underline"
                  >
                    Pay Full Owed
                  </button>
                </div>
              </div>
            )}

            {/* List of Pending Transactions that will be matched FIFO (§4.4) */}
            {activeDebtItem && (
              <div>
                <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1.5">
                  Pending Transactions covered (FIFO order):
                </label>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {activeDebtItem.pendingTransactions.map(tx => {
                    const member = members.find(m => m.user_id === tx.logged_by_user_id);
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="font-medium text-[#1F1B16] dark:text-[#EDE8E1] truncate block">
                            {tx.note || 'Card expense'}
                          </span>
                          <span className="text-[10px] text-[#78716C]">
                            {tx.date} • {member?.name || 'Member'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-amount font-semibold text-[#87341D] dark:text-[#F3B3A2]">
                            {formatPaise(tx.outstandingPaise)}
                          </span>
                          {tx.reconciliation_status === 'partially_reconciled' && (
                            <span className="text-[9px] block text-[#AF7832]">partial</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="confirm-payback-btn"
                disabled={!activeDebtItem || rupeesToPaise(payAmountRupees) <= 0 || justSettled}
                className="w-full py-3 px-4 rounded-xl bg-[#B85D43] text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#A34E35] disabled:opacity-40 transition-all cursor-pointer shadow-xs"
              >
                {justSettled ? (
                  <>
                    <Check className="w-4 h-4 animate-bounce" />
                    <span>Transferred & Settled!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Mark Paid & Reconcile FIFO</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const ReconciliationModal = ReconcileScreen;
