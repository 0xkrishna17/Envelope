import React from 'react';
import { CategoryBalanceInfo } from '../types';
import { formatPaise } from '../utils/currency';
import { renderCategoryIcon } from '../utils/categoryTheme';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface CategoryCardProps {
  balanceInfo: CategoryBalanceInfo;
  onOpenDetail: (catId: string) => void;
  onQuickAddSpend?: (catId: string) => void;
  onOpenMoveFunds?: (catId: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  balanceInfo,
  onOpenDetail,
}) => {
  const { category, availableNow, thisMonthAllocated, pendingCardDebt } = balanceInfo;
  const isOverspent = availableNow < 0;
  const isUnfunded = availableNow === 0 && thisMonthAllocated === 0;

  const targetPaise = category.target_amount || 0;
  const targetPercent = targetPaise > 0 ? Math.min(100, Math.max(0, (availableNow / targetPaise) * 100)) : null;
  const isRunningLow = !isOverspent && targetPaise > 0 && availableNow > 0 && availableNow / targetPaise < 0.2;

  const stateStyles = isOverspent
    ? {
        card: 'bg-[#FDF2F0] dark:bg-[#2C1814] border-[#E8C5BC] dark:border-[#5E261B]',
        amount: 'text-[#B85D43] dark:text-[#F3B3A2]',
        progress: '#B85D43',
        label: 'Overdrawn',
      }
    : isRunningLow
    ? {
        card: 'bg-[#FFF8EA] dark:bg-[#2F2616] border-[#E8D8B5] dark:border-[#5A4521]',
        amount: 'text-[#AF7832] dark:text-[#E8C694]',
        progress: '#AF7832',
        label: 'Running low',
      }
    : {
        card: 'bg-[#FAF7F2] dark:bg-[#1A1714] border-[#E8E3DA] dark:border-[#2D2823] hover:border-[#D0C7B9] dark:hover:border-[#4A423B]',
        amount: 'text-[#1F1B16] dark:text-[#EDE8E1]',
        progress: category.color,
        label: 'Healthy',
      };

  return (
    <div
      onClick={() => onOpenDetail(category.id)}
      id={`category-card-${category.id}`}
      className={`group relative min-h-[72px] sm:min-h-[76px] overflow-hidden rounded-2xl border transition-all cursor-pointer hover:shadow-xs active:scale-[0.99] ${stateStyles.card}`}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-3.5 sm:py-3 min-h-[72px] sm:min-h-[76px]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs transition-transform group-hover:scale-105"
            style={{ backgroundColor: category.color }}
          >
            {renderCategoryIcon(category.icon, 'w-4 h-4')}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-sm sm:text-[13px] font-semibold text-[#1F1B16] dark:text-[#EDE8E1] truncate leading-tight">
                {category.name}
              </h4>
              {isOverspent && <AlertTriangle className="w-3.5 h-3.5 text-[#B85D43] shrink-0" />}
              {pendingCardDebt > 0 && !isOverspent && (
                <CreditCard className="w-3.5 h-3.5 text-[#AF7832] shrink-0" />
              )}
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[10px] text-[#78716C] dark:text-[#A8A29E] leading-tight min-w-0">
              {category.is_unallocated ? (
                <span className="font-medium text-[#486B88] truncate">Surplus</span>
              ) : targetPaise > 0 ? (
                <span className="truncate">Target {formatPaise(targetPaise)}</span>
              ) : (
                <span className="truncate">No target</span>
              )}
              {(isRunningLow || isOverspent) && (
                <>
                  <span className="opacity-40">·</span>
                  <span className={`font-semibold truncate ${stateStyles.amount}`}>{stateStyles.label}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right max-w-[42%]">
          {isUnfunded ? (
            <div className="text-[11px] sm:text-[10px] font-semibold text-[#A8A29E] dark:text-[#78716C] leading-tight">
              Not funded yet
            </div>
          ) : (
            <div className={`text-base sm:text-sm font-amount font-semibold tracking-tight leading-tight truncate ${stateStyles.amount}`}>
              {formatPaise(availableNow)}
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-[#EFEAE1] dark:bg-[#28221D] overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: isOverspent ? '100%' : targetPercent !== null ? `${targetPercent}%` : isUnfunded ? '0%' : '100%',
            backgroundColor: stateStyles.progress,
            opacity: isUnfunded ? 0 : 1,
          }}
        />
      </div>
    </div>
  );
};
