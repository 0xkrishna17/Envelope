import React, { useState, useEffect, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import {
  X,
  ArrowLeftRight,
  ArrowRight,
  Check,
  AlertTriangle,
  Clock,
  Trash2,
  HelpCircle,
  RotateCcw
} from 'lucide-react';

interface MoveFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFromCategoryId?: string;
  initialToCategoryId?: string;
  initialAmountPaise?: number;
}

export const MoveFundsModal: React.FC<MoveFundsModalProps> = ({
  isOpen,
  onClose,
  initialFromCategoryId,
  initialToCategoryId,
  initialAmountPaise,
}) => {
  const {
    categories,
    categoryBalances,
    envelopeTransfers,
    moveEnvelopeFunds,
    deleteEnvelopeTransfer,
    members,
  } = useBudget();

  // Active, non-deleted categories
  const availableCategories = useMemo(() => {
    return categories.filter(c => !c.deleted_at && !c.is_archived);
  }, [categories]);

  // Balance lookup helper
  const getBalance = (catId: string) => {
    const info = categoryBalances.find(b => b.category.id === catId);
    return info ? info.availableNow : 0;
  };

  // Find default categories: prefer unallocated for 'from', first regular for 'to'
  const unallocatedCat = useMemo(() => {
    return categories.find(c => c.is_unallocated);
  }, [categories]);

  const [fromCategoryId, setFromCategoryId] = useState<string>('');
  const [toCategoryId, setToCategoryId] = useState<string>('');
  const [amountRupees, setAmountRupees] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Initialize or update fields when opened
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setSuccessMsg('');

    // Default 'from'
    if (initialFromCategoryId) {
      setFromCategoryId(initialFromCategoryId);
    } else if (unallocatedCat && getBalance(unallocatedCat.id) > 0) {
      setFromCategoryId(unallocatedCat.id);
    } else {
      const firstWithFunds = availableCategories.find(c => getBalance(c.id) > 0);
      setFromCategoryId(firstWithFunds ? firstWithFunds.id : availableCategories[0]?.id || '');
    }

    // Default 'to'
    if (initialToCategoryId) {
      setToCategoryId(initialToCategoryId);
    } else {
      // Look for an overspent category first
      const overspent = availableCategories.find(c => getBalance(c.id) < 0 && c.id !== initialFromCategoryId);
      if (overspent) {
        setToCategoryId(overspent.id);
      } else {
        const otherCat = availableCategories.find(c => c.id !== (initialFromCategoryId || unallocatedCat?.id));
        setToCategoryId(otherCat ? otherCat.id : availableCategories[1]?.id || '');
      }
    }

    // Default amount
    if (initialAmountPaise && initialAmountPaise > 0) {
      setAmountRupees(String(initialAmountPaise / 100));
    } else {
      setAmountRupees('');
    }

    setNote('');
  }, [isOpen, initialFromCategoryId, initialToCategoryId, initialAmountPaise, availableCategories, unallocatedCat]);

  if (!isOpen) return null;

  const fromCategory = availableCategories.find(c => c.id === fromCategoryId);
  const toCategory = availableCategories.find(c => c.id === toCategoryId);

  const fromBalance = fromCategoryId ? getBalance(fromCategoryId) : 0;
  const toBalance = toCategoryId ? getBalance(toCategoryId) : 0;

  const parsedAmountPaise = rupeesToPaise(amountRupees);
  const isDestinationOverspent = toBalance < 0;
  const destinationDeficitPaise = isDestinationOverspent ? Math.abs(toBalance) : 0;

  const projectedFromBalance = fromBalance - parsedAmountPaise;
  const projectedToBalance = toBalance + parsedAmountPaise;

  const handleSwapCategories = () => {
    setFromCategoryId(toCategoryId);
    setToCategoryId(fromCategoryId);
    setErrorMsg('');
  };

  const handleQuickCoverDeficit = () => {
    if (destinationDeficitPaise > 0) {
      setAmountRupees(String(destinationDeficitPaise / 100));
      setErrorMsg('');
    }
  };

  const handleQuickSetAmount = (paise: number) => {
    setAmountRupees(String(paise / 100));
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fromCategoryId || !toCategoryId) {
      setErrorMsg('Please select both source and destination envelopes.');
      return;
    }
    if (fromCategoryId === toCategoryId) {
      setErrorMsg('Source and destination envelopes must be different.');
      return;
    }
    if (parsedAmountPaise <= 0) {
      setErrorMsg('Please enter a valid amount greater than ₹0.');
      return;
    }

    const res = moveEnvelopeFunds({
      fromCategoryId,
      toCategoryId,
      amountPaise: parsedAmountPaise,
      note: note.trim() || undefined,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to move funds.');
      return;
    }

    setSuccessMsg(`Successfully moved ${formatPaise(parsedAmountPaise)} from ${fromCategory?.name} to ${toCategory?.name}.`);
    setAmountRupees('');
    setNote('');

    // Auto close after brief confirmation
    setTimeout(() => {
      onClose();
    }, 1200);
  };

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
            <div className="w-8 h-8 rounded-lg bg-[#486B88] text-white flex items-center justify-center shadow-xs">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                Move Envelope Funds
              </h3>
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                Reallocate money between envelopes in your household ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-move-funds-modal"
            className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {successMsg ? (
            <div className="p-4 rounded-xl bg-[#E8F2EB] dark:bg-[#1C3224] border border-[#BBDBC3] dark:border-[#2E583C] text-[#2C523B] dark:text-[#A8D1B7] text-xs font-semibold flex items-center gap-2 mb-4 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          ) : null}

          {errorMsg ? (
            <div className="p-3 rounded-xl bg-[#F9ECE8] dark:bg-[#331D16] border border-[#E8C5BC] dark:border-[#5E261B] text-[#87341D] dark:text-[#F3B3A2] text-xs font-medium flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Envelope Selection (From & To) */}
            <div className="flex flex-col gap-2">
              {/* FROM ENVELOPE */}
              <div>
                <label className="block text-xs font-semibold text-[#78716C] dark:text-[#A8A29E] mb-1.5">
                  Move Money From
                </label>
                <div className="relative">
                  <select
                    value={fromCategoryId}
                    onChange={e => {
                      setFromCategoryId(e.target.value);
                      setErrorMsg('');
                    }}
                    id="move-from-category-select"
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-[#FAF7F2] dark:bg-[#1A1714] text-[#1F1B16] dark:text-[#EDE8E1] text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-[#486B88]"
                  >
                    {availableCategories.map(cat => {
                      const bal = getBalance(cat.id);
                      return (
                        <option
                          key={cat.id}
                          value={cat.id}
                          disabled={cat.id === toCategoryId}
                        >
                          {cat.name} ({cat.is_unallocated ? 'Surplus' : 'Envelope'}) — {bal >= 0 ? `Available: ${formatPaise(bal)}` : `Overspent: ${formatPaise(bal)}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {fromCategory && (
                  <div className="flex items-center justify-between text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1 px-1">
                    <span>Current Available:</span>
                    <strong
                      className={`font-amount font-semibold ${
                        fromBalance < 0 ? 'text-[#B85D43]' : 'text-[#4E785E] dark:text-[#A8D1B7]'
                      }`}
                    >
                      {formatPaise(fromBalance)}
                    </strong>
                  </div>
                )}
              </div>

              {/* SWAP BUTTON */}
              <div className="flex justify-center -my-1 relative z-10">
                <button
                  type="button"
                  onClick={handleSwapCategories}
                  id="swap-envelopes-btn"
                  title="Swap source and destination"
                  className="p-1.5 rounded-full border border-[#DCD5C9] dark:border-[#3D362F] bg-[#FAF7F2] dark:bg-[#1A1714] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] shadow-xs transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* TO ENVELOPE */}
              <div>
                <label className="block text-xs font-semibold text-[#78716C] dark:text-[#A8A29E] mb-1.5">
                  Move Money To
                </label>
                <div className="relative">
                  <select
                    value={toCategoryId}
                    onChange={e => {
                      setToCategoryId(e.target.value);
                      setErrorMsg('');
                    }}
                    id="move-to-category-select"
                    className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-[#FAF7F2] dark:bg-[#1A1714] text-[#1F1B16] dark:text-[#EDE8E1] text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-[#486B88]"
                  >
                    {availableCategories.map(cat => {
                      const bal = getBalance(cat.id);
                      return (
                        <option
                          key={cat.id}
                          value={cat.id}
                          disabled={cat.id === fromCategoryId}
                        >
                          {cat.name} ({cat.is_unallocated ? 'Surplus' : 'Envelope'}) — {bal >= 0 ? `Available: ${formatPaise(bal)}` : `Overspent: ${formatPaise(bal)}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {toCategory && (
                  <div className="flex items-center justify-between text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1 px-1">
                    <span>Current Available:</span>
                    <div className="flex items-center gap-1.5">
                      {isDestinationOverspent && (
                        <span className="text-[10px] text-[#B85D43] font-bold">
                          Deficit:
                        </span>
                      )}
                      <strong
                        className={`font-amount font-semibold ${
                          toBalance < 0 ? 'text-[#B85D43]' : 'text-[#4E785E] dark:text-[#A8D1B7]'
                        }`}
                      >
                        {formatPaise(toBalance)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AMOUNT INPUT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#78716C] dark:text-[#A8A29E]">
                  Amount to Move (₹)
                </label>
                {isDestinationOverspent && destinationDeficitPaise > 0 && (
                  <button
                    type="button"
                    onClick={handleQuickCoverDeficit}
                    className="text-[11px] text-[#B85D43] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Cover Deficit ({formatPaise(destinationDeficitPaise)})</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#78716C]">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={e => {
                    setAmountRupees(e.target.value);
                    setErrorMsg('');
                  }}
                  id="move-funds-amount-input"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-[#FAF7F2] dark:bg-[#1A1714] text-[#1F1B16] dark:text-[#EDE8E1] text-base font-amount font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#486B88]"
                  required
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[50000, 100000, 200000, 500000].map(paise => (
                  <button
                    key={paise}
                    type="button"
                    onClick={() => handleQuickSetAmount(paise)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors"
                  >
                    +{formatPaise(paise)}
                  </button>
                ))}
                {fromBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickSetAmount(fromBalance)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[#486B88]/40 bg-[#486B88]/10 text-[#486B88] hover:bg-[#486B88]/20 transition-colors"
                  >
                    All Available ({formatPaise(fromBalance)})
                  </button>
                )}
              </div>
            </div>

            {/* OPTIONAL NOTE */}
            <div>
              <label className="block text-xs font-semibold text-[#78716C] dark:text-[#A8A29E] mb-1.5">
                Transfer Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Covered dinner overspend, shifted vacation buffer"
                value={note}
                onChange={e => setNote(e.target.value)}
                id="move-funds-note-input"
                className="w-full px-3 py-2 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] bg-[#FAF7F2] dark:bg-[#1A1714] text-[#1F1B16] dark:text-[#EDE8E1] text-xs focus:outline-hidden focus:ring-1 focus:ring-[#486B88]"
              />
            </div>

            {/* LIVE PREVIEW CARD */}
            {parsedAmountPaise > 0 && fromCategory && toCategory && (
              <div className="p-3.5 rounded-xl bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#E8E3DA] dark:border-[#2D2823] flex flex-col gap-2.5 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#78716C]">
                  Projected Envelope Balances
                </span>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: fromCategory.color }}
                    />
                    <span className="font-medium truncate">{fromCategory.name}:</span>
                  </div>
                  <div className="font-amount font-semibold flex items-center gap-1.5 shrink-0">
                    <span className="text-[#78716C] line-through">{formatPaise(fromBalance)}</span>
                    <ArrowRight className="w-3 h-3 text-[#78716C]" />
                    <span className={projectedFromBalance < 0 ? 'text-[#B85D43]' : 'text-[#1F1B16] dark:text-[#EDE8E1]'}>
                      {formatPaise(projectedFromBalance)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: toCategory.color }}
                    />
                    <span className="font-medium truncate">{toCategory.name}:</span>
                  </div>
                  <div className="font-amount font-semibold flex items-center gap-1.5 shrink-0">
                    <span className="text-[#78716C] line-through">{formatPaise(toBalance)}</span>
                    <ArrowRight className="w-3 h-3 text-[#78716C]" />
                    <span className={projectedToBalance < 0 ? 'text-[#B85D43]' : 'text-[#4E785E] dark:text-[#A8D1B7]'}>
                      {formatPaise(projectedToBalance)}
                    </span>
                  </div>
                </div>

                {projectedFromBalance < 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#B85D43] pt-1 border-t border-[#E8E3DA] dark:border-[#2D2823]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Warning: {fromCategory.name} will be left overspent by {formatPaise(Math.abs(projectedFromBalance))}.</span>
                  </div>
                )}
              </div>
            )}

            {/* Ledger Reassurance Note */}
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[#486B88]" />
              <span>Internal reallocation within your spend household account. No external bank transfer needed.</span>
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="confirm-move-funds-btn"
                disabled={parsedAmountPaise <= 0 || !fromCategoryId || !toCategoryId || fromCategoryId === toCategoryId}
                className="flex-1 py-2.5 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold shadow-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Transfer</span>
              </button>
            </div>
          </form>

          {/* Transfers History Section Toggle */}
          {envelopeTransfers.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[#E8E3DA] dark:border-[#2D2823]">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Past Envelope Transfers ({envelopeTransfers.length})
                </span>
                <span className="text-[11px] font-normal normal-case underline">
                  {showHistory ? 'Hide' : 'View'}
                </span>
              </button>

              {showHistory && (
                <div className="mt-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {envelopeTransfers.map(tr => {
                    const fromCat = categories.find(c => c.id === tr.from_category_id);
                    const toCat = categories.find(c => c.id === tr.to_category_id);
                    const member = members.find(m => m.user_id === tr.logged_by_user_id);

                    return (
                      <div
                        key={tr.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 text-xs"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="flex items-center gap-1 font-medium text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                            <span className="truncate">{fromCat?.name || 'Envelope'}</span>
                            <ArrowRight className="w-3 h-3 text-[#78716C] shrink-0" />
                            <span className="truncate font-semibold text-[#486B88]">{toCat?.name || 'Envelope'}</span>
                          </div>
                          <div className="text-[10px] text-[#78716C] flex items-center gap-2 mt-0.5">
                            <span>{tr.date}</span>
                            {member && <span>· by {member.name}</span>}
                            {tr.note && <span className="truncate italic">· "{tr.note}"</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-amount font-semibold text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
                            {formatPaise(tr.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteEnvelopeTransfer(tr.id)}
                            title="Undo transfer"
                            className="p-1 rounded text-[#78716C] hover:text-[#B85D43] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
