import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BudgetProvider, useBudget } from './context/BudgetContext';
import { Header } from './components/Header';
import { CategoryCard } from './components/CategoryCard';
import { TransferChecklistCard } from './components/TransferChecklistCard';
import { LogExpenseScreen } from './components/LogTransactionModal';
import { SalaryArrivalScreen } from './components/SalaryArrivalModal';
import { ReconcileScreen } from './components/ReconciliationModal';
import { EditTransactionScreen } from './components/EditTransactionModal';
import { EnvelopeDetailScreen } from './components/CategoryDetailModal';
import { VoiceInputScreen } from './components/VoiceInputModal';
import { NotificationSettingsScreen } from './components/NotificationSettingsModal';
import { CloudSyncScreen } from './components/CloudSyncScreen';
import { HouseholdInviteScreen } from './components/HouseholdInviteScreen';
import { TransactionLedger } from './components/TransactionLedger';
import { CategoryManagement } from './components/CategoryManagementModal';
import { SettingsTab } from './components/SettingsTab';
import { MoveFundsScreen } from './components/MoveFundsModal';
import { AddFundsScreen } from './components/AddCategoryFundsModal';
import { FloatingNavMenu } from './components/FloatingNavMenu';
import { ProfileScreen } from './components/ProfileModal';
import { AppTourGuide } from './components/AppTourGuide';
import { AccessDeniedGate } from './components/AccessDeniedGate';
import { InstallAppModal } from './components/InstallAppModal';
import { ResetDataWarningModal } from './components/ResetDataWarningModal';
import { usePwaInstall } from './hooks/usePwaInstall';
import { ApiLoadingProvider } from './context/ApiLoadingContext';
import { formatPaise, paiseToWords } from './utils/currency';
import { Transaction, ActiveTab } from './types';
import { Plus, PlusCircle, Wallet, RefreshCw, Layers, ShieldCheck, ArrowRight, ArrowLeftRight, Settings, User, ChevronLeft, ChevronRight } from 'lucide-react';

// App version as instructed by user: "lets add version no of app and with each iteration lets keep increasing version no at bottom right in small text."
export const APP_VERSION = 'v1.0.1';

