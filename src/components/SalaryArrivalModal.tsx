import React, { useState, useEffect, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise, rupeesToPaise, paiseToRupees } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { X, Check, ArrowRight, UserCheck, Plus, Minus, Landmark } from 'lucide-react';

interface SalaryArrivalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessOpenChecklist?: () => void;
}

export const SalaryArrivalModal: React.FC<SalaryArrivalModalProps> = ({
  isOpen,
  onClose,
  onSuccessOpenChecklist,
}) => {
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
  const [salaryAmountRupees, setSalaryAmountRupees] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Category allocations map: categoryId -> rupees string
  const [allocationsDraft, setAllocationsDraft] = useState<Record<string, number>>({});

  // Prefill when earner changes (§4.1: prefilled with that earner's last SalaryEvent)
  useEffect(() => {
    if (!isOpen) return;

    setSelectedEarnerId(activeMember.user_id);
    setDate(new Date().toISOString().split('T')[0]);

    // Find last salary event for earner
    const lastEvent = salaryEvents.find(s => s.earner_user_id === activeMember.user_id);
    if (lastEvent) {
      setSalaryAmountRupees((lastEvent.amount / 100).toString());

      // Find allocations for that salary event
      const eventAllocations = allocations.filter(a => a.salary_event_id === lastEvent.id && !a.deleted_at);
      const draft: Record<string, number> = {};
      eventAllocations.forEach(a => {
        // Exclude unallocated from explicit draft inputs; it's computed as residual
        draft[a.category_id] = a.planned_amount / 100;
      });
      setAllocationsDraft(draft);
    } else {
      setSalaryAmountRupees('150000');
      // Set reasonable defaults based on category targets
      const draft: Record<string, number> = {};
      activeCategories.forEach(cat => {
        if (!cat.is_unallocated) {
          draft[cat.id] = cat.target_amount ? cat.target_amount / 100 : 10000;
        }
      });
      setAllocationsDraft(draft);
    }
  }, [isOpen, activeMember.user_id, salaryEvents, allocations, activeCategories]);

  // Handle earner switch
  const handleEarnerChange = (earnerId: string) => {
    setSelectedEarnerId(earnerId);
    const lastEvent = salaryEvents.find(s => s.earner_user_id === earnerId);
    if (lastEvent) {
      setSalaryAmountRupees((lastEvent.amount / 100).toString());
      const eventAllocations = allocations.filter(a => a.salary_event_id === lastEvent.id && !a.deleted_at);
      const draft: Record<string, number> = {};
      eventAllocations.forEach(a => {
        draft[a.category_id] = a.planned_amount / 100;
      });
      setAllocationsDraft(draft);
    }
  };

  const totalSalaryPaise = useMemo(() => {
    return rupeesToPaise(salaryAmountRupees);
  }, [salaryAmountRupees]);

  // Calculate sum of category draft allocations (excluding unallocated bucket)
  const nonUnallocatedCategories = useMemo(() => {
    return activeCategories.filter(c => !c.is_unallocated);
  }, [activeCategories]);

  const allocatedPaiseSum = useMemo(() => {
    let sum = 0;
    nonUnallocatedCategories.forEach(cat => {
      const rupees = allocationsDraft[cat.id] || 0;
      sum += Math.round(rupees * 100);
    });
    return sum;
  }, [nonUnallocatedCategories, allocationsDraft]);

  const residualUnallocatedPaise = Math.max(0, totalSalaryPaise - allocatedPaiseSum);
  const isOverAllocated = allocatedPaiseSum > totalSalaryPaise;

  const handleUpdateCategoryAmount = (catId: string, value: number) => {
    setAllocationsDraft(prev => ({
      ...prev,
      [catId]: Math.max(0, value),
    }));
  };

  const handleStepper = (catId: string, deltaRupees: number) => {
    setAllocationsDraft(prev => {
      const current = prev[catId] || 0;
      return {
        ...prev,
        [catId]: Math.max(0, current + deltaRupees),
      };
    });
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSalaryPaise <= 0 || isOverAllocated) return;

    const allocList = nonUnallocatedCategories.map(cat => ({
      categoryId: cat.id,
      amountPaise: Math.round((allocationsDraft[cat.id] || 0) * 100),
    }));

    addSalaryAndAllocations(selectedEarnerId, totalSalaryPaise, date, allocList);
    onClose();
    if (onSuccessOpenChecklist) {
      onSuccessOpenChecklist();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg bg-[#FAF7F2] dark:bg-[#1A1714] rounded-t-2xl sm:rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xl overflow-hidden animate-in slide-in-from-bottom duration-200 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
          <div>
            <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              Salary Arrived & Envelope Allocation
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              Allocate into spend envelope accounts (§4.1)
            </p>
          </div>
          <button
            onClick={onClose}
            id="close-salary-modal"
            className="p-1.5 rounded-full text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
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
                  type="number"
                  step="any"
                  placeholder="150000"
                  value={salaryAmountRupees}
                  onChange={e => setSalaryAmountRupees(e.target.value)}
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
                onChange={e => setDate(e.target.value)}
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

          {/* Category Allocation Steppers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
                3. Allocate to Spend Account Envelopes
              </label>
              <span className="text-[11px] text-[#78716C]">Adjust with steppers or type</span>
            </div>

            <div className="flex flex-col gap-2">
              {nonUnallocatedCategories.map(cat => {
                const currentVal = allocationsDraft[cat.id] || 0;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30"
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStepper(cat.id, -500)}
                        className="p-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#FAF7F2] text-[#78716C] dark:hover:bg-[#1A1714]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative w-24">
                        <span className="absolute left-2 top-1.5 text-xs text-[#78716C]">₹</span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={currentVal || ''}
                          onChange={e => handleUpdateCategoryAmount(cat.id, parseFloat(e.target.value) || 0)}
                          id={`alloc-input-${cat.id}`}
                          className="w-full pl-5 pr-1.5 py-1 text-xs font-amount font-semibold bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-lg text-right text-[#1F1B16] dark:text-[#EDE8E1]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStepper(cat.id, 500)}
                        className="p-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#FAF7F2] text-[#78716C] dark:hover:bg-[#1A1714]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm & Generate Transfer Checklist Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={totalSalaryPaise <= 0 || isOverAllocated}
              id="confirm-salary-allocation-btn"
              className="w-full py-3 px-4 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] font-medium text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Generate Transfer Checklist</span>
            </button>
            <p className="text-[11px] text-center text-[#78716C] dark:text-[#A8A29E] mt-1.5">
              Creates bank transfer tasks for Spend account envelopes (§4.1)
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
