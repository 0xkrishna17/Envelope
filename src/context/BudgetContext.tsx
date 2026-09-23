import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useRef, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useApiLoading } from './ApiLoadingContext';
import {
  Household,
  Membership,
  Category,
  SalaryEvent,
  Allocation,
  Transaction,
  Reconciliation,
  ReconciliationLine,
  Invite,
  CategoryBalanceInfo,
  PushSubscriptionSetting,
  EnvelopeTransfer
} from '../types';
import {
  INITIAL_HOUSEHOLD,
  INITIAL_MEMBERS,
  INITIAL_CATEGORIES,
  INITIAL_SALARY_EVENTS,
  INITIAL_ALLOCATIONS,
  INITIAL_TRANSACTIONS,
  INITIAL_RECONCILIATIONS,
  INITIAL_RECONCILIATION_LINES,
  INITIAL_ENVELOPE_TRANSFERS,
} from '../data/initialData';
import {
  calculateCategoryBalance,
  calculateMonthSummary,
  calculateCategoryPendingDebt,
  executeFifoReconciliation,
  recomputeTransactionStatuses,
} from '../utils/budgetLogic';

interface BudgetContextType {
  household: Household;
  members: Membership[];
  activeMember: Membership;
  categories: Category[];
  activeCategories: Category[];
  salaryEvents: SalaryEvent[];
  allocations: Allocation[];
  transactions: Transaction[];
  reconciliations: Reconciliation[];
  reconciliationLines: ReconciliationLine[];
  invites: Invite[];
  selectedMonth: string; // 'YYYY-MM'
  setSelectedMonth: (month: string) => void;
  categoryBalances: CategoryBalanceInfo[];
  totalAvailablePaise: number;
  totalPendingPaybackPaise: number;
  pendingTransfersList: (Allocation & { categoryName: string; categoryIcon: string; categoryColor: string })[];
  pushSettings: PushSubscriptionSetting;
  
  // Actions
  setActiveMemberId: (id: string) => void;
  addTransaction: (tx: {
    category_id: string;
    amount: number;
    date: string;
    payment_method: Transaction['payment_method'];
    note?: string;
  }) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  logCorrection: (originalTx: Transaction, differencePaise: number, note?: string) => Transaction;
  
  addSalaryAndAllocations: (
    earnerUserId: string,
    amountPaise: number,
    date: string,
    allocationsList: { categoryId: string; amountPaise: number }[]
  ) => { salaryEvent: SalaryEvent; allocations: Allocation[] };
  
  toggleAllocationTransferred: (allocationId: string) => void;
  markAllAllocationsTransferred: (salaryEventId?: string) => void;
  
  reconcileCategoryCardSpend: (
    categoryId: string,
    amountToPayPaise: number,
    date: string
  ) => { reconciliation: Reconciliation; lines: ReconciliationLine[] };
  deleteReconciliation: (reconciliationId: string) => void;

  envelopeTransfers: EnvelopeTransfer[];
  moveEnvelopeFunds: (params: {
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: number;
    date?: string;
    note?: string;
  }) => { success: boolean; error?: string; transfer?: EnvelopeTransfer };
  deleteEnvelopeTransfer: (transferId: string) => void;

  addCategoryFunds: (params: {
    categoryId: string;
    amountPaise: number;
    source?: string;
    note?: string;
    date?: string;
    depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
    transferred?: boolean;
    loggedByUserId?: string;
  }) => { success: boolean; error?: string; allocation?: Allocation };
  deleteCategoryFunds: (allocationId: string) => void;

  createCategory: (name: string, icon: string, color: string, target_amount?: number) => { success: boolean; error?: string };
  updateCategory: (id: string, updates: Partial<Category>) => { success: boolean; error?: string };
  archiveCategory: (id: string) => void;
  unarchiveCategory: (id: string) => void;

  updateMemberName: (userId: string, newName: string) => void;
  updateMemberProfile: (
    userId: string,
    updates: { name?: string; avatar_url?: string; avatar_color?: string }
  ) => void;
  deleteMember: (userId: string) => { success: boolean; error?: string };
  createInvite: () => Invite;
  revokeInvite: (inviteId: string) => void;
  updatePushSettings: (time: string, enabled: boolean) => void;
  resetToSampleData: () => Promise<void>;
  resetLedgerToZero: (isFirstTimeIntro?: boolean) => Promise<void>;
  isFirstTimeIntroCompleted: boolean;

  // Cloud & Cross-Device Synchronization
  householdId: string;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  lastCloudSync: string | null;
  syncNow: () => Promise<void>;

  // Google Account Allowlist & Access Control
  isAccessAllowed: boolean;
  accessBlockedReason: 'none' | 'auth_required' | 'not_in_allowlist';
  isOwner: boolean;
  addAllowedEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  removeAllowedEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  createNewHousehold: (name?: string) => Promise<string>;
  enterPreviewMode: () => void;
}

const STORAGE_KEYS = {
  HOUSEHOLD: 'env_budget_household_v3',
  MEMBERS: 'env_budget_members_v3',
  ACTIVE_MEMBER_ID: 'env_budget_active_member_v3',
  CATEGORIES: 'env_budget_categories_v3',
  SALARY_EVENTS: 'env_budget_salary_events_v3',
  ALLOCATIONS: 'env_budget_allocations_v3',
  TRANSACTIONS: 'env_budget_transactions_v3',
  RECONCILIATIONS: 'env_budget_reconciliations_v3',
  RECON_LINES: 'env_budget_recon_lines_v3',
  ENVELOPE_TRANSFERS: 'env_budget_envelope_transfers_v3',
  INVITES: 'env_budget_invites_v3',
  PUSH: 'env_budget_push_v3',
};

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

/**
 * Concurrency-safe entity merger:
 * 1. Takes remote items from Firestore snapshot.
 * 2. Merges with local uncommitted / in-flight items by unique ID.
 * 3. Keeps local items that are not yet on the server (prevents race-condition overwriting).
 * 4. For colliding IDs, adopts Last-Write-Wins based on ISO timestamps (updated_at / created_at).
 */
