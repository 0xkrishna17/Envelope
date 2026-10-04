import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise, rupeesToPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { ArrowLeft, Check, Plus, Minus, Landmark, Save, Percent, Scale, RefreshCw } from 'lucide-react';
import { isWholeRupeeInput, parseWholeRupeeInput } from '../utils/wholeRupeeInput';
import { clampDateInputToToday, getTodayDateInputValue } from '../utils/dateUtils';

interface SalaryArrivalModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  onSuccessOpenChecklist?: () => void;
  initialAmountPaise?: number;
}

export const SalaryArrivalScreen: React.FC<SalaryArrivalModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  onSuccessOpenChecklist,
  initialAmountPaise,
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };
  const {
    members,
    activeMember,
    activeCategories,
    salaryEvents,
    allocations,
    addSalaryAndAllocations,
  } = useBudget();

  // Step 2: Earner selection (defaults to active user)
  const [selectedEarnerId, setSelectedEarnerId] = useState<string>(activeMember.user_id);
  const [salaryAmountRupees, setSalaryAmountRupees] = useState<string>('150000');
  const [date, setDate] = useState<string>(() => getTodayDateInputValue());

  // Mode: show percentage weight controls
  const [showPercentages, setShowPercentages] = useState<boolean>(true);

  // Envelope percentage weights map: categoryId -> percentage number (0-100)
  const [percentages, setPercentages] = useState<Record<string, number>>({});

  // Category allocations map: categoryId -> rupees number
  const [allocationsDraft, setAllocationsDraft] = useState<Record<string, number>>({});

  // Non-unallocated categories (real spend envelopes)
  const nonUnallocatedCategories = useMemo(() => {
    return activeCategories.filter(c => !c.is_unallocated);
  }, [activeCategories]);

  // Compute equal percentage distribution across envelopes
  const getEqualPercentages = useCallback((cats: typeof nonUnallocatedCategories) => {
    if (cats.length === 0) return {};
    const count = cats.length;
    const basePct = Math.floor((100 / count) * 10) / 10;
    const pcts: Record<string, number> = {};
    let sum = 0;
    cats.forEach((cat, index) => {
      if (index === count - 1) {
        // Last category gets remaining to sum exactly to 100
        pcts[cat.id] = Math.max(0, Number((100 - sum).toFixed(1)));
      } else {
        pcts[cat.id] = basePct;
        sum += basePct;
      }
    });
    return pcts;
  }, []);

  // Divide total salary amount into draft allocations based on percentages
  const divideAmountByPercentages = useCallback(
    (totalRupees: number, pcts: Record<string, number>, cats: typeof nonUnallocatedCategories) => {
      const draft: Record<string, number> = {};
      if (totalRupees <= 0 || cats.length === 0) {
        cats.forEach(c => {
          draft[c.id] = 0;
        });
        return draft;
      }

      cats.forEach(cat => {
        const pct = pcts[cat.id] ?? (100 / cats.length);
        draft[cat.id] = Math.round(totalRupees * (pct / 100));
      });
      return draft;
    },
    []
  );

  // Initialize and auto-divide on mount or when categories change
  useEffect(() => {
    if (!isOpen) return;

    setSelectedEarnerId(activeMember.user_id);
    setDate(getTodayDateInputValue());

    // Check for saved percentage preferences in localStorage
    let savedPcts: Record<string, number> | null = null;
    try {
      const stored = localStorage.getItem('env_budget_salary_percentages');
      if (stored) savedPcts = JSON.parse(stored);
    } catch {}

    // Check if all non-unallocated categories are present in saved percentages
    const hasAllCats = savedPcts && nonUnallocatedCategories.every(c => typeof savedPcts![c.id] === 'number');
    const activePcts = hasAllCats ? savedPcts! : getEqualPercentages(nonUnallocatedCategories);
    setPercentages(activePcts);

    // Initial salary amount (voice intent amount, else last salary event or ₹1,50,000)
    const lastEvent = salaryEvents.find(s => s.earner_user_id === activeMember.user_id);
    const initialRupees = initialAmountPaise && initialAmountPaise > 0
      ? Math.trunc(initialAmountPaise / 100)
      : lastEvent
      ? lastEvent.amount / 100
      : 150000;
    setSalaryAmountRupees(initialRupees.toString());

    // Auto-divide money into equal parts (or saved percentages)
    const initialDraft = divideAmountByPercentages(initialRupees, activePcts, nonUnallocatedCategories);
    setAllocationsDraft(initialDraft);
  }, [
    isOpen,
    activeMember.user_id,
    initialAmountPaise,
    salaryEvents,
    nonUnallocatedCategories,
    getEqualPercentages,
    divideAmountByPercentages,
  ]);

  // When total salary amount changes: auto-divide immediately.
  // Salary flow supports any whole rupee amount; decimals/floating values are rejected.
  const handleSalaryAmountChange = (newAmountStr: string) => {
    if (!isWholeRupeeInput(newAmountStr)) return;

    setSalaryAmountRupees(newAmountStr);
    const totalRupees = parseWholeRupeeInput(newAmountStr);
    const nextDraft = divideAmountByPercentages(totalRupees, percentages, nonUnallocatedCategories);
    setAllocationsDraft(nextDraft);
  };

  // Reset to equal percentage parts across all envelopes
  const handleEqualizePercentages = () => {
    const equalPcts = getEqualPercentages(nonUnallocatedCategories);
    setPercentages(equalPcts);
    const totalRupees = parseWholeRupeeInput(salaryAmountRupees);
    const nextDraft = divideAmountByPercentages(totalRupees, equalPcts, nonUnallocatedCategories);
    setAllocationsDraft(nextDraft);
  };

  // User edits an envelope percentage directly
  const handlePercentageChange = (catId: string, newPctVal: number) => {
    const safePct = Math.max(0, Math.min(100, newPctVal));
    const nextPcts = { ...percentages, [catId]: safePct };
    setPercentages(nextPcts);

    const totalRupees = parseWholeRupeeInput(salaryAmountRupees);
    setAllocationsDraft(prev => ({
      ...prev,
      [catId]: Math.round(totalRupees * (safePct / 100)),
    }));
  };

  // User edits an envelope rupee amount directly.
  // Supports any whole rupee value; decimals/floating values are rejected.
  const handleUpdateCategoryAmount = (catId: string, value: number | string) => {
    const parsedValue = typeof value === 'string' ? parseWholeRupeeInput(value) : value;
    if (typeof value === 'string' && !isWholeRupeeInput(value)) return;

    const safeVal = Math.max(0, parsedValue);
    setAllocationsDraft(prev => ({
      ...prev,
      [catId]: safeVal,
    }));

    // Sync percentage
    const totalRupees = parseWholeRupeeInput(salaryAmountRupees);
    if (totalRupees > 0) {
      const derivedPct = Number(((safeVal / totalRupees) * 100).toFixed(4));
      setPercentages(prev => ({
        ...prev,
        [catId]: derivedPct,
      }));
    }
  };

  const handleStepper = (catId: string, deltaRupees: number) => {
    const currentVal = allocationsDraft[catId] || 0;
    const nextVal = Math.max(0, currentVal + deltaRupees);
    handleUpdateCategoryAmount(catId, nextVal);
  };

  // Handle earner switch
  const handleEarnerChange = (earnerId: string) => {
    setSelectedEarnerId(earnerId);
    const lastEvent = salaryEvents.find(s => s.earner_user_id === earnerId);
    if (lastEvent) {
      const rupees = lastEvent.amount / 100;
      setSalaryAmountRupees(rupees.toString());
      const nextDraft = divideAmountByPercentages(rupees, percentages, nonUnallocatedCategories);
      setAllocationsDraft(nextDraft);
    }
  };

  const totalSalaryPaise = useMemo(() => {
    return rupeesToPaise(salaryAmountRupees);
  }, [salaryAmountRupees]);

  const allocatedPaiseSum = useMemo(() => {
    let sum = 0;
    nonUnallocatedCategories.forEach(cat => {
      const rupees = allocationsDraft[cat.id] || 0;
      sum += Math.round(rupees * 100);
    });
    return sum;
  }, [nonUnallocatedCategories, allocationsDraft]);

  const totalPercentageSum = useMemo(() => {
    return Number(
      nonUnallocatedCategories
        .reduce((sum, cat) => sum + (percentages[cat.id] || 0), 0)
        .toFixed(1)
    );
  }, [nonUnallocatedCategories, percentages]);

  const residualUnallocatedPaise = Math.max(0, totalSalaryPaise - allocatedPaiseSum);
  const isOverAllocated = allocatedPaiseSum > totalSalaryPaise;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSalaryPaise <= 0 || isOverAllocated) return;

    // Persist customized percentage weights to localStorage
    try {
      localStorage.setItem('env_budget_salary_percentages', JSON.stringify(percentages));
    } catch {}

    const allocList = nonUnallocatedCategories.map(cat => ({
      categoryId: cat.id,
      amountPaise: Math.round((allocationsDraft[cat.id] || 0) * 100),
    }));

    addSalaryAndAllocations(selectedEarnerId, totalSalaryPaise, clampDateInputToToday(date), allocList);
    handleBack();
    if (onSuccessOpenChecklist) {
      onSuccessOpenChecklist();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-3xl mx-auto pb-24 animate-in fade-in duration-200">
      {/* Screen Navigation Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <button
          type="button"
          onClick={handleBack}
          id="close-salary-modal"
          className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2.5 sm:py-1.5 rounded-xl bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#78716C]" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#4E785E]/20 text-[#2C523B] dark:text-[#A8D1B7] flex items-center justify-center shadow-xs">
            <Landmark className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            Salary Arrived & Envelope Allocation
          </h2>
        </div>
      </div>

      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs overflow-hidden">
        {/* Subtitle Bar */}
        <div className="px-5 py-3 border-b border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30">
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
            Allocate monthly paycheck into spend envelope accounts (§4.1)
          </p>
        </div>

        <form onSubmit={handleConfirm} className="p-5 sm:p-7 flex flex-col gap-5">
          {/* Earner Selector (§4.1 step 2) */}
          <div>
            <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1.5">
              1. Whose Salary Arrived?
            </label>
            <div className="flex items-center gap-2">
              {members.map(member => {
                const isSelected = member.user_id === selectedEarnerId;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleEarnerChange(member.user_id)}
                    id={`earner-select-${member.name.toLowerCase()}`}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[#1F1B16] dark:border-[#EDE8E1] bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] shadow-xs'
                        : 'border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 text-[#78716C] dark:text-[#A8A29E]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: member.avatar_color }}
                    />
                    <span>{member.name}'s Salary</span>
                    {isSelected && <Check className="w-3.5 h-3.5 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salary Amount & Date (§4.1 step 3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="salary-amount-input" className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                2. Salary Amount (₹)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-lg font-serif text-[#78716C]">₹</span>
                <input
                  id="salary-amount-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="150000"
                  value={salaryAmountRupees}
                  onChange={e => handleSalaryAmountChange(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-lg font-amount font-semibold text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none focus:ring-2 focus:ring-[#1F1B16]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="salary-date-input" className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E] block mb-1">
                Date Arrived
              </label>
              <input
                id="salary-date-input"
                type="date"
                value={date}
                max={getTodayDateInputValue()}
                onChange={e => setDate(clampDateInputToToday(e.target.value))}
                required
                className="w-full px-3 py-2 bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs font-medium text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none"
              />
            </div>
          </div>

          {/* Running Balance Summary Banner (§4.1 step 4 & 5) */}
          <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
            isOverAllocated
              ? 'bg-[#F9ECE8] dark:bg-[#331D16] border-[#E8C5BC] text-[#87341D] dark:text-[#F3B3A2]'
              : 'bg-[#EBF1F6] dark:bg-[#1B2936] border-[#C6D8E7] text-[#24425A] dark:text-[#A4C4DF]'
          }`}>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold block">
                {isOverAllocated ? '⚠️ Over-allocated by' : 'Leftover rolls into "Unallocated"'}
              </span>
              <span className="text-sm font-semibold font-amount">
                {isOverAllocated
                  ? formatPaise(allocatedPaiseSum - totalSalaryPaise)
                  : `${formatPaise(residualUnallocatedPaise)} available for surplus`}
              </span>
            </div>
            <div className="text-right text-xs">
              <span className="block opacity-75">Allocated so far:</span>
              <strong className="font-amount font-semibold">{formatPaise(allocatedPaiseSum)}</strong>
            </div>
          </div>

          {/* Category Allocation Steppers & Percentages */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
              <div>
                <label className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] block">
                  3. Allocate to Spend Account Envelopes
                </label>
                <span className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                  Auto-divided by envelope weights. Adjust % or ₹ directly.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEqualizePercentages}
                  id="equalize-percentages-btn"
                  title="Divide equally across all envelopes"
                  className="px-2.5 py-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[11px] font-semibold text-[#486B88] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Scale className="w-3 h-3" />
                  <span>Equalize All (Equal %)</span>
                </button>

                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    totalPercentageSum === 100
                      ? 'bg-[#4E785E]/10 border-[#4E785E]/30 text-[#4E785E]'
                      : totalPercentageSum > 100
                      ? 'bg-[#B85D43]/10 border-[#B85D43]/30 text-[#B85D43]'
                      : 'bg-[#AF7832]/10 border-[#AF7832]/30 text-[#AF7832]'
                  }`}
                  title="Total percentage allocated"
                >
                  {totalPercentageSum}% Total
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {nonUnallocatedCategories.map(cat => {
                const currentVal = allocationsDraft[cat.id] || 0;
                const currentPct = percentages[cat.id] ?? 0;
                return (
                  <div
                    key={cat.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30 gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        {renderCategoryIcon(cat.icon, 'w-4 h-4')}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] block truncate">
                          {cat.name}
                        </span>
                        {cat.target_amount ? (
                          <span className="text-[10px] text-[#78716C] dark:text-[#A8A29E]">
                            target {formatPaise(cat.target_amount)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 shrink-0">
                      {/* Weight / Percentage Input */}
                      <div className="flex items-center gap-1 bg-[#FAF7F2] dark:bg-[#1A1714] px-2 py-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F]">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={currentPct || ''}

                          onChange={e => handlePercentageChange(cat.id, parseFloat(e.target.value) || 0)}
                          id={`alloc-pct-${cat.id}`}
                          aria-label={`${cat.name} percentage`}
                          className="w-11 text-xs font-mono font-semibold text-right bg-transparent text-[#1F1B16] dark:text-[#EDE8E1] focus:outline-none"
                        />
                        <span className="text-[10px] font-bold text-[#78716C]">%</span>
                      </div>

                      {/* Rupee Steppers & Input */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStepper(cat.id, -500)}
                          className="p-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#FAF7F2] text-[#78716C] dark:hover:bg-[#1A1714] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative w-24">
                          <span className="absolute left-2 top-1.5 text-xs text-[#78716C]">₹</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={currentVal || ''}
                            onChange={e => handleUpdateCategoryAmount(cat.id, e.target.value)}
                            id={`alloc-input-${cat.id}`}
                            className="w-full pl-5 pr-1.5 py-1 text-xs font-amount font-semibold bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-lg text-right text-[#1F1B16] dark:text-[#EDE8E1]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStepper(cat.id, 500)}
                          className="p-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#FAF7F2] text-[#78716C] dark:hover:bg-[#1A1714] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm & Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={totalSalaryPaise <= 0 || isOverAllocated}
              id="confirm-salary-allocation-btn"
              className="w-full py-3 px-4 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] font-medium text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save & Confirm Salary Allocation</span>
            </button>
            <p className="text-[11px] text-center text-[#78716C] dark:text-[#A8A29E] mt-1.5">
              Saves percentage weights and generates bank transfer tasks for Spend envelopes (§4.1)
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SalaryArrivalModal = SalaryArrivalScreen;
