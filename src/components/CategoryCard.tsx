import React from 'react';
import { CategoryBalanceInfo } from '../types';
import { formatPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { formatSelectedMonth } from '../utils/dateUtils';
import { useBudget } from '../context/BudgetContext';
import { AlertTriangle, Plus, CreditCard, ChevronRight, ArrowLeftRight } from 'lucide-react';

interface CategoryCardProps {
  balanceInfo: CategoryBalanceInfo;
  onOpenDetail: (catId: string) => void;
  onQuickAddSpend: (catId: string) => void;
  onOpenMoveFunds?: (catId: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  balanceInfo,
  onOpenDetail,
  onQuickAddSpend,
  onOpenMoveFunds,
}) => {
  const { category, availableNow, thisMonthAllocated, thisMonthSpent, pendingCardDebt } = balanceInfo;
  const { selectedMonth } = useBudget();
  const isOverspent = availableNow < 0;

  const monthLabel = React.useMemo(() => {
    return formatSelectedMonth(selectedMonth, 'short');
  }, [selectedMonth]);

  // Optional informational target percentage
  const targetPaise = category.target_amount || 0;
  const targetPercent = targetPaise > 0 ? Math.min(100, Math.max(0, (availableNow / targetPaise) * 100)) : null;

  return (
    <div
      onClick={() => onOpenDetail(category.id)}
      id={`category-card-${category.id}`}
      className={`group relative flex flex-col p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer hover:shadow-xs active:scale-[0.99] ${
        isOverspent
          ? 'bg-[#FDF2F0] dark:bg-[#2C1814] border-[#E8C5BC] dark:border-[#5E261B]'
          : 'bg-[#FAF7F2] dark:bg-[#1A1714] border-[#E8E3DA] dark:border-[#2D2823] hover:border-[#D0C7B9] dark:hover:border-[#4A423B]'
      }`}
    >
      {/* Top Header Row: Icon + Category Name (Left) + Quick Spend Button (Right) */}
      <div className="flex items-start justify-between gap-1.5">
        {/* Envelope Identity */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs transition-transform group-hover:scale-105"
            style={{ backgroundColor: category.color }}
          >
            {renderCategoryIcon(category.icon, 'w-3 h-3 sm:w-3.5 sm:h-3.5')}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate leading-tight">
              {category.name}
            </h4>
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-[#78716C] dark:text-[#A8A29E] leading-tight mt-0.5 truncate">
              {category.is_unallocated ? (
                <span className="font-medium text-[#486B88]">Surplus</span>
              ) : category.target_amount ? (
                <span className="truncate">Tgt: {formatPaise(category.target_amount)}</span>
              ) : (
                <span>Envelope</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Spend Button */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onQuickAddSpend(category.id);
          }}
          id={`quick-spend-cat-${category.id}`}
          title="Quick log spend for this envelope"
          className="p-1 sm:p-1.5 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors shrink-0"
        >
          <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>

      {/* Available Amount */}
      <div className="mt-2 flex items-baseline justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-[#78716C] dark:text-[#A8A29E] leading-none">
          Available
        </span>
        <div
          className={`text-sm sm:text-base font-amount font-semibold tracking-tight leading-none ${
            isOverspent
              ? 'text-[#B85D43] dark:text-[#F3B3A2]'
              : 'text-[#1F1B16] dark:text-[#EDE8E1]'
          }`}
        >
          {formatPaise(availableNow)}
        </div>
      </div>

      {/* Target Progress Bar (slim 1px/1.5px) */}
      {targetPercent !== null && (
        <div className="mt-1.5 w-full h-1 rounded-full bg-[#EFEAE1] dark:bg-[#28221D] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${targetPercent}%`,
              backgroundColor: category.color,
            }}
          />
        </div>
      )}

      {/* Bottom Row: Month Slice + Overspent or Card Debt alert */}
      <div className="mt-2 pt-1.5 border-t border-[#E8E3DA]/70 dark:border-[#2D2823]/70 flex items-center justify-between text-[9px] sm:text-[10px] text-[#78716C] dark:text-[#A8A29E] gap-1">
        <div className="truncate flex items-center gap-0.5">
          <span className="text-[#4E785E] font-amount font-medium">+{formatPaise(thisMonthAllocated)}</span>
          <span className="opacity-40">·</span>
          <span className="text-[#87341D] font-amount font-medium">-{formatPaise(thisMonthSpent)}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isOverspent && (
            <span className="inline-flex items-center gap-0.5 text-[#B85D43] font-semibold text-[9px]">
              <AlertTriangle className="w-2.5 h-2.5" /> Deficit
            </span>
          )}

          {pendingCardDebt > 0 && !isOverspent && (
            <span className="inline-flex items-center gap-0.5 text-[#AF7832] dark:text-[#E8C694] font-medium text-[8px] sm:text-[9px]">
              <CreditCard className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> {formatPaise(pendingCardDebt)}
            </span>
          )}

          <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity hidden sm:inline" />
        </div>
      </div>
    </div>
  );
};
