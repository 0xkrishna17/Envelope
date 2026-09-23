import React from 'react';
import {
  ShoppingBag,
  UtensilsCrossed,
  Zap,
  Car,
  HeartPulse,
  Sparkles,
  Home,
  Wallet,
  Coffee,
  Plane,
  Gift,
  Film,
  BookOpen,
  GraduationCap,
  Shirt,
  Smartphone,
  Shield,
  Briefcase,
  Smile,
  Receipt,
  PiggyBank,
  LucideIcon
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag,
  UtensilsCrossed,
  Zap,
  Car,
  HeartPulse,
  Sparkles,
  Home,
  Wallet,
  Coffee,
  Plane,
  Gift,
  Film,
  BookOpen,
  GraduationCap,
  Shirt,
  Smartphone,
  Shield,
  Briefcase,
  Smile,
  Receipt,
  PiggyBank,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export interface ColorScheme {
  id: string;
  name: string;
  hex: string;
  badgeBg: string;
  badgeText: string;
  darkBadgeBg: string;
  darkBadgeText: string;
  border: string;
}

export const MUTED_COLOR_PALETTES: ColorScheme[] = [
  {
    id: 'sage',
    name: 'Soft Sage',
    hex: '#4E785E',
    badgeBg: 'bg-[#EBF2ED]',
    badgeText: 'text-[#2C523B]',
    darkBadgeBg: 'dark:bg-[#1E2E24]',
    darkBadgeText: 'dark:text-[#A8D1B7]',
    border: 'border-[#CADBCE]',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    hex: '#B85D43',
    badgeBg: 'bg-[#F9ECE8]',
    badgeText: 'text-[#87341D]',
    darkBadgeBg: 'dark:bg-[#331D16]',
    darkBadgeText: 'dark:text-[#F3B3A2]',
    border: 'border-[#E8C5BC]',
  },
  {
    id: 'dusty-blue',
    name: 'Dusty Blue',
    hex: '#486B88',
    badgeBg: 'bg-[#EBF1F6]',
    badgeText: 'text-[#24425A]',
    darkBadgeBg: 'dark:bg-[#1B2936]',
    darkBadgeText: 'dark:text-[#A4C4DF]',
    border: 'border-[#C6D8E7]',
  },
  {
    id: 'ochre',
    name: 'Ochre',
    hex: '#AF7832',
    badgeBg: 'bg-[#F7EFE4]',
    badgeText: 'text-[#7A4E15]',
    darkBadgeBg: 'dark:bg-[#312415]',
    darkBadgeText: 'dark:text-[#E8C694]',
    border: 'border-[#E5D4B8]',
  },
  {
    id: 'clay',
    name: 'Clay Rose',
    hex: '#9E5460',
    badgeBg: 'bg-[#F7EBEE]',
    badgeText: 'text-[#6C2934]',
    darkBadgeBg: 'dark:bg-[#311A1F]',
    darkBadgeText: 'dark:text-[#E4A7B1]',
    border: 'border-[#E6C3C9]',
  },
  {
    id: 'lavender',
    name: 'Muted Lavender',
    hex: '#6D5E8C',
    badgeBg: 'bg-[#F0EDF6]',
    badgeText: 'text-[#443662]',
    darkBadgeBg: 'dark:bg-[#251E33]',
    darkBadgeText: 'dark:text-[#C5B8DE]',
    border: 'border-[#D4CBE5]',
  },
  {
    id: 'olive',
    name: 'Olive Grove',
    hex: '#66734B',
    badgeBg: 'bg-[#EFF2EB]',
    badgeText: 'text-[#3E4928]',
    darkBadgeBg: 'dark:bg-[#252C1A]',
    darkBadgeText: 'dark:text-[#BCC8A3]',
    border: 'border-[#CFD8C3]',
  },
  {
    id: 'slate',
    name: 'Warm Slate',
    hex: '#78716C',
    badgeBg: 'bg-[#F5F4F2]',
    badgeText: 'text-[#44403C]',
    darkBadgeBg: 'dark:bg-[#292524]',
    darkBadgeText: 'dark:text-[#D6D3D1]',
    border: 'border-[#E7E5E4]',
  },
];

export function getColorScheme(hexOrId: string): ColorScheme {
  const found = MUTED_COLOR_PALETTES.find(
    c => c.hex.toLowerCase() === hexOrId.toLowerCase() || c.id === hexOrId
  );
  return found || MUTED_COLOR_PALETTES[7]; // default slate
}

export function renderCategoryIcon(iconName: string, className = 'w-5 h-5'): React.ReactNode {
  const IconComponent = ICON_MAP[iconName] || Wallet;
  return React.createElement(IconComponent, { className });
}