function mergeEntityArrays<T extends { id: string }>(
  remoteItems: T[],
  localItems: T[]
): T[] {
  if (!Array.isArray(remoteItems)) return localItems;
  if (!Array.isArray(localItems) || localItems.length === 0) return remoteItems;

  const map = new Map<string, T>();

  // 1. Seed with all remote items
  for (const r of remoteItems) {
    if (r && r.id) {
      map.set(r.id, r);
    }
  }

  // 2. Reconcile with local items
  for (const loc of localItems) {
    if (!loc || !loc.id) continue;
    const remote = map.get(loc.id);
    if (!remote) {
      // Local item not yet on server! Keep it to prevent concurrent overwrite
      map.set(loc.id, loc);
    } else {
      // Resolve conflict by latest timestamp (Last-Write-Wins per entity)
      const locObj = loc as Record<string, any>;
      const remObj = remote as Record<string, any>;
      const locTime = new Date(locObj.updated_at || locObj.created_at || 0).getTime();
      const remTime = new Date(remObj.updated_at || remObj.created_at || 0).getTime();
      if (locTime > remTime) {
        map.set(loc.id, loc);
      }
    }
  }

  return Array.from(map.values());
}

export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, householdId, syncStatus: cloudSyncStatus, setSyncStatus, setHouseholdId } = useAuth();
  const { startApiCall } = useApiLoading();
  const isRemoteSyncRef = useRef<boolean>(false);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  // Current month default: e.g. 2026-09
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);

  // Entities state with localStorage persistence
  const [household, setHousehold] = useState<Household>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD);
    return saved ? JSON.parse(saved) : INITIAL_HOUSEHOLD;
  });

  // Google Account Allowlist & Access Control verification
  const { isAccessAllowed, accessBlockedReason, isOwner } = useMemo(() => {
    // If household is default preview or demo household, it is ALWAYS allowed
    if (
      !householdId ||
      householdId === 'hh_family_ledger_main' ||
      householdId.startsWith('hh_demo') ||
      householdId.startsWith('hh_preview')
    ) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: true,
      };
    }

    if (permissionDenied) {
      if (!user) {
        return {
          isAccessAllowed: false,
          accessBlockedReason: 'auth_required' as const,
          isOwner: false,
        };
      }
      return {
        isAccessAllowed: false,
        accessBlockedReason: 'not_in_allowlist' as const,
        isOwner: false,
      };
    }

    const ownerEmail = (household.owner_email || '').trim().toLowerCase();
    const allowedEmails = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    const hasRestrictions = Boolean(ownerEmail || allowedEmails.length > 0);

    // If household has not established any owner or allowlist yet (e.g. fresh local workspace)
    if (!hasRestrictions) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: true,
      };
    }

    // Household has restrictions: Google Login is required
    if (!user) {
      return {
        isAccessAllowed: false,
        accessBlockedReason: 'auth_required' as const,
        isOwner: false,
      };
    }

    const currentEmail = (user.email || '').trim().toLowerCase();
    const isCurrentOwner = (ownerEmail && currentEmail === ownerEmail) || (household.created_by && user.uid === household.created_by);
    const isCurrentAllowed = allowedEmails.includes(currentEmail);

    if (isCurrentOwner || isCurrentAllowed) {
      return {
        isAccessAllowed: true,
        accessBlockedReason: 'none' as const,
        isOwner: Boolean(isCurrentOwner),
      };
    }

    return {
      isAccessAllowed: false,
      accessBlockedReason: 'not_in_allowlist' as const,
      isOwner: false,
    };
  }, [household, householdId, user, permissionDenied]);

  const [members, setMembers] = useState<Membership[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (saved) {
      try {
        let parsed: Membership[] = JSON.parse(saved);
        // Remove legacy Krishna and Ritu
        parsed = parsed
          .filter(m => m.name.toLowerCase() !== 'ritu' && m.user_id !== 'usr_ritu')
          .map(m => {
            if (m.name.toLowerCase() === 'krishna' || m.user_id === 'usr_krishna' || m.user_id === 'usr_priya') {
              const savedCustomName = localStorage.getItem('env_budget_user_name');
              return {
                ...m,
                user_id: 'usr_me',
                name: savedCustomName || '',
                role: 'owner',
              };
            }
            return m;
          });
        if (parsed.length === 0) {
          return INITIAL_MEMBERS;
        }
        return parsed;
      } catch {
        return INITIAL_MEMBERS;
      }
    }
    return INITIAL_MEMBERS;
  });

  const [activeMemberId, setActiveMemberId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_MEMBER_ID);
    if (saved === 'usr_krishna' || saved === 'usr_priya' || saved === 'usr_ritu') {
      return 'usr_me';
    }
    return saved || INITIAL_MEMBERS[0].user_id;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [salaryEvents, setSalaryEvents] = useState<SalaryEvent[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SALARY_EVENTS);
    if (saved) {
      try {
        const parsed: SalaryEvent[] = JSON.parse(saved);
        return parsed.map(s => {
          if (s.earner_user_id === 'usr_krishna' || s.earner_user_id === 'usr_ritu') {
            return { ...s, earner_user_id: 'usr_me' };
          }
          return s;
        });
      } catch {
        return INITIAL_SALARY_EVENTS;
      }
    }
    return INITIAL_SALARY_EVENTS;
  });

  const [allocations, setAllocations] = useState<Allocation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ALLOCATIONS);
    return saved ? JSON.parse(saved) : INITIAL_ALLOCATIONS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (saved) {
      try {
        const parsed: Transaction[] = JSON.parse(saved);
        return parsed.map(t => {
          if (
            t.logged_by_user_id === 'usr_krishna' ||
            t.logged_by_user_id === 'usr_priya' ||
            t.logged_by_user_id === 'usr_ritu'
          ) {
            return { ...t, logged_by_user_id: 'usr_me' };
          }
          return t;
        });
      } catch {
        return INITIAL_TRANSACTIONS;
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  const [reconciliations, setReconciliations] = useState<Reconciliation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECONCILIATIONS);
    if (saved) {
      try {
        const parsed: Reconciliation[] = JSON.parse(saved);
        return parsed.map(r => {
          if (
            r.logged_by_user_id === 'usr_krishna' ||
            r.logged_by_user_id === 'usr_priya' ||
            r.logged_by_user_id === 'usr_ritu'
          ) {
            return { ...r, logged_by_user_id: 'usr_me' };
          }
          return r;
        });
      } catch {
        return INITIAL_RECONCILIATIONS;
      }
    }
    return INITIAL_RECONCILIATIONS;
  });

  const [reconciliationLines, setReconciliationLines] = useState<ReconciliationLine[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECON_LINES);
    return saved ? JSON.parse(saved) : INITIAL_RECONCILIATION_LINES;
  });

  const [invites, setInvites] = useState<Invite[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INVITES);
    return saved ? JSON.parse(saved) : [];
  });

  const [envelopeTransfers, setEnvelopeTransfers] = useState<EnvelopeTransfer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ENVELOPE_TRANSFERS);
    if (saved) {
      try {
        const parsed: EnvelopeTransfer[] = JSON.parse(saved);
        return parsed.map(tr => {
          if (
            tr.logged_by_user_id === 'usr_krishna' ||
            tr.logged_by_user_id === 'usr_priya' ||
            tr.logged_by_user_id === 'usr_ritu'
          ) {
            return { ...tr, logged_by_user_id: 'usr_me' };
          }
          return tr;
        });
      } catch {
        return INITIAL_ENVELOPE_TRANSFERS;
      }
    }
    return INITIAL_ENVELOPE_TRANSFERS;
  });

  const [pushSettings, setPushSettings] = useState<PushSubscriptionSetting>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PUSH);
    return saved
      ? JSON.parse(saved)
      : {
          id: 'push_1',
          user_id: INITIAL_MEMBERS[0].user_id,
          reminder_time: '21:00',
          timezone: 'Asia/Kolkata',
          enabled: true,
          created_at: new Date().toISOString(),
        };
  });

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(household));
  }, [household]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, activeMemberId);
  }, [activeMemberId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SALARY_EVENTS, JSON.stringify(salaryEvents));
  }, [salaryEvents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ALLOCATIONS, JSON.stringify(allocations));
  }, [allocations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECONCILIATIONS, JSON.stringify(reconciliations));
  }, [reconciliations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECON_LINES, JSON.stringify(reconciliationLines));
  }, [reconciliationLines]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVITES, JSON.stringify(invites));
  }, [invites]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ENVELOPE_TRANSFERS, JSON.stringify(envelopeTransfers));
  }, [envelopeTransfers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PUSH, JSON.stringify(pushSettings));
  }, [pushSettings]);

  // Firestore Real-Time Cloud Synchronization (§1 & Cross-Device)
  useEffect(() => {
    if (!householdId) return;
    setPermissionDenied(false);

    try {
      const docRef = doc(db, 'households', householdId);
      const unsubscribe = onSnapshot(
        docRef,
        docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            isRemoteSyncRef.current = true;

            if (Array.isArray(data.categories) && data.categories.length > 0) {
              setCategories(prev => mergeEntityArrays(data.categories, prev));
            }
            if (Array.isArray(data.salaryEvents)) {
              setSalaryEvents(prev => mergeEntityArrays(data.salaryEvents, prev));
            }
            if (Array.isArray(data.allocations)) {
              setAllocations(prev => mergeEntityArrays(data.allocations, prev));
            }
            if (Array.isArray(data.transactions)) {
              setTransactions(prev => mergeEntityArrays(data.transactions, prev));
            }
            if (Array.isArray(data.reconciliations)) {
              setReconciliations(prev => mergeEntityArrays(data.reconciliations, prev));
            }
            if (Array.isArray(data.reconciliationLines)) {
              setReconciliationLines(prev => mergeEntityArrays(data.reconciliationLines, prev));
            }
            if (Array.isArray(data.envelopeTransfers)) {
              setEnvelopeTransfers(prev => mergeEntityArrays(data.envelopeTransfers, prev));
            }
            if (Array.isArray(data.members) && data.members.length > 0) {
              try {
                const deletedList: string[] = JSON.parse(
                  localStorage.getItem('env_budget_deleted_members') || '[]'
                );
                const deletedSet = new Set(deletedList);
                const activeServerMembers = data.members.filter(
                  (m: Membership) => m && m.user_id && !m.deleted_at && !deletedSet.has(m.user_id)
                );
                if (activeServerMembers.length > 0) {
                  setMembers(activeServerMembers);
                }
              } catch {
                setMembers(data.members.filter((m: Membership) => !m.deleted_at));
              }
            }
            if (data.household && data.household.id) {
              const isIntroDone = Boolean(
                data.household.first_time_intro_completed ?? data.first_time_intro_completed
              );
              setHousehold({
                ...data.household,
                first_time_intro_completed: isIntroDone,
              });
              if (isIntroDone) {
                localStorage.setItem('env_budget_first_time_intro_done', 'true');
                localStorage.setItem('env_budget_tour_completed', 'true');
              }
            }

            if (data.lastSyncedAt) {
              setLastCloudSync(data.lastSyncedAt);
            } else {
              setLastCloudSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
            }
            setSyncStatus('synced');

            setTimeout(() => {
              isRemoteSyncRef.current = false;
            }, 400);
          } else {
            // First time household initialized in Firestore
            setDoc(docRef, {
              household,
              members,
              categories,
              salaryEvents,
              allocations,
              transactions,
              reconciliations,
              reconciliationLines,
              envelopeTransfers,
              createdAt: serverTimestamp(),
              lastSyncedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            }).catch(e => {
              console.warn('Initial cloud doc setup note:', e);
            });
          }
        },
        error => {
          console.warn('Firestore onSnapshot notice:', error);
          setSyncStatus('offline');
          if (
            error.code === 'permission-denied' ||
            error.message?.toLowerCase().includes('permission') ||
            error.message?.toLowerCase().includes('insufficient')
          ) {
            setPermissionDenied(true);
          }
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.warn('Firestore subscription setup failed:', err);
      setSyncStatus('offline');
      if (
        err?.code === 'permission-denied' ||
        err?.message?.toLowerCase().includes('permission')
      ) {
        setPermissionDenied(true);
      }
    }
  }, [householdId, setSyncStatus]);

  // Push local updates to Firestore (debounced)
  const pushToCloud = useCallback(async () => {
    if (isRemoteSyncRef.current || !householdId || !isAccessAllowed) return;

    const stopApi = startApiCall();
    try {
      setSyncStatus('syncing');
      const docRef = doc(db, 'households', householdId);
      const timeString = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      await setDoc(
        docRef,
        {
          household,
          members,
          categories,
          salaryEvents,
          allocations,
          transactions,
          reconciliations,
          reconciliationLines,
          envelopeTransfers,
          lastSyncedAt: timeString,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: user?.displayName || user?.email || activeMemberId,
        },
        { merge: true }
      );
      setLastCloudSync(timeString);
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Cloud sync push notice:', err);
      setSyncStatus('offline');
    } finally {
      stopApi();
    }
  }, [
    household,
    members,
    categories,
    salaryEvents,
    allocations,
    transactions,
    reconciliations,
    reconciliationLines,
    envelopeTransfers,
    householdId,
    user,
    activeMemberId,
    isAccessAllowed,
    setSyncStatus,
    startApiCall,
  ]);

  // Debounced auto-save to cloud on state changes
  useEffect(() => {
    if (isRemoteSyncRef.current || !isAccessAllowed) return;
    const timer = setTimeout(() => {
      pushToCloud();
    }, 700);
    return () => clearTimeout(timer);
  }, [
    household,
    members,
    categories,
    salaryEvents,
    allocations,
    transactions,
    reconciliations,
    reconciliationLines,
    envelopeTransfers,
    isAccessAllowed,
    pushToCloud,
  ]);

  // If user signs into a household with no established owner, claim ownership
  useEffect(() => {
    if (!user || !user.email) return;
    const email = user.email.trim().toLowerCase();

    setHousehold(prev => {
      if (!prev.owner_email && (!prev.allowed_emails || prev.allowed_emails.length === 0)) {
        return {
          ...prev,
          owner_email: email,
          allowed_emails: [email],
          created_by: user.uid,
          updated_at: new Date().toISOString(),
        };
      }
      return prev;
    });
  }, [user]);

  // Auto-sync Google user profile into household members roster (only when access is allowed!)
  useEffect(() => {
    if (!user || !isAccessAllowed) return;
    const uid = user.uid;

    // Do not auto-recreate if this user was deliberately deleted
    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('env_budget_deleted_members') || '[]'
      );
      if (deletedList.includes(uid)) return;
    } catch {}

    const name = user.displayName || user.email?.split('@')[0] || 'Household Partner';
    const avatar_url = user.photoURL || undefined;

    setMembers(prev => {
      const existingIdx = prev.findIndex(m => m.user_id === uid || (user.email && m.email === user.email));
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.name !== name || existing.avatar_url !== avatar_url) {
          const updated = [...prev];
          updated[existingIdx] = { ...existing, name, avatar_url, user_id: uid, email: user.email || existing.email };
          return updated;
        }
        return prev;
      }

      // If only single default placeholder 'usr_me' exists, transform into Google authenticated user
      if (prev.length === 1 && prev[0].user_id === 'usr_me') {
        return [
          {
            id: `mem_${Date.now()}`,
            household_id: householdId,
            user_id: uid,
            name,
            role: 'owner',
            avatar_color: '#4E785E',
            avatar_url,
            email: user.email || undefined,
            joined_at: new Date().toISOString(),
          },
        ];
      }

      // Partner logging in: add as co-owner to shared household
      return [
        ...prev,
        {
          id: `mem_${Date.now()}`,
          household_id: householdId,
          user_id: uid,
          name,
          role: 'owner',
          avatar_color: prev.length % 2 === 0 ? '#4E785E' : '#B85D43',
          avatar_url,
          email: user.email || undefined,
          joined_at: new Date().toISOString(),
        },
      ];
    });

    setActiveMemberId(uid);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, uid);
  }, [user, householdId, isAccessAllowed]);

  const syncNow = useCallback(async () => {
    setPermissionDenied(false);
    const stopLoader = startApiCall('Syncing ledger with Firestore...');
    try {
      await pushToCloud();
    } finally {
      stopLoader();
    }
  }, [pushToCloud, startApiCall]);

  const activeMember = useMemo(() => {
    return members.find(m => m.user_id === activeMemberId) || members[0];
  }, [members, activeMemberId]);

  const activeCategories = useMemo(() => {
    return categories.filter(c => !c.deleted_at && !c.is_archived);
  }, [categories]);

  // Derived Category Balances & Summaries
  const categoryBalances = useMemo<CategoryBalanceInfo[]>(() => {
    // Show all non-deleted categories, even archived if they have money or pending debt (§3)
    const validCategories = categories.filter(c => !c.deleted_at);

    return validCategories.map(cat => {
      const availableNow = calculateCategoryBalance(cat.id, allocations, transactions);
      const { allocated, spent } = calculateMonthSummary(cat.id, allocations, transactions, selectedMonth);
      const { totalPendingDebt } = calculateCategoryPendingDebt(cat.id, transactions, reconciliationLines);

      return {
        category: cat,
        availableNow,
        thisMonthAllocated: allocated,
        thisMonthSpent: spent,
        pendingCardDebt: totalPendingDebt,
      };
    }).filter(item => {
      // If archived, only keep if balance is nonzero or has pending debt
      if (item.category.is_archived) {
        return item.availableNow !== 0 || item.pendingCardDebt > 0;
      }
      return true;
    });
  }, [categories, allocations, transactions, reconciliationLines, selectedMonth]);

  const totalAvailablePaise = useMemo(() => {
    return categoryBalances.reduce((sum, item) => sum + item.availableNow, 0);
  }, [categoryBalances]);

  const totalPendingPaybackPaise = useMemo(() => {
    return categoryBalances.reduce((sum, item) => sum + item.pendingCardDebt, 0);
  }, [categoryBalances]);

  // Pending bank transfers checklist: allocations that are not yet marked as transferred
  const pendingTransfersList = useMemo(() => {
    const pendingAllocs = allocations.filter(a => !a.transferred && !a.deleted_at && a.planned_amount > 0);
    return pendingAllocs.map(a => {
      const cat = categories.find(c => c.id === a.category_id);
      return {
        ...a,
        categoryName: cat?.name || 'Unknown Envelope',
        categoryIcon: cat?.icon || 'Wallet',
        categoryColor: cat?.color || '#78716C',
      };
    });
  }, [allocations, categories]);

  // Log a transaction (§4.2)
  const addTransaction = (data: {
    category_id: string;
    amount: number;
    date: string;
    payment_method: Transaction['payment_method'];
    note?: string;
  }): Transaction => {
    const nowIso = new Date().toISOString();
    const newTx: Transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      household_id: household.id,
      category_id: data.category_id,
      amount: data.amount,
      date: data.date,
      logged_by_user_id: activeMember.user_id,
      payment_method: data.payment_method,
      note: data.note?.trim() || undefined,
      reconciliation_status: data.payment_method === 'credit_card' ? 'pending' : 'n/a',
      created_at: nowIso,
      updated_at: nowIso,
    };

    setTransactions(prev => [newTx, ...prev]);
    return newTx;
  };

  // Edit an entry (§4.3)
  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev =>
      prev.map(tx => {
        if (tx.id !== id) return tx;
        return {
          ...tx,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  // Delete transaction (Soft delete per §4.3 & §5)
  const deleteTransaction = (id: string) => {
    const nowIso = new Date().toISOString();
    setTransactions(prev =>
      prev.map(tx => {
        if (tx.id !== id) return tx;
        return {
          ...tx,
          deleted_at: nowIso,
          updated_at: nowIso,
        };
      })
    );

    // Also remove associated reconciliation lines and recompute statuses
    const updatedLines = reconciliationLines.filter(l => l.transaction_id !== id);
    setReconciliationLines(updatedLines);

    // Recompute
    setTransactions(curr => {
      const statusMap = recomputeTransactionStatuses(curr, updatedLines);
      return curr.map(t => {
        const newStatus = statusMap.get(t.id);
        return newStatus ? { ...t, reconciliation_status: newStatus } : t;
      });
    });
  };

  // Log a correction (§4.3) for partially_reconciled or reconciled transactions
  const logCorrection = (originalTx: Transaction, differencePaise: number, note?: string): Transaction => {
    const nowIso = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    const correctionTx: Transaction = {
      id: `tx_corr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      household_id: household.id,
      category_id: originalTx.category_id,
      amount: differencePaise, // positive or negative
      date: today,
      logged_by_user_id: activeMember.user_id,
      payment_method: originalTx.payment_method,
      note: note || `Correction for tx #${originalTx.id.slice(-4)} (${originalTx.note || 'entry'})`,
      reconciliation_status: originalTx.payment_method === 'credit_card' ? 'pending' : 'n/a',
      created_at: nowIso,
      updated_at: nowIso,
    };

    setTransactions(prev => [correctionTx, ...prev]);
    return correctionTx;
  };

  // Salary Arrival & Allocation Flow (§4.1)
  const addSalaryAndAllocations = (
    earnerUserId: string,
    amountPaise: number,
    date: string,
    allocationsList: { categoryId: string; amountPaise: number }[]
  ) => {
    const nowIso = new Date().toISOString();
    const salaryId = `sal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSalaryEvent: SalaryEvent = {
      id: salaryId,
      household_id: household.id,
      earner_user_id: earnerUserId,
      amount: amountPaise,
      date,
      created_at: nowIso,
    };

    // Calculate unallocated leftover
    const totalAllocated = allocationsList.reduce((sum, item) => sum + item.amountPaise, 0);
    const unallocatedAmount = Math.max(0, amountPaise - totalAllocated);

    const unallocatedCat = categories.find(c => c.is_unallocated);
    const unallocatedCatId = unallocatedCat?.id || 'cat_unallocated';

    const newAllocations: Allocation[] = [];

    // Category allocations
    for (const alloc of allocationsList) {
      if (alloc.amountPaise > 0) {
        newAllocations.push({
          id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          salary_event_id: salaryId,
          category_id: alloc.categoryId,
          planned_amount: alloc.amountPaise,
          transferred: false, // Generates the post-salary transfer checklist (§4.1 step 6)
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // Unallocated leftover
    if (unallocatedAmount > 0) {
      newAllocations.push({
        id: `alloc_un_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        salary_event_id: salaryId,
        category_id: unallocatedCatId,
        planned_amount: unallocatedAmount,
        transferred: false,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    setSalaryEvents(prev => [newSalaryEvent, ...prev]);
    setAllocations(prev => [...newAllocations, ...prev]);

    return { salaryEvent: newSalaryEvent, allocations: newAllocations };
  };

  const toggleAllocationTransferred = (allocationId: string) => {
    const nowIso = new Date().toISOString();
    setAllocations(prev =>
      prev.map(a => {
        if (a.id !== allocationId) return a;
        const newTransferred = !a.transferred;
        return {
          ...a,
          transferred: newTransferred,
          transferred_at: newTransferred ? nowIso : null,
          updated_at: nowIso,
        };
      })
    );
  };

  const markAllAllocationsTransferred = (salaryEventId?: string) => {
    const nowIso = new Date().toISOString();
    setAllocations(prev =>
      prev.map(a => {
        if (salaryEventId && a.salary_event_id !== salaryEventId) return a;
        if (a.transferred) return a;
        return {
          ...a,
          transferred: true,
          transferred_at: nowIso,
          updated_at: nowIso,
        };
      })
    );
  };

  // Reconcile Credit Card Payback with FIFO matching (§4.4)
  const reconcileCategoryCardSpend = (
    categoryId: string,
    amountToPayPaise: number,
    date: string
  ): { reconciliation: Reconciliation; lines: ReconciliationLine[] } => {
    const nowIso = new Date().toISOString();
    const reconciliationId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Execute FIFO
    const { createdLines, transactionStatusUpdates } = executeFifoReconciliation(
      reconciliationId,
      categoryId,
      amountToPayPaise,
      transactions,
      reconciliationLines
    );

    const newReconciliation: Reconciliation = {
      id: reconciliationId,
      household_id: household.id,
      category_id: categoryId,
      total_amount: amountToPayPaise,
      date,
      logged_by_user_id: activeMember.user_id,
      created_at: nowIso,
    };

    // Update statuses
    setTransactions(prev =>
      prev.map(tx => {
        const update = transactionStatusUpdates.find(u => u.transactionId === tx.id);
        if (update) {
          return {
            ...tx,
            reconciliation_status: update.status,
            updated_at: nowIso,
          };
        }
        return tx;
      })
    );

    setReconciliationLines(prev => [...prev, ...createdLines]);
    setReconciliations(prev => [newReconciliation, ...prev]);

    return { reconciliation: newReconciliation, lines: createdLines };
  };

  // Delete reconciliation (§4.3)
  const deleteReconciliation = (reconciliationId: string) => {
    const nowIso = new Date().toISOString();
    // Soft delete reconciliation
    setReconciliations(prev =>
      prev.map(r => (r.id === reconciliationId ? { ...r, deleted_at: nowIso } : r))
    );

    // Remove its lines
    const remainingLines = reconciliationLines.filter(l => l.reconciliation_id !== reconciliationId);
    setReconciliationLines(remainingLines);

    // Recompute statuses of transactions back to pending or partially_reconciled automatically!
    setTransactions(prev => {
      const statusMap = recomputeTransactionStatuses(prev, remainingLines);
      return prev.map(t => {
        const newStatus = statusMap.get(t.id);
        return newStatus ? { ...t, reconciliation_status: newStatus, updated_at: nowIso } : t;
      });
    });
  };

  // Categories CRUD (§4.7 & §5: unique case-insensitive constraint)
  const createCategory = (name: string, icon: string, color: string, target_amount?: number) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Category name is required' };
    }

    const collision = categories.some(
      c => !c.deleted_at && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (collision) {
      return { success: false, error: `A category named "${trimmed}" already exists.` };
    }

    const nowIso = new Date().toISOString();
    const newCat: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      household_id: household.id,
      name: trimmed,
      icon,
      color,
      target_amount: target_amount && target_amount > 0 ? target_amount : undefined,
      is_archived: false,
      created_at: nowIso,
      updated_at: nowIso,
    };

    setCategories(prev => [...prev, newCat]);
    return { success: true };
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    if (updates.name) {
      const trimmed = updates.name.trim();
      const collision = categories.some(
        c => c.id !== id && !c.deleted_at && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (collision) {
        return { success: false, error: `A category named "${trimmed}" already exists.` };
      }
    }

    const nowIso = new Date().toISOString();
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates, updated_at: nowIso } : c))
    );
    return { success: true };
  };

  const archiveCategory = (id: string) => {
    const nowIso = new Date().toISOString();
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, is_archived: true, updated_at: nowIso } : c))
    );
  };

  const unarchiveCategory = (id: string) => {
    const nowIso = new Date().toISOString();
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, is_archived: false, updated_at: nowIso } : c))
    );
  };

  // Household Invite (§4.8: 8 chars, 48 hours expiry)
  const createInvite = (): Invite => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const newInvite: Invite = {
      id: `inv_${Date.now()}`,
      household_id: household.id,
      code,
      created_by: activeMember.user_id,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    };

    setInvites(prev => [newInvite, ...prev]);
    return newInvite;
  };

  const revokeInvite = (inviteId: string) => {
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const updateMemberName = (userId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, name: trimmed } : m));
  };

  const updateMemberProfile = (
    userId: string,
    updates: { name?: string; avatar_url?: string; avatar_color?: string }
  ) => {
    setMembers(prev =>
      prev.map(m => {
        if (m.user_id === userId) {
          return {
            ...m,
            name: updates.name?.trim() ? updates.name.trim() : m.name,
            avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : m.avatar_url,
            avatar_color: updates.avatar_color || m.avatar_color,
          };
        }
        return m;
      })
    );
  };

  const deleteMember = (userId: string): { success: boolean; error?: string } => {
    const activeMembers = members.filter(m => !m.deleted_at);
    if (activeMembers.length <= 1) {
      return {
        success: false,
        error: 'Cannot remove the only member in the household. At least one member is required.',
      };
    }

    const memberToDelete = members.find(m => m.user_id === userId);
    if (!memberToDelete) {
      return { success: false, error: 'Member not found.' };
    }

    const remaining = members.filter(m => m.user_id !== userId);
    setMembers(remaining);

    // Save to deleted members local storage blacklist to prevent auto-recreation
    try {
      const deletedList: string[] = JSON.parse(
        localStorage.getItem('env_budget_deleted_members') || '[]'
      );
      if (!deletedList.includes(userId)) {
        deletedList.push(userId);
        localStorage.setItem('env_budget_deleted_members', JSON.stringify(deletedList));
      }
    } catch (e) {
      console.warn('Error saving deleted member blacklist:', e);
    }

    // If the deleted member was active, switch to first remaining member
    if (activeMemberId === userId) {
      const nextActiveId = remaining[0]?.user_id || 'usr_me';
      setActiveMemberId(nextActiveId);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, nextActiveId);
    }

    // Immediately push updated members roster to Firestore so other devices sync
    if (db && householdId) {
      const docRef = doc(db, 'households', householdId);
      setDoc(
        docRef,
        {
          members: remaining,
          updated_at: serverTimestamp(),
          lastUpdatedBy: user?.displayName || user?.email || 'App',
        },
        { merge: true }
      ).catch(err => console.warn('Could not sync deleted member to cloud:', err));
    }

    return { success: true };
  };

  const addAllowedEmail = async (emailInput: string): Promise<{ success: boolean; error?: string }> => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return { success: false, error: 'Please enter a valid Google email address (e.g., spouse@gmail.com).' };
    }

    const currentAllowed = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    if (currentAllowed.includes(email)) {
      return { success: false, error: 'This email is already on the allowlist.' };
    }

    const ownerEmail = (household.owner_email || user?.email || '').trim().toLowerCase();
    const newAllowed = Array.from(new Set([...(ownerEmail ? [ownerEmail] : []), ...currentAllowed, email]));

    const updatedHousehold: Household = {
      ...household,
      owner_email: household.owner_email || ownerEmail || email,
      allowed_emails: newAllowed,
      updated_at: new Date().toISOString(),
    };

    setHousehold(updatedHousehold);
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(updatedHousehold));

    if (db && householdId) {
      try {
        const docRef = doc(db, 'households', householdId);
        await setDoc(
          docRef,
          {
            household: updatedHousehold,
            updatedAt: serverTimestamp(),
            lastUpdatedBy: user?.displayName || user?.email || 'Owner',
          },
          { merge: true }
        );
      } catch (err: any) {
        console.error('Error adding allowed email to Firestore:', err);
        return { success: false, error: 'Failed to update cloud allowlist: ' + (err.message || err) };
      }
    }

    return { success: true };
  };

  const removeAllowedEmail = async (emailInput: string): Promise<{ success: boolean; error?: string }> => {
    const email = emailInput.trim().toLowerCase();
    const ownerEmail = (household.owner_email || '').trim().toLowerCase();
    if (email === ownerEmail) {
      return { success: false, error: 'Cannot remove the primary household owner from the allowlist.' };
    }

    const currentAllowed = (household.allowed_emails || []).map(e => e.trim().toLowerCase());
    const newAllowed = currentAllowed.filter(e => e !== email);

    const updatedHousehold: Household = {
      ...household,
      allowed_emails: newAllowed,
      updated_at: new Date().toISOString(),
    };

    setHousehold(updatedHousehold);
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(updatedHousehold));

    if (db && householdId) {
      try {
        const docRef = doc(db, 'households', householdId);
        await setDoc(
          docRef,
          {
            household: updatedHousehold,
            updatedAt: serverTimestamp(),
            lastUpdatedBy: user?.displayName || user?.email || 'Owner',
          },
          { merge: true }
        );
      } catch (err: any) {
        console.error('Error removing allowed email from Firestore:', err);
        return { success: false, error: 'Failed to update cloud allowlist: ' + (err.message || err) };
      }
    }

    return { success: true };
  };

  const createNewHousehold = async (customName?: string): Promise<string> => {
    const newId = `hh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const name = customName?.trim() || (user?.displayName ? `${user.displayName.split(' ')[0]}'s Household` : 'Our Family Budget');
    const ownerEmail = (user?.email || '').trim().toLowerCase();

    const newHousehold: Household = {
      id: newId,
      name,
      owner_email: ownerEmail || undefined,
      allowed_emails: ownerEmail ? [ownerEmail] : [],
      created_by: user?.uid || 'usr_me',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setPermissionDenied(false);
    setHousehold(newHousehold);
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(newHousehold));
    setHouseholdId(newId);

    if (db) {
      try {
        const docRef = doc(db, 'households', newId);
        await setDoc(docRef, {
          household: newHousehold,
          categories: INITIAL_CATEGORIES,
          members: [
            {
              id: `mem_${Date.now()}`,
              household_id: newId,
              user_id: user?.uid || 'usr_me',
              name: user?.displayName || 'Owner',
              role: 'owner',
              avatar_url: user?.photoURL || undefined,
              avatar_color: '#4E785E',
              joined_at: new Date().toISOString(),
            },
          ],
          salaryEvents: [],
          allocations: [],
          transactions: [],
          reconciliations: [],
          reconciliationLines: [],
          envelopeTransfers: [],
          updatedAt: serverTimestamp(),
          lastUpdatedBy: user?.displayName || user?.email || 'Owner',
        });
      } catch (err) {
        console.warn('Could not immediately save new household to Firestore:', err);
      }
    }

    return newId;
  };

  const enterPreviewMode = () => {
    setPermissionDenied(false);
    const previewHh: Household = {
      ...INITIAL_HOUSEHOLD,
      id: 'hh_family_ledger_main',
      name: 'Preview Ledger',
      owner_email: undefined,
      allowed_emails: [],
    };
    setHousehold(previewHh);
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(previewHh));
    setHouseholdId('hh_family_ledger_main');
  };

  const updatePushSettings = (reminder_time: string, enabled: boolean) => {
    setPushSettings(prev => ({
      ...prev,
      reminder_time,
      enabled,
    }));
  };

  const moveEnvelopeFunds = (params: {
    fromCategoryId: string;
    toCategoryId: string;
    amountPaise: number;
    date?: string;
    note?: string;
  }): { success: boolean; error?: string; transfer?: EnvelopeTransfer } => {
    const { fromCategoryId, toCategoryId, amountPaise, date, note } = params;

    if (!fromCategoryId || !toCategoryId) {
      return { success: false, error: 'Please select both source and destination envelopes.' };
    }
    if (fromCategoryId === toCategoryId) {
      return { success: false, error: 'Source and destination envelopes must be different.' };
    }
    if (!amountPaise || amountPaise <= 0) {
      return { success: false, error: 'Transfer amount must be greater than zero.' };
    }

    const nowIso = new Date().toISOString();
    const txDate = date || nowIso.split('T')[0];
    const transferId = `env_tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newTransfer: EnvelopeTransfer = {
      id: transferId,
      household_id: household.id,
      from_category_id: fromCategoryId,
      to_category_id: toCategoryId,
      amount: amountPaise,
      date: txDate,
      logged_by_user_id: activeMember.user_id,
      note: note?.trim() || undefined,
      created_at: nowIso,
    };

    // Create paired allocations to immediately adjust envelope balances
    const allocFrom: Allocation = {
      id: `alloc_tr_${transferId}_from`,
      salary_event_id: transferId,
      category_id: fromCategoryId,
      planned_amount: -amountPaise,
      transferred: true, // internal envelope transfer, funds already in spend account
      transferred_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const allocTo: Allocation = {
      id: `alloc_tr_${transferId}_to`,
      salary_event_id: transferId,
      category_id: toCategoryId,
      planned_amount: amountPaise,
      transferred: true, // internal envelope transfer, funds already in spend account
      transferred_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    setAllocations(prev => [allocTo, allocFrom, ...prev]);
    setEnvelopeTransfers(prev => [newTransfer, ...prev]);

    return { success: true, transfer: newTransfer };
  };

  const deleteEnvelopeTransfer = (transferId: string) => {
    setEnvelopeTransfers(prev => prev.filter(t => t.id !== transferId));
    setAllocations(prev => prev.filter(a => a.salary_event_id !== transferId));
  };

  // Direct envelope top-up without going through salary flow
  const addCategoryFunds = (params: {
    categoryId: string;
    amountPaise: number;
    source?: string;
    note?: string;
    date?: string;
    depositHolding?: 'secondary_account' | 'cash' | 'primary_account';
    transferred?: boolean;
    loggedByUserId?: string;
  }): { success: boolean; error?: string; allocation?: Allocation } => {
    const {
      categoryId,
      amountPaise,
      source = 'Manual Top-Up',
      note,
      date,
      depositHolding = 'secondary_account',
      transferred: explicitTransferred,
      loggedByUserId,
    } = params;

    const targetCategory = categories.find(c => c.id === categoryId && !c.deleted_at);
    if (!targetCategory) {
      return { success: false, error: 'Envelope not found or has been deleted.' };
    }

    if (!amountPaise || amountPaise <= 0) {
      return { success: false, error: 'Amount must be greater than zero.' };
    }

    const nowIso = new Date().toISOString();
    const entryDate = date || nowIso.split('T')[0];
    const topupId = `env_topup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // If deposited to primary account and not explicitly set, transferred is false (reminds via bank transfer checklist)
    // If deposited to spend account or cash, funds are already available immediately
    const isTransferred = explicitTransferred !== undefined
      ? explicitTransferred
      : depositHolding !== 'primary_account';

    const newAllocation: Allocation = {
      id: `alloc_${topupId}`,
      salary_event_id: topupId,
      category_id: categoryId,
      planned_amount: amountPaise,
      transferred: isTransferred,
      transferred_at: isTransferred ? nowIso : null,
      created_at: entryDate ? `${entryDate}T12:00:00.000Z` : nowIso,
      updated_at: nowIso,
      source,
      note: note?.trim() || undefined,
      logged_by_user_id: loggedByUserId || activeMember.user_id,
      deposit_holding: depositHolding,
    };

    setAllocations(prev => [newAllocation, ...prev]);

    return { success: true, allocation: newAllocation };
  };

  const deleteCategoryFunds = (allocationId: string) => {
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
  };

  const resetToSampleData = async () => {
    const customUserName = localStorage.getItem('env_budget_user_name');
    const resetMembers = customUserName
      ? INITIAL_MEMBERS.map(m => (m.user_id === 'usr_me' ? { ...m, name: customUserName } : m))
      : INITIAL_MEMBERS;

    // 1. Immediately overwrite localStorage for guaranteed persistent reset
    try {
      localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(INITIAL_HOUSEHOLD));
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(resetMembers));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER_ID, resetMembers[0].user_id);
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
      localStorage.setItem(STORAGE_KEYS.SALARY_EVENTS, JSON.stringify(INITIAL_SALARY_EVENTS));
      localStorage.setItem(STORAGE_KEYS.ALLOCATIONS, JSON.stringify(INITIAL_ALLOCATIONS));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
      localStorage.setItem(STORAGE_KEYS.RECONCILIATIONS, JSON.stringify(INITIAL_RECONCILIATIONS));
      localStorage.setItem(STORAGE_KEYS.RECON_LINES, JSON.stringify(INITIAL_RECONCILIATION_LINES));
      localStorage.setItem(STORAGE_KEYS.ENVELOPE_TRANSFERS, JSON.stringify(INITIAL_ENVELOPE_TRANSFERS));
      localStorage.removeItem(STORAGE_KEYS.INVITES);
    } catch (e) {
      console.warn('LocalStorage reset note:', e);
    }

    // 2. Overwrite React state in memory
    setHousehold(INITIAL_HOUSEHOLD);
    setMembers(resetMembers);
    setActiveMemberId(resetMembers[0].user_id);
    setCategories(INITIAL_CATEGORIES);
    setSalaryEvents(INITIAL_SALARY_EVENTS);
    setAllocations(INITIAL_ALLOCATIONS);
    setTransactions(INITIAL_TRANSACTIONS);
    setReconciliations(INITIAL_RECONCILIATIONS);
    setReconciliationLines(INITIAL_RECONCILIATION_LINES);
    setEnvelopeTransfers(INITIAL_ENVELOPE_TRANSFERS);
    setInvites([]);

    // 3. Immediately reset Firestore document if synchronized
    if (householdId) {
      try {
        isRemoteSyncRef.current = true;
        setSyncStatus('syncing');
        const docRef = doc(db, 'households', householdId);
        const timeString = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        await setDoc(docRef, {
          household: INITIAL_HOUSEHOLD,
          members: resetMembers,
          categories: INITIAL_CATEGORIES,
          salaryEvents: INITIAL_SALARY_EVENTS,
          allocations: INITIAL_ALLOCATIONS,
          transactions: INITIAL_TRANSACTIONS,
          reconciliations: INITIAL_RECONCILIATIONS,
          reconciliationLines: INITIAL_RECONCILIATION_LINES,
          envelopeTransfers: INITIAL_ENVELOPE_TRANSFERS,
          lastSyncedAt: timeString,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: user?.displayName || user?.email || resetMembers[0].user_id,
        });
        setLastCloudSync(timeString);
        setSyncStatus('synced');
        setTimeout(() => {
          isRemoteSyncRef.current = false;
        }, 500);
      } catch (err) {
        console.warn('Firestore reset document sync notice:', err);
        isRemoteSyncRef.current = false;
        setSyncStatus('offline');
      }
    }
  };

  const isFirstTimeIntroCompleted = Boolean(
    household.first_time_intro_completed ||
    localStorage.getItem('env_budget_first_time_intro_done') === 'true'
  );

  // Sync server API intro status on mount
  useEffect(() => {
    if (!householdId) return;
    fetch(`/api/household/${householdId}/intro-status`)
      .then(res => res.json())
      .then(data => {
        if (data?.isCompleted) {
          setHousehold(prev => ({
            ...prev,
            first_time_intro_completed: true,
          }));
          localStorage.setItem('env_budget_first_time_intro_done', 'true');
          localStorage.setItem('env_budget_tour_completed', 'true');
        }
      })
      .catch(() => {});
  }, [householdId]);

  const resetLedgerToZero = async (isFirstTimeIntro: boolean = false) => {
    const customUserName = localStorage.getItem('env_budget_user_name');
    const currentMembers = customUserName
      ? members.map(m => (m.user_id === 'usr_me' ? { ...m, name: customUserName } : m))
      : members;

    const updatedHousehold: Household = {
      ...household,
      first_time_intro_completed: true,
      first_time_intro_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Immediately overwrite localStorage for persistent zero state
    try {
      localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(updatedHousehold));
      localStorage.setItem(STORAGE_KEYS.SALARY_EVENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ALLOCATIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECONCILIATIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RECON_LINES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ENVELOPE_TRANSFERS, JSON.stringify([]));
      localStorage.setItem('env_budget_tour_completed', 'true');
      localStorage.setItem('env_budget_first_time_intro_done', 'true');
    } catch (e) {
      console.warn('LocalStorage zero reset note:', e);
    }

    // 2. Overwrite in-memory React state to zero
    setHousehold(updatedHousehold);
    setSalaryEvents([]);
    setAllocations([]);
    setTransactions([]);
    setReconciliations([]);
    setReconciliationLines([]);
    setEnvelopeTransfers([]);

    // 3. Mark completion on server API
    try {
      fetch(`/api/household/${householdId}/complete-intro`, { method: 'POST' }).catch(() => {});
    } catch {}

    // 4. Overwrite Firestore document
    if (householdId) {
      try {
        isRemoteSyncRef.current = true;
        setSyncStatus('syncing');
        const docRef = doc(db, 'households', householdId);
        const timeString = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        await setDoc(docRef, {
          household: updatedHousehold,
          first_time_intro_completed: true,
          first_time_intro_completed_at: new Date().toISOString(),
          members: currentMembers,
          categories,
          salaryEvents: [],
          allocations: [],
          transactions: [],
          reconciliations: [],
          reconciliationLines: [],
          envelopeTransfers: [],
          lastSyncedAt: timeString,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: user?.displayName || user?.email || currentMembers[0]?.user_id || 'usr_me',
        });
        setLastCloudSync(timeString);
        setSyncStatus('synced');
        setTimeout(() => {
          isRemoteSyncRef.current = false;
        }, 500);
      } catch (err) {
        console.warn('Firestore zero-reset document sync notice:', err);
        isRemoteSyncRef.current = false;
        setSyncStatus('offline');
      }
    }
  };

  return (
    <BudgetContext.Provider
      value={{
        household,
        members,
        activeMember,
        categories,
        activeCategories,
        salaryEvents,
        allocations,
        transactions,
        reconciliations,
        reconciliationLines,
        envelopeTransfers,
        invites,
        selectedMonth,
        setSelectedMonth,
        categoryBalances,
        totalAvailablePaise,
        totalPendingPaybackPaise,
        pendingTransfersList,
        pushSettings,
        setActiveMemberId,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        logCorrection,
        addSalaryAndAllocations,
        toggleAllocationTransferred,
        markAllAllocationsTransferred,
        reconcileCategoryCardSpend,
        deleteReconciliation,
        moveEnvelopeFunds,
        deleteEnvelopeTransfer,
        addCategoryFunds,
        deleteCategoryFunds,
        createCategory,
        updateCategory,
        archiveCategory,
        unarchiveCategory,
        updateMemberName,
        updateMemberProfile,
        deleteMember,
        createInvite,
        revokeInvite,
        updatePushSettings,
        resetToSampleData,
        resetLedgerToZero,
        isFirstTimeIntroCompleted,
        householdId,
        cloudSyncStatus,
        lastCloudSync,
        syncNow,
        isAccessAllowed,
        accessBlockedReason,
        isOwner,
        addAllowedEmail,
        removeAllowedEmail,
        createNewHousehold,
        enterPreviewMode,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
};

export function useBudget(): BudgetContextType {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
}
