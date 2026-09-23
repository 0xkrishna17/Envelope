import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BudgetProvider, useBudget } from './context/BudgetContext';
import { Header } from './components/Header';
import { CategoryCard } from './components/CategoryCard';
import { TransferChecklistCard } from './components/TransferChecklistCard';
import { LogTransactionModal } from './components/LogTransactionModal';
import { SalaryArrivalModal } from './components/SalaryArrivalModal';
import { ReconciliationModal } from './components/ReconciliationModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { CategoryDetailModal } from './components/CategoryDetailModal';
import { VoiceInputModal } from './components/VoiceInputModal';
import { HouseholdInviteModal } from './components/HouseholdInviteModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { TransactionLedger } from './components/TransactionLedger';
import { CategoryManagement } from './components/CategoryManagementModal';
import { SettingsTab } from './components/SettingsTab';
import { MoveFundsModal } from './components/MoveFundsModal';
import { AddCategoryFundsModal } from './components/AddCategoryFundsModal';
import { FloatingNavMenu } from './components/FloatingNavMenu';
import { ProfileModal } from './components/ProfileModal';
import { AppTourGuide } from './components/AppTourGuide';
import { AccessDeniedGate } from './components/AccessDeniedGate';
import { ApiLoadingProvider } from './context/ApiLoadingContext';
import { formatPaise } from './utils/currency';
import { Transaction } from './types';
import { Plus, PlusCircle, Wallet, RefreshCw, Layers, ShieldCheck, ArrowRight, ArrowLeftRight, Settings, CheckCircle2, X, User } from 'lucide-react';

// App version as instructed by user: "lets add version no of app and with each iteration lets keep increasing version no at bottom right in small text."
export const APP_VERSION = 'v1.4.15';

