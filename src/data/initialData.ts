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

// Clean empty starting state - no demo values
export const INITIAL_SALARY_EVENTS: SalaryEvent[] = [];
export const INITIAL_ALLOCATIONS: Allocation[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_RECONCILIATIONS: Reconciliation[] = [];
export const INITIAL_RECONCILIATION_LINES: ReconciliationLine[] = [];
export const INITIAL_ENVELOPE_TRANSFERS: EnvelopeTransfer[] = [];