function BudgetAppContent() {
  const {
    categoryBalances,
    totalAvailablePaise,
    totalPendingPaybackPaise,
    categories,
    selectedMonth,
    setSelectedMonth,
    isFirstTimeIntroCompleted,
    isAccessAllowed,
    cloudSetupStatus,
    isCloudBootstrapPending,
    syncNow,
    hasLocalEventsToImport,
    importLocalEventsToCloud,
    dismissLocalEventImport,
  } = useBudget();

  const { isInstalled, showInstallGuide, triggerInstall, closeInstallGuide, hasNativePrompt } = usePwaInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  const { user, loading: authLoading, profileLoading, userProfileCompleted, userIntroCompleted, markUserIntroCompleted } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('envelopes');

  // Unified Screen state (transforms all modals into screens)
  type ActiveScreen =
    | { type: 'log-expense'; preselectedCatId?: string; initialValues?: any }
    | { type: 'envelope-detail'; categoryId: string }
    | { type: 'salary-arrival'; initialAmountPaise?: number }
    | { type: 'reconcile'; categoryId?: string }
    | { type: 'add-funds'; categoryId?: string; initialAmount?: number }
    | { type: 'move-funds'; fromCatId?: string; toCatId?: string; amountPaise?: number }
    | { type: 'edit-transaction'; transaction: Transaction }
    | { type: 'voice-input' }
    | { type: 'profile'; isOnboarding?: boolean }
    | { type: 'notifications' };

  const [currentScreen, setCurrentScreen] = useState<ActiveScreen | null>(null);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  // For new users: ask their name & profile setup on first visit, then launch the interactive tour
  const handleOpenTourSafely = () => {
    setCurrentScreen(null);
    setIsTourOpen(true);
  };

  const localProfilePromptKey = user
    ? `env_budget_profile_completed_${user.uid}`
    : 'env_budget_profile_completed';

  useEffect(() => {
    if (authLoading || profileLoading) return;

    const hasCompletedProfile = user
      ? userProfileCompleted || localStorage.getItem(localProfilePromptKey) === 'true'
      : localStorage.getItem(localProfilePromptKey) === 'true';

    if (!hasCompletedProfile) {
      const timer = setTimeout(() => {
        setCurrentScreen({ type: 'profile', isOnboarding: true });
      }, 400);
      return () => clearTimeout(timer);
    } else {
      const hasCompletedIntro = user
        ? userIntroCompleted || isFirstTimeIntroCompleted
        : isFirstTimeIntroCompleted || localStorage.getItem('env_budget_first_time_intro_done') === 'true';

      if (!hasCompletedIntro) {
        const timer = setTimeout(() => {
          handleOpenTourSafely();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [authLoading, isFirstTimeIntroCompleted, localProfilePromptKey, profileLoading, user, userIntroCompleted, userProfileCompleted]);

  const handleCloseProfileScreen = () => {
    const wasOnboarding = currentScreen?.type === 'profile' && currentScreen.isOnboarding;
    setCurrentScreen(null);
    if (wasOnboarding) {
      localStorage.setItem(localProfilePromptKey, 'true');
      const hasCompletedIntro = user
        ? userIntroCompleted || isFirstTimeIntroCompleted
        : isFirstTimeIntroCompleted || localStorage.getItem('env_budget_first_time_intro_done') === 'true';
      if (!hasCompletedIntro) {
        setTimeout(() => {
          handleOpenTourSafely();
        }, 250);
      }
    }
  };

  const unallocatedBalance = categoryBalances.find(b => b.category.is_unallocated)?.availableNow || 0;

  // Month navigation (moved to left of Add Money above envelope list per user request)
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const formattedMonth = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }, [selectedMonth]);

  const activeEnvelopeCount = categories.filter(c => !c.deleted_at && !c.is_archived).length;

  // Screen openers
  const handleOpenAddFunds = (catId?: string) => {
    setCurrentScreen({ type: 'add-funds', categoryId: catId });
  };

  const handleOpenMoveFunds = (fromId?: string, toId?: string, amountPaise?: number) => {
    setCurrentScreen({ type: 'move-funds', fromCatId: fromId, toCatId: toId, amountPaise });
  };

  const handleQuickSpend = (catId: string) => {
    setCurrentScreen({ type: 'log-expense', preselectedCatId: catId });
  };

  const handleOpenGeneralSpend = () => {
    setCurrentScreen({ type: 'log-expense' });
  };

  const handleOpenReconcileCategory = (catId?: string) => {
    setCurrentScreen({ type: 'reconcile', categoryId: catId });
  };

  const handleOpenEnvelopeDetail = (catId: string) => {
    setCurrentScreen({ type: 'envelope-detail', categoryId: catId });
  };

  if ((authLoading || (user && (profileLoading || isCloudBootstrapPending))) && currentScreen?.type !== 'profile') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1F1B16] dark:bg-[#1A1714] dark:text-[#EDE8E1] flex flex-col antialiased selection:bg-[#E8C5BC] selection:text-[#87341D]">
        <Header
          activeTab={activeTab}
          setActiveTab={tab => {
            setActiveTab(tab);
            setCurrentScreen(null);
          }}
          onOpenSalaryModal={() => {}}
          onOpenReconcileModal={() => {}}
          onOpenMoveFundsModal={() => {}}
          onOpenVoiceModal={() => {}}
          onOpenInviteModal={() => {}}
          onOpenNotificationModal={() => {}}
          onOpenCloudSyncModal={() => {
            setActiveTab('sync');
            setCurrentScreen(null);
          }}
          onOpenProfileModal={() => setCurrentScreen({ type: 'profile', isOnboarding: false })}
        />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-3xl border border-[#E8E3DA] dark:border-[#2D2823] bg-[#FAF7F2] dark:bg-[#1A1714] shadow-xs p-6 text-center space-y-3">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-[#486B88]/15 text-[#486B88] flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1F1B16] dark:text-[#EDE8E1]">Loading your latest budget</h2>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1">
                Replaying your cloud events so balances do not show stale values.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (cloudSetupStatus === 'access_denied' && !authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1F1B16] dark:bg-[#1A1714] dark:text-[#EDE8E1] flex flex-col antialiased selection:bg-[#E8C5BC] selection:text-[#87341D]">
        <Header
          activeTab={activeTab}
          setActiveTab={tab => {
            setActiveTab(tab);
            setCurrentScreen(null);
          }}
          onOpenSalaryModal={() => {}}
          onOpenReconcileModal={() => {}}
          onOpenMoveFundsModal={() => {}}
          onOpenVoiceModal={() => {}}
          onOpenInviteModal={() => {}}
          onOpenNotificationModal={() => {}}
          onOpenCloudSyncModal={() => {
            setActiveTab('sync');
            setCurrentScreen(null);
          }}
          onOpenProfileModal={() => setCurrentScreen({ type: 'profile', isOnboarding: false })}
        />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex items-center justify-center">
          {currentScreen?.type === 'profile' ? (
            <ProfileScreen
              onBack={() => setCurrentScreen(null)}
              isOnboarding={false}
            />
          ) : (
            <AccessDeniedGate onCheckAgain={syncNow} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1B16] dark:bg-[#1A1714] dark:text-[#EDE8E1] flex flex-col antialiased selection:bg-[#E8C5BC] selection:text-[#87341D]">
      {/* Calm Ledger Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={tab => {
          setActiveTab(tab);
          setCurrentScreen(null);
        }}
        onOpenSalaryModal={() => setCurrentScreen({ type: 'salary-arrival' })}
        onOpenReconcileModal={() => handleOpenReconcileCategory()}
        onOpenMoveFundsModal={() => handleOpenMoveFunds()}
        onOpenVoiceModal={() => setCurrentScreen({ type: 'voice-input' })}
        onOpenInviteModal={() => {
          setActiveTab('invite');
          setCurrentScreen(null);
        }}
        onOpenNotificationModal={() => setCurrentScreen({ type: 'notifications' })}
        onOpenCloudSyncModal={() => {
          setActiveTab('sync');
          setCurrentScreen(null);
        }}
        onOpenProfileModal={() => setCurrentScreen({ type: 'profile', isOnboarding: false })}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-5 py-4 sm:py-6">
        {/* Dedicated Screens (replacing modals with proper screens) */}
        {currentScreen ? (
          <div className="animate-in fade-in duration-150">
            {currentScreen.type === 'log-expense' && (
              <LogExpenseScreen
                onBack={() => setCurrentScreen(null)}
                preselectedCategoryId={currentScreen.preselectedCatId}
                initialValues={currentScreen.initialValues}
              />
            )}

            {currentScreen.type === 'envelope-detail' && (
              <EnvelopeDetailScreen
                categoryId={currentScreen.categoryId}
                onBack={() => setCurrentScreen(null)}
                onQuickSpend={catId => handleQuickSpend(catId)}
                onEditTransaction={tx => setCurrentScreen({ type: 'edit-transaction', transaction: tx })}
                onReconcileCategory={catId => handleOpenReconcileCategory(catId)}
                onMoveFunds={catId => {
                  const isUnallocated = categories.find(c => c.id === catId)?.is_unallocated;
                  if (isUnallocated) {
                    handleOpenMoveFunds(catId, undefined);
                  } else {
                    handleOpenMoveFunds(undefined, catId);
                  }
                }}
                onAddFunds={catId => {
                  const isUnallocated = categories.find(c => c.id === catId)?.is_unallocated;
                  if (isUnallocated) {
                    // Adding money from Unallocated Surplus to an envelope:
                    handleOpenMoveFunds(catId, undefined);
                  } else {
                    handleOpenAddFunds(catId);
                  }
                }}
              />
            )}

            {currentScreen.type === 'salary-arrival' && (
              <SalaryArrivalScreen
                onBack={() => setCurrentScreen(null)}
                onSuccessOpenChecklist={() => {
                  setActiveTab('envelopes');
                  setCurrentScreen(null);
                }}
                initialAmountPaise={currentScreen.initialAmountPaise}
              />
            )}

            {currentScreen.type === 'reconcile' && (
              <ReconcileScreen
                onBack={() => setCurrentScreen(null)}
                preselectedCategoryId={currentScreen.categoryId}
              />
            )}

            {currentScreen.type === 'add-funds' && (
              <AddFundsScreen
                onBack={() => setCurrentScreen(null)}
                initialCategoryId={currentScreen.categoryId}
                initialAmountRupees={currentScreen.initialAmount}
              />
            )}

            {currentScreen.type === 'move-funds' && (
              <MoveFundsScreen
                onBack={() => setCurrentScreen(null)}
                initialFromCategoryId={currentScreen.fromCatId}
                initialToCategoryId={currentScreen.toCatId}
                initialAmountPaise={currentScreen.amountPaise}
              />
            )}

            {currentScreen.type === 'edit-transaction' && (
              <EditTransactionScreen
                transaction={currentScreen.transaction}
                onBack={() => setCurrentScreen(null)}
              />
            )}

            {currentScreen.type === 'voice-input' && (
              <VoiceInputScreen
                onBack={() => setCurrentScreen(null)}
                onOpenSalaryFlow={amountPaise => setCurrentScreen({ type: 'salary-arrival', initialAmountPaise: amountPaise })}
                onOpenReconcileFlow={catId => handleOpenReconcileCategory(catId)}
                onOpenMoveFundsFlow={(fromId, toId, amt) => handleOpenMoveFunds(fromId, toId, amt)}
              />
            )}

            {currentScreen.type === 'profile' && (
              <ProfileScreen
                onBack={handleCloseProfileScreen}
                isOnboarding={currentScreen.isOnboarding}
              />
            )}

            {currentScreen.type === 'notifications' && (
              <NotificationSettingsScreen
                onBack={() => setCurrentScreen(null)}
              />
            )}
          </div>
        ) : (
          <>
            {activeTab === 'envelopes' && (
              <div className="flex flex-col gap-6 sm:gap-5 animate-in fade-in pb-28 sm:pb-20">
                {/* Top Aggregate Summary Cards (§4.6: 2 clean cards) */}
                <div id="top-summary-cards" className="grid grid-cols-5 sm:grid-cols-2 gap-2 sm:gap-3">
                  {/* Card 1: Total In Envelopes */}
                  <div className="col-span-4 sm:col-span-1 p-3 sm:p-4 rounded-2xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between min-w-0">
                    <div className="min-w-0">
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1 sm:gap-1.5 min-w-0">
                        <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#4E785E] shrink-0" />
                        <span className="truncate">Total Available ({activeEnvelopeCount} envelopes)</span>
                      </span>
                      <div className="text-lg sm:text-2xl lg:text-3xl font-amount font-semibold mt-0.5 sm:mt-1 tracking-tight text-[#1F1B16] dark:text-[#EDE8E1] truncate">
                        {formatPaise(totalAvailablePaise)}
                      </div>
                      {/* Amount in words for total in small fonts */}
                      <p className="text-[10px] sm:text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-snug line-clamp-1 italic">
                        {paiseToWords(totalAvailablePaise)}
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Pending Card Debt (Spend -> Salary transfer) */}
                  <div
                    onClick={() => handleOpenReconcileCategory()}
                    id="pending-card-summary-card"
                    className={`col-span-1 p-2 sm:p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col items-center sm:items-stretch justify-center sm:justify-between gap-1 sm:gap-3 min-w-0 ${
                      totalPendingPaybackPaise > 0
                        ? 'bg-[#F9ECE8]/80 dark:bg-[#331D16]/80 border-[#E8C5BC] dark:border-[#5E261B] hover:border-[#B85D43]'
                        : 'bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border-[#E8E3DA] dark:border-[#2D2823]'
                    }`}
                  >
                    <div className="min-w-0 w-full text-center sm:text-left">
                      <span className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center justify-center sm:justify-between">
                        <span className="flex items-center justify-center gap-0 sm:gap-1.5 text-[#87341D] dark:text-[#F3B3A2] min-w-0">
                          <RefreshCw className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 shrink-0" />
                          <span className="sr-only sm:not-sr-only sm:truncate">Pending Payback</span>
                        </span>
                        {totalPendingPaybackPaise > 0 && (
                          <span className="text-[9px] sm:text-[10px] text-[#87341D] font-bold hidden sm:flex items-center gap-0.5">
                            Transfer Owed <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        )}
                      </span>
                      <div className="text-[11px] sm:text-2xl lg:text-3xl font-amount font-semibold mt-0.5 sm:mt-1 tracking-tight text-[#87341D] dark:text-[#F3B3A2] truncate">
                        {formatPaise(totalPendingPaybackPaise)}
                      </div>
                      {totalPendingPaybackPaise > 0 && (
                        <p className="hidden sm:block text-[11px] text-[#87341D]/80 dark:text-[#F3B3A2]/80 mt-1 leading-snug line-clamp-1 italic">
                          {paiseToWords(totalPendingPaybackPaise)}
                        </p>
                      )}
                    </div>
                    <div className="hidden sm:flex text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-3 items-center justify-between gap-2 shrink-0 truncate">
                      <span className="truncate">
                        {totalPendingPaybackPaise > 0
                          ? 'Move to Salary'
                          : 'Settled'}
                      </span>
                      {totalPendingPaybackPaise === 0 && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#4E785E]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Post-Salary Bank Transfer Checklist (§4.1) */}
                <div id="transfer-checklist-container">
                  <TransferChecklistCard />
                </div>

                {/* Envelope Grid (§4.6: Available Now + Month Slice) */}
                <div id="envelopes-section">
                  <div className="flex flex-col gap-3 mb-4 px-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div>
                          <h3 className="text-base sm:text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1] leading-tight">
                            Envelopes
                          </h3>
                          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                            Available now
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab('categories');
                            setCurrentScreen(null);
                          }}
                          id="manage-envelopes-gear-btn"
                          title="Manage Envelopes"
                          className="h-9 w-9 sm:h-7 sm:w-7 rounded-lg text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer flex items-center justify-center"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Date Changer lives on the right side of the envelope heading row */}
                      <div className="flex items-center overflow-hidden bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 rounded-xl border border-[#DCD5C9] dark:border-[#3D362F] shrink-0 shadow-2xs">
                        <button
                          onClick={handlePrevMonth}
                          id="prev-month-btn"
                          className="h-9 min-h-9 w-10 min-w-10 sm:h-7 sm:min-h-7 sm:w-8 sm:min-w-8 p-0 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] transition-colors cursor-pointer grid place-items-center"
                          title="Previous Month"
                        >
                          <ChevronLeft className="block w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                        </button>
                        <span className="text-xs sm:text-xs font-semibold px-1 min-w-[78px] sm:min-w-[84px] text-center text-[#1F1B16] dark:text-[#EDE8E1] select-none">
                          {formattedMonth}
                        </span>
                        <button
                          onClick={handleNextMonth}
                          id="next-month-btn"
                          className="h-9 min-h-9 w-10 min-w-10 sm:h-7 sm:min-h-7 sm:w-8 sm:min-w-8 p-0 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-[#E5DFD3] dark:hover:bg-[#342D26] transition-colors cursor-pointer grid place-items-center"
                          title="Next Month"
                        >
                          <ChevronRight className="block w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenAddFunds()}
                      id="envelopes-add-money-btn"
                      className="w-full sm:w-auto sm:self-end min-h-11 sm:min-h-0 px-4 sm:px-2.5 py-2.5 sm:py-1 rounded-xl sm:rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-sm sm:text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <PlusCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#2C523B]" />
                      <span>Add Money</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-2.5">
                    {categoryBalances.map(item => (
                      <CategoryCard
                        key={item.category.id}
                        balanceInfo={item}
                        onOpenDetail={catId => handleOpenEnvelopeDetail(catId)}
                        onQuickAddSpend={catId => {
                          const isUnallocated = categories.find(c => c.id === catId)?.is_unallocated;
                          if (isUnallocated) {
                            handleOpenMoveFunds(catId, undefined);
                          } else {
                            handleQuickSpend(catId);
                          }
                        }}
                        onOpenMoveFunds={catId => {
                          const isUnallocated = categories.find(c => c.id === catId)?.is_unallocated;
                          if (isUnallocated) {
                            handleOpenMoveFunds(catId, undefined);
                          } else {
                            handleOpenMoveFunds(undefined, catId);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Transaction Ledger & Search (§4.6) */}
            {activeTab === 'ledger' && (
              <TransactionLedger
                onEditTransaction={tx => setCurrentScreen({ type: 'edit-transaction', transaction: tx })}
                onOpenNewTransaction={handleOpenGeneralSpend}
                onOpenMoveFunds={() => handleOpenMoveFunds()}
                onOpenAddFunds={catId => handleOpenAddFunds(catId)}
                onOpenSalaryModal={() => setCurrentScreen({ type: 'salary-arrival' })}
                onOpenReconcileModal={catId => handleOpenReconcileCategory(catId)}
              />
            )}

            {/* Tab 3: Category Management (§4.7) */}
            {activeTab === 'categories' && <CategoryManagement />}

            {/* Tab 4: Settings & Sharing (§4.8 & §4.5) */}
            {activeTab === 'settings' && (
              <SettingsTab
                onOpenInviteModal={() => {
                  setActiveTab('invite');
                  setCurrentScreen(null);
                }}
                onOpenNotificationModal={() => setCurrentScreen({ type: 'notifications' })}
                onOpenVoiceModal={() => setCurrentScreen({ type: 'voice-input' })}
                onOpenCloudSyncModal={() => {
                  setActiveTab('sync');
                  setCurrentScreen(null);
                }}
                onOpenProfileModal={() => setCurrentScreen({ type: 'profile', isOnboarding: false })}
                onInstallPwa={triggerInstall}
                isPwaInstalled={isInstalled}
                onOpenTour={handleOpenTourSafely}
              />
            )}

            {/* Tab 5: Cloud & Cross-Device Sync Screen */}
            {activeTab === 'sync' && (
              <CloudSyncScreen
                onBack={() => {
                  setActiveTab('envelopes');
                  setCurrentScreen(null);
                }}
              />
            )}

            {/* Tab 6: Members & Household Requests Screen */}
            {activeTab === 'invite' && (
              <HouseholdInviteScreen
                onBack={() => {
                  setActiveTab('envelopes');
                  setCurrentScreen(null);
                }}
                onNavigateToSync={() => {
                  setActiveTab('sync');
                  setCurrentScreen(null);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Action Menu with Quick Money Actions (retained per user: "except hamburger menu") */}
      <FloatingNavMenu
        onOpenLogSpend={handleOpenGeneralSpend}
        onOpenVoiceModal={() => setCurrentScreen({ type: 'voice-input' })}
        onOpenReconcileModal={handleOpenReconcileCategory}
        onOpenMoveFundsModal={handleOpenMoveFunds}
        onOpenSalaryModal={() => setCurrentScreen({ type: 'salary-arrival' })}
        onOpenAddFundsModal={() => handleOpenAddFunds()}
        onOpenProfileModal={() => setCurrentScreen({ type: 'profile', isOnboarding: false })}
        onOpenTour={handleOpenTourSafely}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      <ResetDataWarningModal
        isOpen={hasLocalEventsToImport}
        onClose={dismissLocalEventImport}
        onConfirm={async () => {
          await importLocalEventsToCloud();
        }}
        title="Import this device’s budget?"
        description="You have budget activity saved on this device. Import it into your signed-in household so it appears across your devices."
        confirmText="Import to Cloud"
        isZeroReset={false}
        bulletPoints={[
          'Your local transactions, top-ups, transfers, and allocations will be added to this household',
          'The imported activity will sync to your signed-in Google household',
          'Choosing Cancel keeps this cloud household empty for now',
        ]}
      />

      {/* Progressive Web App Install Modal */}
      <InstallAppModal
        isOpen={!isInstalled && (isInstallModalOpen || showInstallGuide)}
        onClose={() => {
          setIsInstallModalOpen(false);
          closeInstallGuide();
        }}
        onNativeInstall={triggerInstall}
        hasNativePrompt={hasNativePrompt}
      />

      {/* Interactive Onboarding Tour & Nomenclature Walkthrough */}
      <AppTourGuide
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isFirstTime={user ? !(userIntroCompleted || isFirstTimeIntroCompleted) : !isFirstTimeIntroCompleted}
        onCompleteFirstTime={async () => {
          localStorage.setItem('env_budget_first_time_intro_done', 'true');
          await markUserIntroCompleted();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ApiLoadingProvider>
      <AuthProvider>
        <BudgetProvider>
          <BudgetAppContent />
        </BudgetProvider>
      </AuthProvider>
    </ApiLoadingProvider>
  );
}
