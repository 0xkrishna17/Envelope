import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { CheckSquare, Square, ChevronDown, ChevronUp, Check, ExternalLink, Landmark } from 'lucide-react';

export const TransferChecklistCard: React.FC = () => {
  const {
    pendingTransfersList,
    toggleAllocationTransferred,
    markAllAllocationsTransferred,
  } = useBudget();

  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (pendingTransfersList.length === 0) {
    return null;
  }

  const totalPendingTransferPaise = pendingTransfersList.reduce(
    (sum, item) => sum + item.planned_amount,
    0
  );

  return (
    <div id="transfer-checklist-card" className="bg-[#EFEAE1]/70 dark:bg-[#28221D]/70 border border-[#DCD5C9] dark:border-[#3D362F] rounded-2xl p-3.5 sm:p-4 shadow-xs mb-5 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#AF7832] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Landmark className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A4E15] dark:text-[#E8C694] leading-snug">
                Bank Transfers to Spend Account
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#AF7832]/15 text-[#7A4E15] dark:text-[#E8C694] shrink-0">
                {pendingTransfersList.length} remaining
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
              Execute in banking app (Salary a/c → Spend a/c), then check off
            </p>
          </div>

          {/* Mobile-only collapse chevron button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            id="toggle-transfer-checklist-btn-mobile"
            className="sm:hidden p-1.5 rounded-lg text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] shrink-0 -mt-1 -mr-1"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            onClick={() => markAllAllocationsTransferred()}
            id="mark-all-transfers-btn"
            className="text-[11px] font-semibold text-[#7A4E15] dark:text-[#E8C694] hover:underline px-2 py-1 rounded-md hover:bg-[#AF7832]/10 transition-colors"
          >
            Mark All Done
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            id="toggle-transfer-checklist-btn"
            className="p-1 rounded-lg text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1]"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="mt-3 sm:mt-3.5 flex flex-col gap-2 pt-2.5 border-t border-[#DCD5C9]/60 dark:border-[#3D362F]/60">
          <div className="flex items-center justify-between text-[11px] text-[#78716C] dark:text-[#A8A29E] px-1">
            <span>
              Total to move into envelopes: <strong className="font-amount font-semibold text-xs text-[#1F1B16] dark:text-[#EDE8E1]">{formatPaise(totalPendingTransferPaise)}</strong>
            </span>
            {/* Mobile Mark All Done button placed in expanded section for clear hierarchy */}
            <button
              onClick={() => markAllAllocationsTransferred()}
              id="mark-all-transfers-btn-mobile"
              className="sm:hidden text-[11px] font-semibold text-[#7A4E15] dark:text-[#E8C694] hover:underline px-2 py-0.5 rounded-md bg-[#AF7832]/10 active:bg-[#AF7832]/20 transition-colors"
            >
              Mark All Done
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {pendingTransfersList.map(alloc => (
              <div
                key={alloc.id}
                onClick={() => toggleAllocationTransferred(alloc.id)}
                id={`transfer-item-${alloc.id}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] cursor-pointer hover:border-[#AF7832] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: alloc.categoryColor }}
                  >
                    {renderCategoryIcon(alloc.categoryIcon, 'w-3.5 h-3.5')}
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] block truncate">
                      {alloc.categoryName}
                    </span>
                    <span className="text-[10px] text-[#78716C]">
                      Transfer to Spend Account
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-amount font-semibold text-xs text-[#1F1B16] dark:text-[#EDE8E1]">
                    {formatPaise(alloc.planned_amount)}
                  </span>
                  <div className="text-[#AF7832] p-0.5">
                    <Square className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
