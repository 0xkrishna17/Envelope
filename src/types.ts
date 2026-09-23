export type PaymentMethod = 'credit_card' | 'secondary_account_debit' | 'cash' | 'other';

export type ReconciliationStatus = 'n/a' | 'pending' | 'partially_reconciled' | 'reconciled';

export type MemberRole = 'owner' | 'member';

export interface Household {
  id: string;
  name: string;
  created_by: string;
  owner_email?: string;
  allowed_emails?: string[];
  created_at: string;
  updated_at: string;
  first_time_intro_completed?: boolean;
  first_time_intro_completed_at?: string;
}

export interface Membership {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  role: MemberRole;
  avatar_color: string;
  avatar_url?: string;
  email?: string;
  joined_at: string;
  deleted_at?: string | null;
}

export interface Invite {
  id: string;
  household_id: string;
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_by?: string;
  used_at?: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  color: string; // Tailored muted palette key e.g. 'sage' | 'terracotta' | 'dusty-blue' | 'ochre' | 'clay'
  target_amount?: number; // Integer paise, optional, informational only
  is_archived: boolean;
  is_unallocated?: boolean; // built-in non-deletable category
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface SalaryEvent {
  id: string;
  household_id: string;
  earner_user_id: string;
  amount: number; // Integer paise
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Allocation {
  id: string;
  salary_event_id: string;
  category_id: string;
  planned_amount: number; // Integer paise
  transferred: boolean; // Has been transferred from Salary -> Spend account in bank
  transferred_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  source?: string; // e.g. 'Gift', 'Reimbursement', 'Bonus', 'Cashback', 'Manual Top-Up'
  note?: string;
  logged_by_user_id?: string;
  deposit_holding?: 'secondary_account' | 'cash' | 'primary_account';
}

export interface Transaction {
  id: string;
  household_id: string;
  category_id: string;
  amount: number; // Integer paise (may be negative for refunds/credits)
  date: string; // YYYY-MM-DD
  logged_by_user_id: string;
  payment_method: PaymentMethod;
  note?: string;
  reconciliation_status: ReconciliationStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Reconciliation {
  id: string;
  household_id: string;
  category_id: string;
  total_amount: number; // Integer paise transferred from Spend -> Salary
  date: string; // YYYY-MM-DD
  logged_by_user_id: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface ReconciliationLine {
  id: string;
  reconciliation_id: string;
  transaction_id: string;
  amount_applied: number; // Integer paise
}

export interface PushSubscriptionSetting {
  id: string;
  user_id: string;
  reminder_time: string; // e.g. "21:00"
  timezone: string; // e.g. "Asia/Kolkata"
  enabled: boolean;
  created_at: string;
}

export interface CategoryBalanceInfo {
  category: Category;
  availableNow: number; // Integer paise (across all time, running total)
  thisMonthAllocated: number; // Integer paise (for selected month)
  thisMonthSpent: number; // Integer paise (for selected month)
  pendingCardDebt: number; // Integer paise (unreconciled card spend)
}

export interface EnvelopeTransfer {
  id: string;
  household_id: string;
  from_category_id: string;
  to_category_id: string;
  amount: number; // Integer paise
  date: string; // YYYY-MM-DD
  logged_by_user_id: string;
  note?: string;
  created_at: string;
}

export interface ParsedVoiceIntent {
  intent: 'add_transaction' | 'mark_salary_arrived' | 'mark_reconciled' | 'query_balance' | 'move_funds' | 'topup_category';
  amountInPaise: number;
  categoryName?: string;
  fromCategoryName?: string;
  toCategoryName?: string;
  paymentMethod?: PaymentMethod;
  earnerName?: string;
  note?: string;
  summaryExplanation: string;
}
