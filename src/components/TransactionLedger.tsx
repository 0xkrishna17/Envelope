import React, { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import {
  Transaction,
  PaymentMethod,
  ReconciliationStatus,
  SalaryEvent,
  Reconciliation,
  EnvelopeTransfer,
  Allocation,
} from '../types';
import { formatPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { formatSelectedMonth } from '../utils/dateUtils';
import {
  buildUnifiedLedger,
  UnifiedLedgerEntry,
  LedgerEntryType,
} from '../utils/ledger';
import {
  Search,
  Filter,
  Calendar,
  CreditCard,
  User,
  X,
  Plus,
  PlusCircle,
  ArrowLeftRight,
  Landmark,
  ArrowRight,
  RotateCcw,
  Check,
  AlertTriangle,
  Layers,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  Trash2,
} from 'lucide-react';

interface TransactionLedgerProps {
  onEditTransaction: (tx: Transaction) => void;
  onOpenNewTransaction: () => void;
  onOpenMoveFunds?: () => void;
  onOpenSalaryModal?: () => void;
  onOpenReconcileModal?: (catId?: string) => void;
  onOpenAddFunds?: (catId?: string) => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  onEditTransaction,
  onOpenNewTransaction,
  onOpenMoveFunds,
  onOpenSalaryModal,
  onOpenReconcileModal,
  onOpenAddFunds,
}) => {
  const {
    transactions,
    salaryEvents,
    allocations,
    reconciliations,
    reconciliationLines,
    envelopeTransfers,
    categories,
    members,
    selectedMonth,
    deleteEnvelopeTransfer,
    deleteReconciliation,
    deleteCategoryFunds,
  } = useBudget();

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | LedgerEntryType>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'current_month'>('current_month');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Detail Modal States for non-spend entries
  const [inspectEntry, setInspectEntry] = useState<UnifiedLedgerEntry | null>(null);
  const [confirmDeleteAction, setConfirmDeleteAction] = useState<boolean>(false);

  // Build unified entries and summary stats
  const { entries, stats } = useMemo(() => {
    return buildUnifiedLedger(
      transactions,
      salaryEvents,
      reconciliations,
      reconciliationLines,
      envelopeTransfers,
      categories,
      members,
      {
        selectedMonth,
        timeframe: dateRangeFilter,
        typeFilter: selectedTypeFilter,
        categoryFilter: selectedCategoryFilter,
        memberFilter: selectedMemberFilter,
        paymentMethodFilter: selectedMethodFilter,
        reconciliationStatusFilter: selectedStatusFilter,
        searchQuery,
      },
      allocations
    );
  }, [
    transactions,
    salaryEvents,
    reconciliations,
    reconciliationLines,
    envelopeTransfers,
    categories,
    members,
    selectedMonth,
    dateRangeFilter,
    selectedTypeFilter,
    selectedCategoryFilter,
    selectedMemberFilter,
    selectedMethodFilter,
    selectedStatusFilter,
    searchQuery,
    allocations,
  ]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedTypeFilter !== 'all' ||
    selectedCategoryFilter !== 'all' ||
    selectedMethodFilter !== 'all' ||
    selectedStatusFilter !== 'all' ||
    selectedMemberFilter !== 'all' ||
    dateRangeFilter !== 'current_month';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypeFilter('all');
    setSelectedCategoryFilter('all');
    setSelectedMethodFilter('all');
    setSelectedStatusFilter('all');
    setSelectedMemberFilter('all');
    setDateRangeFilter('current_month');
  };

  const handleRowClick = (entry: UnifiedLedgerEntry) => {
    if (entry.type === 'spend') {
      onEditTransaction(entry.raw as Transaction);
    } else {
      setConfirmDeleteAction(false);
      setInspectEntry(entry);
    }
  };

  const handleRevertEntry = () => {
    if (!inspectEntry) return;

    if (inspectEntry.type === 'fund_move') {
      deleteEnvelopeTransfer((inspectEntry.raw as EnvelopeTransfer).id);
      setInspectEntry(null);
    } else if (inspectEntry.type === 'reconcile') {
      deleteReconciliation((inspectEntry.raw as Reconciliation).id);
      setInspectEntry(null);
    } else if (inspectEntry.type === 'category_topup') {
      deleteCategoryFunds(inspectEntry.allocationId || (inspectEntry.raw as Allocation).id);
      setInspectEntry(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-4 py-2 sm:py-6 flex flex-col gap-3 sm:gap-6">
      {/* Top Banner (Action buttons removed from top per user request; available in floating nav / quick spend) */}
      <div className="flex flex-col gap-1 px-1 sm:px-0">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F1B16] dark:text-[#EDE8E1]">
          Household Ledger
        </h2>
        <p className="text-[11px] sm:text-xs text-[#78716C] dark:text-[#A8A29E]">
          Unified audit history for spends, salary credits, envelope top-ups, card paybacks, and fund moves
        </p>
      </div>

      {/* Compact Filter & Search Bar */}
      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2 sm:gap-2.5 shadow-xs">
        {/* Row 1: Dedicated Search Input */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
          <input
            type="text"
            placeholder="Search notes, amounts, envelopes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            id="ledger-search-input"
            className="w-full pl-8 pr-7 py-2 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs placeholder:text-[#78716C] focus:outline-none focus:border-[#1F1B16] dark:focus:border-[#EDE8E1]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              id="clear-ledger-search-input-btn"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1F1B16]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Filter Controls (Dropdowns + Timeframe + More Filters) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Entry Type & Envelope Dropdowns */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {/* Entry Type Dropdown */}
            <div>
              <select
                value={selectedTypeFilter}
                onChange={e => setSelectedTypeFilter(e.target.value as any)}
                id="ledger-filter-type"
                className={`w-full py-1.5 px-2 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border rounded-xl text-xs font-medium transition-colors focus:outline-none ${
                  selectedTypeFilter !== 'all'
                    ? 'border-[#1F1B16] dark:border-[#EDE8E1] text-[#1F1B16] dark:text-[#EDE8E1]'
                    : 'border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                <option value="all">All Types ({stats.totalCount})</option>
                <option value="spend">Spends ({stats.spendCount})</option>
                <option value="salary_credit">Salary In ({stats.salaryCount})</option>
                <option value="category_topup">Top-Ups ({stats.topupCount})</option>
                <option value="reconcile">CC Settle ({stats.reconcileCount})</option>
                <option value="fund_move">Fund Moves ({stats.fundMoveCount})</option>
              </select>
            </div>

            {/* Envelope Dropdown */}
            <div>
              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                id="ledger-filter-category"
                className={`w-full py-1.5 px-2 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border rounded-xl text-xs font-medium transition-colors focus:outline-none ${
                  selectedCategoryFilter !== 'all'
                    ? 'border-[#1F1B16] dark:border-[#EDE8E1] text-[#1F1B16] dark:text-[#EDE8E1]'
                    : 'border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                <option value="all">All Envelopes</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeframe Selector & More Filters Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* Timeframe Selector */}
            <div className="flex items-center gap-0.5 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 p-0.5 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs">
              <button
                onClick={() => setDateRangeFilter('current_month')}
                id="ledger-timeframe-month"
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  dateRangeFilter === 'current_month'
                    ? 'bg-white dark:bg-[#1A1714] text-[#1F1B16] dark:text-[#EDE8E1] shadow-xs'
                    : 'text-[#78716C] hover:text-[#1F1B16]'
                }`}
              >
                {formatSelectedMonth(selectedMonth)}
              </button>
              <button
                onClick={() => setDateRangeFilter('all')}
                id="ledger-timeframe-all"
                className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                  dateRangeFilter === 'all'
                    ? 'bg-white dark:bg-[#1A1714] text-[#1F1B16] dark:text-[#EDE8E1] shadow-xs'
                    : 'text-[#78716C] hover:text-[#1F1B16]'
                }`}
              >
                All Time
              </button>
            </div>

            {/* More Filters Toggle */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              id="ledger-toggle-advanced-filters"
              title="More filters (Logged By, Payment Method)"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-all shrink-0 ${
                showAdvancedFilters || selectedMemberFilter !== 'all' || selectedMethodFilter !== 'all'
                  ? 'bg-[#EFEAE1] dark:bg-[#28221D] border-[#1F1B16] dark:border-[#EDE8E1] text-[#1F1B16] dark:text-[#EDE8E1]'
                  : 'border-[#DCD5C9] dark:border-[#3D362F] text-[#78716C] hover:text-[#1F1B16]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>More</span>
              {(selectedMemberFilter !== 'all' || selectedMethodFilter !== 'all') && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#B85D43]" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters: Member & Payment Method */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E8E3DA]/80 dark:border-[#2D2823]/80">
            <div>
              <label className="block text-[10px] text-[#78716C] font-semibold uppercase mb-1">
                Logged By / Earner
              </label>
              <select
                value={selectedMemberFilter}
                onChange={e => setSelectedMemberFilter(e.target.value)}
                id="ledger-filter-member"
                className="w-full py-1.5 px-2 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs font-medium"
              >
                <option value="all">Everyone</option>
                {members.map(m => (
                  <option key={m.id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[#78716C] font-semibold uppercase mb-1">
                Payment Method (Spends)
              </label>
              <select
                value={selectedMethodFilter}
                onChange={e => setSelectedMethodFilter(e.target.value)}
                id="ledger-filter-payment-method"
                className="w-full py-1.5 px-2 bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs font-medium"
              >
                <option value="all">All Payment Methods</option>
                <option value="secondary_account_upi">Spend Account (UPI)</option>
                <option value="secondary_account_debit">Spend Account (Debit Card)</option>
                <option value="credit_card">Credit Card (CC)</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>
        )}

        {/* Filter Summary & Reset */}
        <div className="flex items-center justify-between pt-1 border-t border-[#E8E3DA]/70 dark:border-[#2D2823]/70 text-[11px] text-[#78716C]">
          <span>
            Showing <strong>{entries.length}</strong> matching {entries.length === 1 ? 'entry' : 'entries'}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              id="clear-ledger-filters-btn"
              className="text-[#B85D43] font-medium hover:underline text-[11px] flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Entries Timeline List */}
      <div className="flex flex-col gap-2.5">
        {entries.length === 0 ? (
          <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl p-10 text-center text-xs text-[#78716C]">
            <p className="font-semibold text-sm text-[#1F1B16] dark:text-[#EDE8E1] mb-1">
              No ledger entries found
            </p>
            <p>Try clearing your filters or changing the selected timeframe.</p>
          </div>
        ) : (
          entries.map(entry => {
            return (
              <div
                key={entry.id}
                onClick={() => handleRowClick(entry)}
                id={`ledger-row-${entry.id}`}
                className="flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] hover:border-[#1F1B16] dark:hover:border-[#EDE8E1] cursor-pointer transition-all shadow-xs group"
              >
                {/* Left Side: Icon & Details */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 pr-2">
                  {/* Visual Icon based on Entry Type */}
                  {entry.type === 'spend' && (
                    <div
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: entry.categoryColor || '#78716C' }}
                    >
                      {renderCategoryIcon(entry.categoryIcon || 'Wallet', 'w-4 h-4 sm:w-5 sm:h-5')}
                    </div>
                  )}

                  {entry.type === 'salary_credit' && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs bg-[#4E785E]">
                      <Landmark className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  )}

                  {entry.type === 'reconcile' && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs bg-[#87341D]">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  )}

                  {entry.type === 'fund_move' && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs bg-[#AF7832]">
                      <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  )}

                  {entry.type === 'category_topup' && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs bg-[#2C523B]">
                      <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  )}

                  {/* Title and metadata */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                        {entry.title}
                      </span>

                      {/* Type Badge */}
                      {entry.type === 'salary_credit' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EBF2ED] dark:bg-[#1E3326] text-[#2C523B] dark:text-[#72B38A] shrink-0">
                          Salary Credit
                        </span>
                      )}
                      {entry.type === 'category_topup' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EBF2ED] dark:bg-[#1E3326] text-[#2C523B] dark:text-[#72B38A] shrink-0">
                          Top-Up
                        </span>
                      )}
                      {entry.type === 'reconcile' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F9ECE8] dark:bg-[#381B13] text-[#87341D] dark:text-[#E89E8C] shrink-0">
                          CC Settle
                        </span>
                      )}
                      {entry.type === 'fund_move' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F7EFE4] dark:bg-[#332515] text-[#7A4E15] dark:text-[#D4B384] shrink-0">
                          Fund Move
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5 mt-0.5 truncate">
                      <span>{entry.date}</span>
                      <span>•</span>
                      <span
                        className="font-medium"
                        style={{ color: entry.loggedByAvatarColor }}
                      >
                        {entry.loggedByName}
                      </span>
                      <span>•</span>
                      <span className="truncate">{entry.subtitle}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Financial Amount & Status Badges */}
                <div className="text-right shrink-0">
                  {entry.type === 'spend' && (
                    <>
                      <span className="font-amount font-bold text-sm text-[#1F1B16] dark:text-[#EDE8E1]">
                        {entry.amountPaise < 0
                          ? `+${formatPaise(Math.abs(entry.amountPaise))}`
                          : `-${formatPaise(entry.amountPaise)}`}
                      </span>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className="text-[10px] text-[#78716C] capitalize">
                          {entry.paymentMethod?.replace(/_/g, ' ')}
                        </span>
                        {entry.paymentMethod === 'credit_card' && (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                              entry.reconciliationStatus === 'reconciled'
                                ? 'bg-[#EBF2ED] text-[#2C523B]'
                                : entry.reconciliationStatus === 'partially_reconciled'
                                ? 'bg-[#F7EFE4] text-[#7A4E15]'
                                : 'bg-[#F9ECE8] text-[#87341D]'
                            }`}
                          >
                            {entry.reconciliationStatus?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {entry.type === 'salary_credit' && (
                    <>
                      <span className="font-amount font-bold text-sm text-[#2C523B] dark:text-[#72B38A]">
                        +{formatPaise(entry.amountPaise)}
                      </span>
                      <div className="text-[10px] text-[#4E785E] dark:text-[#72B38A] mt-0.5">
                        Primary Salary A/c
                      </div>
                    </>
                  )}

                  {entry.type === 'reconcile' && (
                    <>
                      <span className="font-amount font-bold text-sm text-[#87341D] dark:text-[#E89E8C]">
                        {formatPaise(entry.amountPaise)}
                      </span>
                      <div className="text-[10px] text-[#78716C] mt-0.5">
                        Card Paid Back
                      </div>
                    </>
                  )}

                  {entry.type === 'fund_move' && (
                    <>
                      <span className="font-amount font-bold text-sm text-[#AF7832] dark:text-[#D4B384]">
                        {formatPaise(entry.amountPaise)}
                      </span>
                      <div className="text-[10px] text-[#78716C] mt-0.5">
                        Envelope Transfer
                      </div>
                    </>
                  )}

                  {entry.type === 'category_topup' && (
                    <>
                      <span className="font-amount font-bold text-sm text-[#2C523B] dark:text-[#72B38A]">
                        +{formatPaise(entry.amountPaise)}
                      </span>
                      <div className="text-[10px] text-[#2C523B] dark:text-[#72B38A] mt-0.5">
                        {entry.topupSource || 'Top-Up'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Inspect Modal for Non-Spend Entries (Salary, Reconcile, Fund Move) */}
      {inspectEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-3xl p-6 shadow-xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                    inspectEntry.type === 'salary_credit'
                      ? 'bg-[#4E785E]'
                      : inspectEntry.type === 'reconcile'
                      ? 'bg-[#87341D]'
                      : inspectEntry.type === 'category_topup'
                      ? 'bg-[#2C523B]'
                      : 'bg-[#AF7832]'
                  }`}
                >
                  {inspectEntry.type === 'salary_credit' && <Landmark className="w-4 h-4" />}
                  {inspectEntry.type === 'reconcile' && <CreditCard className="w-4 h-4" />}
                  {inspectEntry.type === 'fund_move' && <ArrowLeftRight className="w-4 h-4" />}
                  {inspectEntry.type === 'category_topup' && <PlusCircle className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
                    {inspectEntry.type === 'salary_credit' && 'Salary Credit Details'}
                    {inspectEntry.type === 'category_topup' && 'Envelope Top-Up Details'}
                    {inspectEntry.type === 'reconcile' && 'Credit Card Payback Details'}
                    {inspectEntry.type === 'fund_move' && 'Envelope Transfer Details'}
                  </h3>
                  <p className="text-[11px] text-[#78716C]">
                    Recorded on {inspectEntry.date}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectEntry(null)}
                id="close-ledger-inspect-btn"
                className="p-1 rounded-lg text-[#78716C] hover:text-[#1F1B16] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 border border-[#DCD5C9] dark:border-[#3D362F] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#78716C]">
                  {inspectEntry.type === 'salary_credit' ? 'Total Inflow' : inspectEntry.type === 'category_topup' ? 'Added to Envelope' : 'Amount Transferred'}
                </span>
                <div className="text-xl font-amount font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
                  {formatPaise(inspectEntry.amountPaise)}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#78716C]">Actor</span>
                <div
                  className="text-xs font-semibold"
                  style={{ color: inspectEntry.loggedByAvatarColor }}
                >
                  {inspectEntry.loggedByName}
                </div>
              </div>
            </div>

            {/* Specific Type Details */}
            {inspectEntry.type === 'salary_credit' && (
              <div className="flex flex-col gap-2 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] flex items-start gap-2">
                  <Landmark className="w-4 h-4 text-[#4E785E] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                      Primary Salary Account
                    </div>
                    <p className="text-[#78716C] text-[11px] mt-0.5">
                      Funds deposited into primary salary bank account and allocated to monthly household envelopes.
                    </p>
                  </div>
                </div>

                {/* Envelope breakdown for this salary event */}
                {(() => {
                  const salAllocations = allocations.filter(
                    a => a.salary_event_id === (inspectEntry.raw as SalaryEvent).id && a.planned_amount > 0
                  );
                  if (salAllocations.length === 0) return null;

                  return (
                    <div className="flex flex-col gap-1.5 mt-2">
                      <span className="text-[10px] font-bold uppercase text-[#78716C]">
                        Allocations Funded ({salAllocations.length})
                      </span>
                      <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1">
                        {salAllocations.map(a => {
                          const cat = categories.find(c => c.id === a.category_id);
                          return (
                            <div
                              key={a.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 border border-[#E8E3DA] dark:border-[#2D2823] text-xs"
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: cat?.color || '#78716C' }}
                                />
                                <span>{cat?.name || 'Envelope'}</span>
                              </div>
                              <span className="font-amount font-semibold">
                                {formatPaise(a.planned_amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {inspectEntry.type === 'fund_move' && (
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716C]">Source</span>
                    <div className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                      {inspectEntry.fromCategoryName}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#AF7832]" />
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#78716C]">Destination</span>
                    <div className="font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                      {inspectEntry.toCategoryName}
                    </div>
                  </div>
                </div>

                {inspectEntry.note && (
                  <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block mb-0.5">
                      Note
                    </span>
                    <p className="text-xs text-[#1F1B16] dark:text-[#EDE8E1]">{inspectEntry.note}</p>
                  </div>
                )}
              </div>
            )}

            {inspectEntry.type === 'reconcile' && (
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block mb-0.5">
                    Settlement Loop
                  </span>
                  <p className="text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
                    Transferred from <strong>Spend Account</strong> into <strong>Primary Salary Account</strong> to pay off card debt for envelope: <strong>{inspectEntry.categoryName}</strong>.
                  </p>
                </div>

                {/* Show card transactions settled */}
                {(() => {
                  const lines = reconciliationLines.filter(
                    l => l.reconciliation_id === (inspectEntry.raw as Reconciliation).id
                  );
                  if (lines.length === 0) return null;

                  return (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#78716C]">
                        Transactions Paid Off ({lines.length})
                      </span>
                      <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1">
                        {lines.map(line => {
                          const settledTx = transactions.find(t => t.id === line.transaction_id);
                          return (
                            <div
                              key={line.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 border border-[#E8E3DA] dark:border-[#2D2823] text-xs"
                            >
                              <span className="truncate pr-2">
                                {settledTx?.note || 'Card Spend'} ({settledTx?.date || 'Past'})
                              </span>
                              <span className="font-amount font-semibold shrink-0">
                                {formatPaise(line.amount_applied)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {inspectEntry.type === 'category_topup' && (
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823]">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] block mb-0.5">
                    Funding Source & Destination
                  </span>
                  <p className="text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
                    <strong>{inspectEntry.topupSource || 'Direct Top-Up'}</strong> added directly into <strong>{inspectEntry.categoryName}</strong> envelope without monthly salary allocation flow.
                  </p>
                  <div className="mt-2 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                    Holding account:{' '}
                    <strong className="text-[#1F1B16] dark:text-[#EDE8E1]">
                      {inspectEntry.depositHolding === 'primary_account'
                        ? 'Primary Salary Account (Pending Transfer)'
                        : inspectEntry.depositHolding === 'cash'
                        ? 'Cash on Hand (Immediate)'
                        : 'Spend Account (Immediate UPI/Debit)'}
                    </strong>
                  </div>
                </div>

                {inspectEntry.note && (
                  <div className="p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block mb-0.5">
                      Note
                    </span>
                    <p className="text-xs text-[#1F1B16] dark:text-[#EDE8E1]">{inspectEntry.note}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E8E3DA] dark:border-[#2D2823]">
              {(inspectEntry.type === 'fund_move' || inspectEntry.type === 'reconcile' || inspectEntry.type === 'category_topup') ? (
                confirmDeleteAction ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-xs font-semibold text-[#87341D] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Revert this entry?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmDeleteAction(false)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[#DCD5C9] dark:border-[#3D362F]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRevertEntry}
                        id="confirm-revert-ledger-entry-btn"
                        className="px-3 py-1 text-xs rounded-lg bg-[#87341D] text-white font-medium hover:opacity-90"
                      >
                        Yes, Revert
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteAction(true)}
                    id="revert-ledger-entry-btn"
                    className="text-xs text-[#87341D] dark:text-[#E89E8C] hover:underline flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revert Entry</span>
                  </button>
                )
              ) : (
                <div />
              )}

              <button
                onClick={() => setInspectEntry(null)}
                id="close-inspect-dialog-btn"
                className="px-4 py-1.5 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold ml-auto"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
