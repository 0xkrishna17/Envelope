import React, { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { formatPaise } from '../utils/currency';
import { calculateCategoryPendingDebt } from '../utils/budgetLogic';
import { ArrowLeft, Bell, Check, X, Clock, Globe, Smartphone, Send } from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
}

export const NotificationSettingsScreen: React.FC<NotificationSettingsModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
}) => {
  const handleBack = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };
  const {
    pushSettings,
    updatePushSettings,
    activeCategories,
    transactions,
    reconciliationLines,
  } = useBudget();

  const [reminderTime, setReminderTime] = useState<string>(pushSettings.reminder_time);
  const [enabled, setEnabled] = useState<boolean>(pushSettings.enabled);
  const [simulatedNotification, setSimulatedNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute live preview of notification text (§4.5: "₹2,400 across Food, Travel still owed to the Salary a/c")
  const pendingDebts = activeCategories.map(cat => {
    const { totalPendingDebt } = calculateCategoryPendingDebt(cat.id, transactions, reconciliationLines);
    return { name: cat.name, amount: totalPendingDebt };
  }).filter(d => d.amount > 0);

  const totalPendingPaise = pendingDebts.reduce((sum, d) => sum + d.amount, 0);

  const liveNotificationText =
    totalPendingPaise > 0
      ? `${formatPaise(totalPendingPaise)} across ${pendingDebts.map(d => d.name).slice(0, 3).join(', ')}${
          pendingDebts.length > 3 ? '...' : ''
        } still owed to the Salary a/c`
      : 'All credit card spend is settled! No transfers needed today.';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePushSettings(reminderTime, enabled);
    handleBack();
  };

  const handleTestNotification = () => {
    setSimulatedNotification(liveNotificationText);
    setTimeout(() => {
      setSimulatedNotification(null);
    }, 4500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-24 animate-in fade-in duration-200">
      {/* Screen Navigation Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E3DA] dark:border-[#2D2823]">
        <button
          type="button"
          onClick={handleBack}
          id="close-notifications-modal"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] transition-colors cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#78716C]" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#AF7832]/20 text-[#AF7832] flex items-center justify-center shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <h2 className="text-base font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
            Daily Payback Reminder (§4.5)
          </h2>
        </div>
      </div>

      <div className="bg-[#FAF7F2] dark:bg-[#1A1714] rounded-2xl border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs overflow-hidden">
        {/* Subtitle Bar */}
        <div className="px-5 py-3 border-b border-[#E8E3DA] dark:border-[#2D2823] bg-[#EFEAE1]/30 dark:bg-[#28221D]/30">
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
            A scheduled reminder fires each evening for household partners if any credit card spend is still awaiting transfer from Spend → Salary account
          </p>
        </div>

        <form onSubmit={handleSave} className="p-5 sm:p-7 flex flex-col gap-4">

          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#DCD5C9] dark:border-[#3D362F]">
            <div>
              <span className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] block">
                Enable Daily Web Push
              </span>
              <span className="text-[10px] text-[#78716C]">
                Chrome / Android supported (VAPID)
              </span>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              id="reminder-enabled-toggle"
              className="w-5 h-5 accent-[#1F1B16] cursor-pointer"
            />
          </div>

          {/* Time & Timezone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#78716C] block mb-1">
                Reminder Time
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                id="reminder-time-input"
                className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#78716C] block mb-1">
                Timezone
              </label>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#EFEAE1]/40 dark:bg-[#28221D]/40 border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl text-xs text-[#78716C]">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Asia/Kolkata (IST)</span>
              </div>
            </div>
          </div>

          {/* Live Notification Preview (§4.5) */}
          <div className="bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] rounded-xl p-3.5 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#78716C] flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Live Push Preview
            </span>
            <div className="text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
              Envelope Budgeting • {reminderTime}
            </div>
            <div className="text-xs text-[#78716C] dark:text-[#A8A29E] bg-[#EFEAE1]/60 dark:bg-[#28221D]/60 p-2 rounded-lg border border-[#DCD5C9]/60">
              "{liveNotificationText}"
            </div>
          </div>

          {/* Test push trigger */}
          <button
            type="button"
            onClick={handleTestNotification}
            id="test-notification-trigger"
            className="w-full py-2 px-3 rounded-xl border border-[#AF7832] text-[#AF7832] text-xs font-semibold hover:bg-[#F7EFE4] transition-colors flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Test Notification Popup</span>
          </button>

          {/* Simulated Banner */}
          {simulatedNotification && (
            <div className="p-3 rounded-xl bg-[#1F1B16] text-[#FAF7F2] text-xs shadow-lg animate-in slide-in-from-top flex items-center justify-between">
              <div>
                <span className="font-semibold block text-[11px] text-[#A8D1B7]">
                  🔔 Notification Received
                </span>
                <span>{simulatedNotification}</span>
              </div>
              <button
                type="button"
                onClick={() => setSimulatedNotification(null)}
                className="text-[#A8A29E] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Save */}
          <div className="pt-2">
            <button
              type="submit"
              id="save-notifications-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Save Schedule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const NotificationSettingsModal = NotificationSettingsScreen;
