import { Household, Membership, Category, SalaryEvent, Allocation, Transaction, Reconciliation, ReconciliationLine, EnvelopeTransfer } from '../types';

export const INITIAL_HOUSEHOLD: Household = {
  id: 'hh_main',
  name: 'Our Household Ledger',
  created_by: 'usr_me',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

export const INITIAL_MEMBERS: Membership[] = [
  {
    id: 'mem_1',
    household_id: 'hh_main',
    user_id: 'usr_me',
    name: 'You',
    role: 'owner',
    avatar_color: '#4E785E',
    joined_at: '2026-08-01T00:00:00Z',
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat_unallocated',
    household_id: 'hh_main',
    name: 'Unallocated',
    icon: 'Wallet',
    color: '#78716C', // Stone
    is_archived: false,
    is_unallocated: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_groceries',
    household_id: 'hh_main',
    name: 'Groceries & Supplies',
    icon: 'ShoppingBag',
    color: '#4E785E', // Sage
    target_amount: 2500000, // ₹25,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_dining',
    household_id: 'hh_main',
    name: 'Dining & Cafes',
    icon: 'UtensilsCrossed',
    color: '#B85D43', // Terracotta
    target_amount: 1200000, // ₹12,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_bills',
    household_id: 'hh_main',
    name: 'Utilities & Bills',
    icon: 'Zap',
    color: '#486B88', // Dusty Blue
    target_amount: 1000000, // ₹10,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_transport',
    household_id: 'hh_main',
    name: 'Fuel & Transport',
    icon: 'Car',
    color: '#AF7832', // Ochre
    target_amount: 800000, // ₹8,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_healthcare',
    household_id: 'hh_main',
    name: 'Healthcare & Meds',
    icon: 'HeartPulse',
    color: '#9E5460', // Clay
    target_amount: 500000, // ₹5,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_personal',
    household_id: 'hh_main',
    name: 'Personal & Fun',
    icon: 'Sparkles',
    color: '#6D5E8C', // Lavender
    target_amount: 800000, // ₹8,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'cat_home',
    household_id: 'hh_main',
    name: 'Home & Repair',
    icon: 'Home',
    color: '#66734B', // Olive
    target_amount: 1000000, // ₹10,000 in paise
    is_archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
];

export const INITIAL_SALARY_EVENTS: SalaryEvent[] = [
  {
    id: 'sal_sep_1',
    household_id: 'hh_main',
    earner_user_id: 'usr_me',
    amount: 15000000, // ₹1,50,000
    date: '2026-09-01',
    created_at: '2026-09-01T09:00:00Z',
  },
];

export const INITIAL_ALLOCATIONS: Allocation[] = [
  {
    id: 'alloc_1',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_groceries',
    planned_amount: 2500000, // ₹25,000
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'alloc_2',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_dining',
    planned_amount: 1200000, // ₹12,000
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'alloc_3',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_bills',
    planned_amount: 1000000, // ₹10,000
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'alloc_4',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_transport',
    planned_amount: 800000, // ₹8,000
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'alloc_5',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_healthcare',
    planned_amount: 500000, // ₹5,000
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'alloc_6',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_personal',
    planned_amount: 800000, // ₹8,000
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'alloc_7',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_home',
    planned_amount: 1000000, // ₹10,000
    transferred: false, // demonstrates pending transfer checklist!
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T09:05:00Z',
  },
  {
    id: 'alloc_8',
    salary_event_id: 'sal_sep_1',
    category_id: 'cat_unallocated',
    planned_amount: 7200000, // ₹72,000 leftover
    transferred: true,
    transferred_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:05:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_1',
    household_id: 'hh_main',
    category_id: 'cat_groceries',
    amount: 325000, // ₹3,250
    date: '2026-09-02',
    logged_by_user_id: 'usr_me',
    payment_method: 'credit_card',
    note: 'Nature Basket organic veggies & milk',
    reconciliation_status: 'reconciled',
    created_at: '2026-09-02T11:00:00Z',
    updated_at: '2026-09-05T12:00:00Z',
  },
  {
    id: 'tx_2',
    household_id: 'hh_main',
    category_id: 'cat_groceries',
    amount: 185000, // ₹1,850
    date: '2026-09-12',
    logged_by_user_id: 'usr_me',
    payment_method: 'credit_card',
    note: 'Weekly essentials & fruits',
    reconciliation_status: 'pending',
    created_at: '2026-09-12T16:00:00Z',
    updated_at: '2026-09-12T16:00:00Z',
  },
  {
    id: 'tx_3',
    household_id: 'hh_main',
    category_id: 'cat_dining',
    amount: 240000, // ₹2,400
    date: '2026-09-08',
    logged_by_user_id: 'usr_me',
    payment_method: 'credit_card',
    note: 'Dinner at Bombay Canteen',
    reconciliation_status: 'pending',
    created_at: '2026-09-08T20:30:00Z',
    updated_at: '2026-09-08T20:30:00Z',
  },
  {
    id: 'tx_4',
    household_id: 'hh_main',
    category_id: 'cat_transport',
    amount: 300000, // ₹3,000
    date: '2026-09-04',
    logged_by_user_id: 'usr_me',
    payment_method: 'secondary_account_debit',
    note: 'Fuel tank full HP petrol pump',
    reconciliation_status: 'n/a',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'tx_5',
    household_id: 'hh_main',
    category_id: 'cat_bills',
    amount: 420000, // ₹4,200
    date: '2026-09-10',
    logged_by_user_id: 'usr_me',
    payment_method: 'credit_card',
    note: 'Electricity bill Adani Electricity',
    reconciliation_status: 'pending',
    created_at: '2026-09-10T14:00:00Z',
    updated_at: '2026-09-10T14:00:00Z',
  },
  {
    id: 'tx_6',
    household_id: 'hh_main',
    category_id: 'cat_healthcare',
    amount: 75000, // ₹750
    date: '2026-09-14',
    logged_by_user_id: 'usr_me',
    payment_method: 'cash',
    note: 'Pharmacy vitamins & first aid',
    reconciliation_status: 'n/a',
    created_at: '2026-09-14T11:00:00Z',
    updated_at: '2026-09-14T11:00:00Z',
  },
];

export const INITIAL_RECONCILIATIONS: Reconciliation[] = [
  {
    id: 'rec_init_1',
    household_id: 'hh_main',
    category_id: 'cat_groceries',
    total_amount: 325000, // ₹3,250 transferred from spend -> salary
    date: '2026-09-05',
    logged_by_user_id: 'usr_me',
    created_at: '2026-09-05T12:00:00Z',
  },
];

export const INITIAL_RECONCILIATION_LINES: ReconciliationLine[] = [
  {
    id: 'recline_1',
    reconciliation_id: 'rec_init_1',
    transaction_id: 'tx_1',
    amount_applied: 325000,
  },
];

export const INITIAL_ENVELOPE_TRANSFERS: EnvelopeTransfer[] = [
  {
    id: 'env_tr_init_1',
    household_id: 'hh_main',
    from_category_id: 'cat_groceries',
    to_category_id: 'cat_dining',
    amount: 100000, // ₹1,000 in paise
    date: '2026-09-06',
    logged_by_user_id: 'usr_me',
    note: 'Weekend dining buffer reallocation',
    created_at: '2026-09-06T18:00:00Z',
  },
];