function BudgetAppContent() {
  const {
    categoryBalances,
    totalAvailablePaise,
    totalPendingPaybackPaise,
    categories,
    selectedMonth,
    resetLedgerToZero,
    isFirstTimeIntroCompleted,
    isAccessAllowed,
    syncNow,
  } = useBudget();

  const { setHouseholdId } = useAuth();
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
  const [activeTab, setActiveTab] = useState<'envelopes' | 'ledger' | 'categories' | 'settings'>('envelopes');

  // Modal states
  const [isLogTxOpen, setIsLogTxOpen] = useState<boolean>(false);
  const [preselectedCatId, setPreselectedCatId] = useState<string | undefined>(undefined);
  const [txInitialValues, setTxInitialValues] = useState<any>(undefined);

  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState<boolean>(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState<boolean>(false);
  const [reconcileCatId, setReconcileCatId] = useState<string | undefined>(undefined);

  const [isMoveFundsOpen, setIsMoveFundsOpen] = useState<boolean>(false);
  const [moveFundsFromCatId, setMoveFundsFromCatId] = useState<string | undefined>(undefined);
  const [moveFundsToCatId, setMoveFundsToCatId] = useState<string | undefined>(undefined);
  const [moveFundsAmountPaise, setMoveFundsAmountPaise] = useState<number | undefined>(undefined);

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isOnboardingProfile, setIsOnboardingProfile] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  // For new users: ask their name & profile setup on first visit, then launch the interactive tour
  const handleOpenTourSafely = () => {
    // Dismiss all active popovers/modals so nothing sits on top of the tour or highlighted blocks
    setIsProfileModalOpen(false);
    setIsSalaryModalOpen(false);
    setIsLogTxOpen(false);
    setIsReconcileModalOpen(false);
    setIsMoveFundsOpen(false);
    setIsAddFundsOpen(false);
    setIsVoiceModalOpen(false);
    setIsInviteModalOpen(false);
    setIsNotificationModalOpen(false);
    setIsCloudSyncOpen(false);
    setDetailCatId(null);
    setEditingTx(null);
    setIsTourOpen(true);
  };

  useEffect(() => {
    const hasCompletedProfile = localStorage.getItem('env_budget_profile_completed');

    if (!hasCompletedProfile) {
      const timer = setTimeout(() => {
        setIsOnboardingProfile(true);
        setIsProfileModalOpen(true);
      }, 400);
      return () => clearTimeout(timer);
    } else if (!isFirstTimeIntroCompleted) {
      const timer = setTimeout(() => {
        handleOpenTourSafely();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFirstTimeIntroCompleted]);

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
    if (isOnboardingProfile) {
      setIsOnboardingProfile(false);
      // Once onboarding profile is dismissed/completed, launch the tour if not yet completed
      if (!isFirstTimeIntroCompleted) {
        setTimeout(() => {
          handleOpenTourSafely();
        }, 250);
      }
    }
  };

  const [detailCatId, setDetailCatId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [isAddFundsOpen, setIsAddFundsOpen] = useState<boolean>(false);
  const [addFundsCatId, setAddFundsCatId] = useState<string | undefined>(undefined);

  const unallocatedBalance = categoryBalances.find(b => b.category.is_unallocated)?.availableNow || 0;

  // Handlers
  const handleOpenAddFunds = (catId?: string) => {
    setAddFundsCatId(catId);
    setIsAddFundsOpen(true);
  };

  const handleOpenMoveFunds = (fromId?: string, toId?: string, amountPaise?: number) => {
    setMoveFundsFromCatId(fromId);
    setMoveFundsToCatId(toId);
    setMoveFundsAmountPaise(amountPaise);
    setIsMoveFundsOpen(true);
  };

  const handleQuickSpend = (catId: string) => {
    setPreselectedCatId(catId);
    setTxInitialValues(undefined);
    setIsLogTxOpen(true);
  };

  const handleOpenGeneralSpend = () => {
    setPreselectedCatId(undefined);
    setTxInitialValues(undefined);
    setIsLogTxOpen(true);
  };

  const handleOpenReconcileCategory = (catId?: string) => {
    setReconcileCatId(catId);
    setIsReconcileModalOpen(true);
  };

  const handleCommitVoiceTransaction = (params: {
    amountPaise: number;
    categoryId: string;
    paymentMethod: any;
    note?: string;
  }) => {
    setPreselectedCatId(params.categoryId);
    setTxInitialValues({
      amountPaise: params.amountPaise,
      categoryId: params.categoryId,
      paymentMethod: params.paymentMethod,
      note: params.note,
    });
    setIsLogTxOpen(true);
  };

  if (!isAccessAllowed) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1F1B16] dark:bg-[#1A1714] dark:text-[#EDE8E1] flex flex-col antialiased selection:bg-[#E8C5BC] selection:text-[#87341D]">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenSalaryModal={() => {}}
          onOpenReconcileModal={() => {}}
          onOpenMoveFundsModal={() => {}}
          onOpenVoiceModal={() => {}}
          onOpenInviteModal={() => {}}
          onOpenNotificationModal={() => {}}
          onOpenCloudSyncModal={() => setIsCloudSyncOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
        />
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex items-center justify-center">
          <AccessDeniedGate onCheckAgain={syncNow} />
        </main>
        {isCloudSyncOpen && (
          <CloudSyncModal
            isOpen={isCloudSyncOpen}
            onClose={() => setIsCloudSyncOpen(false)}
          />
        )}
        {isProfileModalOpen && (
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            isOnboarding={false}
          />
        )}
        <div className="fixed bottom-2 right-2 text-[10px] font-mono text-[#78716C]/60 dark:text-[#A8A29E]/60 pointer-events-none select-none z-50">
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
        setActiveTab={setActiveTab}
        onOpenSalaryModal={() => setIsSalaryModalOpen(true)}
        onOpenReconcileModal={() => handleOpenReconcileCategory()}
        onOpenMoveFundsModal={() => handleOpenMoveFunds()}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenCloudSyncModal={() => setIsCloudSyncOpen(true)}
        onOpenProfileModal={() => {
          setIsOnboardingProfile(false);
          setIsProfileModalOpen(true);
        }}
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
                    onClick={() => setActiveTab('categories')}
                    id="manage-envelopes-gear-btn"
                    title="Manage Envelopes"
                    className="p-1 rounded-md text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenAddFunds()}
                    id="envelopes-add-money-btn"
                    className="px-2.5 py-1 rounded-lg border border-[#DCD5C9] dark:border-[#3D362F] hover:bg-[#EFEAE1] dark:hover:bg-[#28221D] text-xs font-semibold text-[#1F1B16] dark:text-[#EDE8E1] flex items-center gap-1 transition-colors"
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
                    onOpenDetail={catId => setDetailCatId(catId)}
                    onQuickAddSpend={catId => handleQuickSpend(catId)}
                    onOpenMoveFunds={catId => handleOpenMoveFunds(undefined, catId)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Transaction Ledger & Search (§4.6) */}
        {activeTab === 'ledger' && (
          <TransactionLedger
            onEditTransaction={tx => setEditingTx(tx)}
            onOpenNewTransaction={handleOpenGeneralSpend}
            onOpenMoveFunds={() => handleOpenMoveFunds()}
            onOpenAddFunds={catId => handleOpenAddFunds(catId)}
            onOpenSalaryModal={() => setIsSalaryModalOpen(true)}
            onOpenReconcileModal={catId => handleOpenReconcileCategory(catId)}
          />
        )}

        {/* Tab 3: Category Management (§4.7) */}
        {activeTab === 'categories' && <CategoryManagement />}

        {/* Tab 4: Settings & Sharing (§4.8 & §4.5) */}
        {activeTab === 'settings' && (
          <SettingsTab
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            onOpenCloudSyncModal={() => setIsCloudSyncOpen(true)}
            onOpenProfileModal={() => {
              setIsOnboardingProfile(false);
              setIsProfileModalOpen(true);
            }}
            onOpenTour={handleOpenTourSafely}
          />
        )}
      </main>

      {/* Floating Action Menu with Actions & Navigation Views */}
      <FloatingNavMenu
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogSpend={handleOpenGeneralSpend}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenReconcileModal={handleOpenReconcileCategory}
        onOpenMoveFundsModal={handleOpenMoveFunds}
        onOpenSalaryModal={() => setIsSalaryModalOpen(true)}
        onOpenAddFundsModal={() => setIsAddFundsOpen(true)}
        onOpenTour={handleOpenTourSafely}
        appVersion={APP_VERSION}
      />

      {/* Modals and Sheets */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
      />

      <LogTransactionModal
        isOpen={isLogTxOpen}
        onClose={() => setIsLogTxOpen(false)}
        preselectedCategoryId={preselectedCatId}
        initialValues={txInitialValues}
      />

      <SalaryArrivalModal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
      />

      <ReconciliationModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        preselectedCategoryId={reconcileCatId}
      />

      <CategoryDetailModal
        categoryId={detailCatId}
        isOpen={Boolean(detailCatId)}
        onClose={() => setDetailCatId(null)}
        onQuickSpend={catId => handleQuickSpend(catId)}
        onEditTransaction={tx => setEditingTx(tx)}
        onReconcileCategory={catId => handleOpenReconcileCategory(catId)}
        onMoveFunds={catId => handleOpenMoveFunds(undefined, catId)}
        onAddFunds={catId => handleOpenAddFunds(catId)}
      />

      <AddCategoryFundsModal
        isOpen={isAddFundsOpen}
        onClose={() => setIsAddFundsOpen(false)}
        initialCategoryId={addFundsCatId}
      />

      <EditTransactionModal
        transaction={editingTx}
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
      />

      <VoiceInputModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onCommitAddTransaction={handleCommitVoiceTransaction}
        onOpenSalaryFlow={() => setIsSalaryModalOpen(true)}
        onOpenReconcileFlow={() => handleOpenReconcileCategory()}
        onOpenMoveFundsFlow={(fromId, toId, amt) => handleOpenMoveFunds(fromId, toId, amt)}
      />

      <MoveFundsModal
        isOpen={isMoveFundsOpen}
        onClose={() => setIsMoveFundsOpen(false)}
        initialFromCategoryId={moveFundsFromCatId}
        initialToCategoryId={moveFundsToCatId}
        initialAmountPaise={moveFundsAmountPaise}
      />

      <HouseholdInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        isOnboarding={isOnboardingProfile}
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
      <div className="fixed bottom-2 right-2 text-[10px] font-mono text-[#78716C]/60 dark:text-[#A8A29E]/60 pointer-events-none select-none z-50">
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
