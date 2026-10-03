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
import { ApiLoadingProvider } from './context/ApiLoadingContext';
import { formatPaise } from './utils/currency';
import { Transaction, ActiveTab } from './types';
import { Plus, PlusCircle, Wallet, RefreshCw, Layers, ShieldCheck, ArrowRight, ArrowLeftRight, Settings, CheckCircle2, X, User, ChevronLeft, ChevronRight } from 'lucide-react';

// App version as instructed by user: "lets add version no of app and with each iteration lets keep increasing version no at bottom right in small text."
export const APP_VERSION = 'v1.4.33';

function BudgetAppContent() {
  const {
    categoryBalances,
    totalAvailablePaise,
    totalPendingPaybackPaise,
    categories,
    selectedMonth,
    setSelectedMonth,
    resetLedgerToZero,
    isFirstTimeIntroCompleted,
    isAccessAllowed,
    syncNow,
  } = useBudget();

  const { user, loading: authLoading, setHouseholdId } = useAuth();
  const [partnerConnectedBanner, setPartnerConnectedBanner] = useState<string | null>(null);

  // Auto-connect when partner opens a shared public link (?household=... or ?code=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedHh = params.get('household');
      if (sharedHh) {
        setHouseholdId(sharedHh);
        setPartnerConnectedBanner(`Connected to household "${sharedHh}"! Both of your devices are now synchronized.`);
      }
    } catch (e) {
      console.error('Error reading url params:', e);
    }
  }, []);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('envelopes');

  // Unified Screen state (transforms all modals into screens)
  type ActiveScreen =
    | { type: 'log-expense'; preselectedCatId?: string; initialValues?: any }
    | { type: 'envelope-detail'; categoryId: string }
    | { type: 'salary-arrival' }
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

  useEffect(() => {
    const hasCompletedProfile = localStorage.getItem('env_budget_profile_completed');

    if (!hasCompletedProfile) {
      const timer = setTimeout(() => {
        setCurrentScreen({ type: 'profile', isOnboarding: true });
      }, 400);
      return () => clearTimeout(timer);
    } else if (!isFirstTimeIntroCompleted) {
      const timer = setTimeout(() => {
        handleOpenTourSafely();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFirstTimeIntroCompleted]);

  const handleCloseProfileScreen = () => {
    const wasOnboarding = currentScreen?.type === 'profile' && currentScreen.isOnboarding;
    setCurrentScreen(null);
    if (wasOnboarding) {
      if (!isFirstTimeIntroCompleted) {
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

  const handleCommitVoiceTransaction = (params: {
    amountPaise: number;
    categoryId: string;
    paymentMethod: any;
    note?: string;
  }) => {
    setCurrentScreen({
      type: 'log-expense',
      preselectedCatId: params.categoryId,
      initialValues: {
        amountPaise: params.amountPaise,
        categoryId: params.categoryId,
        paymentMethod: params.paymentMethod,
        note: params.note,
      },
    });
  };

  if (!isAccessAllowed && !authLoading) {
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
        <div className="fixed bottom-1.5 right-2 text-[9px] font-mono text-[#78716C]/40 dark:text-[#A8A29E]/40 pointer-events-none select-none z-30">
          {APP_VERSION}
        </div>
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-2 sm:px-4 py-3 sm:py-5">
        {partnerConnectedBanner && (
          <div className="mb-4 p-3 rounded-xl bg-[#4E785E]/10 border border-[#4E785E]/30 text-[#2C523B] dark:text-[#A1D1B1] text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#4E785E] shrink-0" />
              <span>{partnerConnectedBanner}</span>
            </div>
            <button
              onClick={() => setPartnerConnectedBanner(null)}
              className="p-1 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
                onCommitAddTransaction={handleCommitVoiceTransaction}
                onOpenSalaryFlow={() => setCurrentScreen({ type: 'salary-arrival' })}
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
              <div className="flex flex-col gap-5 animate-in fade-in pb-20">
                {/* Top Aggregate Summary Cards (§4.6: Compact on mobile) */}
                <div id="top-summary-cards" className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* Card 1: Total In Envelopes (Full width on mobile, 1 col on sm) */}
                  <div className="col-span-2 sm:col-span-1 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1 sm:gap-1.5">
                        <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#4E785E]" />
                        Total Available
                      </span>
                      <div className="text-xl sm:text-2xl lg:text-3xl font-amount font-semibold mt-0.5 sm:mt-1 tracking-tight text-[#1F1B16] dark:text-[#EDE8E1]">
                        {formatPaise(totalAvailablePaise)}
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1 sm:mt-2 truncate">
                      Across {categories.filter(c => !c.deleted_at && !c.is_archived).length} envelopes
                    </div>
                  </div>

                  {/* Card 2: Pending Card Debt (Spend -> Salary transfer) */}
                  <div
                    onClick={() => handleOpenReconcileCategory()}
                    id="pending-card-summary-card"
                    className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
                      totalPendingPaybackPaise > 0
                        ? 'bg-[#F9ECE8]/80 dark:bg-[#331D16]/80 border-[#E8C5BC] dark:border-[#5E261B] hover:border-[#B85D43]'
                        : 'bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border-[#E8E3DA] dark:border-[#2D2823]'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center justify-between">
                        <span className="flex items-center gap-1 sm:gap-1.5 text-[#87341D] dark:text-[#F3B3A2]">
                          <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          Pending Payback
                        </span>
                        {totalPendingPaybackPaise > 0 && (
                          <span className="text-[9px] sm:text-[10px] text-[#87341D] font-bold hidden sm:flex items-center gap-0.5">
                            Transfer Owed <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        )}
                      </span>
                      <div className="text-lg sm:text-2xl lg:text-3xl font-amount font-semibold mt-0.5 sm:mt-1 tracking-tight text-[#87341D] dark:text-[#F3B3A2]">
                        {formatPaise(totalPendingPaybackPaise)}
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1 sm:mt-2 flex items-center justify-between truncate">
                      <span className="truncate">
                        {totalPendingPaybackPaise > 0
                          ? 'Move to Salary'
                          : 'Settled'}
                      </span>
                      {totalPendingPaybackPaise === 0 && (
                        <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#4E785E]" />
                      )}
                    </div>
                  </div>

                  {/* Card 3: Unallocated Surplus Reserve */}
                  <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#EFEAE1]/50 dark:bg-[#28221D]/50 border border-[#E8E3DA] dark:border-[#2D2823] shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1 sm:gap-1.5">
                        <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#78716C]" />
                        Unallocated Surplus
                      </span>
                      <div className="text-lg sm:text-2xl lg:text-3xl font-amount font-semibold mt-0.5 sm:mt-1 tracking-tight text-[#1F1B16] dark:text-[#EDE8E1]">
                        {formatPaise(unallocatedBalance)}
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1 sm:mt-2 flex items-center justify-between truncate">
                      <span>Surplus</span>
                      <button
                        onClick={() => handleOpenMoveFunds(categories.find(c => c.is_unallocated)?.id)}
                        id="assign-surplus-btn"
                        className="text-[10px] sm:text-[11px] font-semibold text-[#486B88] hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                      >
                        <span>Move</span>
                        <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Post-Salary Bank Transfer Checklist (§4.1) */}
                <div id="transfer-checklist-container">
                  <TransferChecklistCard />
                </div>

                {/* Envelope Grid (§4.6: Available Now + Month Slice) */}
                <div id="envelopes-section">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                        Envelopes
                      </h3>
                      <button
                        onClick={() => {
                          setActiveTab('categories');
                          setCurrentScreen(null);
                        }}
                        id="manage-envelopes-gear-btn"
                        title="Manage Envelopes"
                        className="p-1 rounded-md text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Date Changer directly to the left of Add Money */}
                      <div className="flex items-center gap-0.5 bg-[#EFEAE1]/80 dark:bg-[#28221D]/80 px-1 py-0.5 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] shrink-0 shadow-2xs">
                        <button
                          onClick={handlePrevMonth}
                          id="prev-month-btn"
                          className="p-1 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded transition-colors cursor-pointer"
                          title="Previous Month"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] sm:text-xs font-semibold px-1 min-w-[76px] sm:min-w-[88px] text-center text-[#1F1B16] dark:text-[#EDE8E1] select-none">
                          {formattedMonth}
                        </span>
                        <button
                          onClick={handleNextMonth}
                          id="next-month-btn"
                          className="p-1 text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded transition-colors cursor-pointer"
                          title="Next Month"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenAddFunds()}
                        id="envelopes-add-money-btn"
                        className="px-2.5 py-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-[#2C523B]" />
                        <span>Add Money</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
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
                onNavigateToInvite={() => {
                  setActiveTab('invite');
                  setCurrentScreen(null);
                }}
              />
            )}

            {/* Tab 6: Household Sharing & Invite Screen */}
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
        onOpenTour={handleOpenTourSafely}
      />

      {/* Interactive Onboarding Tour & Nomenclature Walkthrough */}
      <AppTourGuide
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isFirstTime={!isFirstTimeIntroCompleted}
        onCompleteFirstTime={async () => {
          await resetLedgerToZero(true);
        }}
      />

      {/* Small version tag at bottom right */}
      <div className="fixed bottom-1.5 right-2 text-[9px] font-mono text-[#78716C]/40 dark:text-[#A8A29E]/40 pointer-events-none select-none z-30">
        {APP_VERSION}
      </div>
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
