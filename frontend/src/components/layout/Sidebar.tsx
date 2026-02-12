'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import VIPModal from '@/components/modals/VIPModal';
import { useModal } from '@/contexts/ModalContext';
import { useProtectedNav } from '@/hooks/useProtectedNav';
// StatisticsModal removed - now a full page
import SettingsModal from '@/components/modals/SettingsModal';

// ============================================
// ICONS
// ============================================
const icons: Record<string, JSX.Element> = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  crash: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  dice: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  mines: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  plinko: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  olympus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  'nova-rush': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  'dragon-blaze': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  ),
  wallet: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  stats: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  close: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  casino: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  sports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  admin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  vip: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l3.057 6.171L15 10.586l-5 4.879L11.057 22 5 18.171 -1.057 22 0 15.465l-5-4.879 6.943-1.415L5 3z" transform="translate(7, 1) scale(0.8)" />
    </svg>
  ),
  promotions: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  ),
  affiliates: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  history: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  // Sports-specific icons
  football: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  ),
  basketball: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20M12 2v20" />
    </svg>
  ),
  tennis: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 5.64a9 9 0 01-12.73 12.73M5.64 5.64a9 9 0 0112.73 12.73" />
    </svg>
  ),
  esports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  mma: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  racing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  agent: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  master: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

// ============================================
// NAV ITEMS
// ============================================
interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string;
}

// Casino navigation items - visible to ALL roles
const casinoNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/' },
  { id: 'crash', label: 'Crash', icon: 'crash', href: '/games/crash', badge: 'HOT' },
  { id: 'plinko', label: 'Plinko', icon: 'plinko', href: '/games/plinko', badge: 'NEW' },
  { id: 'dice', label: 'Dice', icon: 'dice', href: '/games/dice' },
  { id: 'mines', label: 'Mines', icon: 'mines', href: '/games/mines' },
  { id: 'olympus', label: 'Olympus', icon: 'olympus', href: '/games/olympus', badge: 'NEW' },
  { id: 'nova-rush', label: 'Nova Rush', icon: 'nova-rush', href: '/games/nova-rush', badge: 'NEW' },
  { id: 'dragon-blaze', label: 'Dragon Blaze', icon: 'dragon-blaze', href: '/games/dragon-blaze', badge: 'HOT' },
  { id: "card-rush", label: "Card Rush", icon: "card-rush", href: "/games/card-rush", badge: "NEW" },
  { id: "limbo", label: "Limbo", icon: "limbo", href: "/games/limbo", badge: "NEW" },
  { id: "penalty", label: "Penalty", icon: "penalty", href: "/games/penalty", badge: "NEW" },
];

// Sports navigation items
const sportsNavItems: NavItem[] = [
  { id: 'sports-home', label: 'Sports Home', icon: 'sports', href: '/sports' },
  { id: 'my-bets', label: 'My Bets', icon: 'sports', href: '/sports/my-bets', badge: 'NEW' },
  { id: 'football', label: 'Football', icon: 'football', href: '/sports/football', badge: 'LIVE' },
  { id: 'basketball', label: 'Basketball', icon: 'basketball', href: '/sports/basketball', badge: 'LIVE' },
  { id: 'tennis', label: 'Tennis', icon: 'tennis', href: '/sports/tennis' },
  { id: 'esports', label: 'eSports', icon: 'esports', href: '/sports/esports', badge: 'HOT' },
  { id: 'mma', label: 'MMA / UFC', icon: 'mma', href: '/sports/mma' },
  { id: 'racing', label: 'Racing', icon: 'racing', href: '/sports/racing' },
];

// ============================================
// ROLE CONFIGURATION
// ============================================
interface RolePanelConfig {
  label: string;
  href: string;
  icon: string;
  badgeText: string;
  badgeColor: string;
  borderColor: string;
  textColor: string;
  hoverBg: string;
}

const rolePanelConfig: Record<string, RolePanelConfig> = {
  ADMIN: {
    label: 'Admin Panel',
    href: '/admin/dashboard',
    icon: 'admin',
    badgeText: 'ADMIN',
    badgeColor: 'bg-red-500/20 text-red-400',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    hoverBg: 'hover:bg-red-500/10',
  },
  SUPER_MASTER: {
    label: 'Admin Panel',
    href: '/admin/dashboard',
    icon: 'admin',
    badgeText: 'SUPER',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    hoverBg: 'hover:bg-purple-500/10',
  },
  MASTER: {
    label: 'Master Panel',
    href: '/admin/dashboard',
    icon: 'master',
    badgeText: 'MASTER',
    badgeColor: 'bg-orange-500/20 text-orange-400',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    hoverBg: 'hover:bg-orange-500/10',
  },
  AGENT: {
    label: 'Agent Panel',
    href: '/admin/dashboard',
    icon: 'agent',
    badgeText: 'AGENT',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    hoverBg: 'hover:bg-blue-500/10',
  },
};

// ============================================
// SIDEBAR COMPONENT
// ============================================
interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { openWallet } = useModal();
  const { handleProtectedNav } = useProtectedNav();
  const [activeSection, setActiveSection] = React.useState<'casino' | 'sports'>(
    pathname?.startsWith('/sports') ? 'sports' : 'casino'
  );
  const [isVIPModalOpen, setIsVIPModalOpen] = useState(false);
  // Stats modal state removed - now a full page
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const handleSectionSwitch = (section: 'casino' | 'sports') => {
    setActiveSection(section);
    if (section === 'casino') {
      router.push('/');
    } else {
      router.push('/sports');
    }
    if (onClose) onClose();
  };

  const currentNavItems = activeSection === 'casino' ? casinoNavItems : sportsNavItems;
  const sectionLabel = activeSection === 'casino' ? 'Games' : 'Sports';

  // Get the role panel config for current user
  const userRole = user?.role || 'USER';
  const panelConfig = rolePanelConfig[userRole];
  const isSystemOwner = userRole === 'ADMIN' || userRole === 'SUPER_MASTER';

  return (
    <aside data-testid="sidebar" className="h-full flex flex-col bg-bg-card">
      {/* Logo + Close Button */}
      <div className="p-4 lg:p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-primary flex items-center justify-center shadow-glow-cyan">
            <span className="text-xl font-bold text-black">S</span>
          </div>
          <div>
            <h1 data-testid="logo-text" className="text-xl font-bold text-white">StakePro</h1>
            <p className="text-xs text-text-secondary">Crypto Casino</p>
          </div>
        </div>
        {onClose && (
          <button
            data-testid="sidebar-close"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
          >
            {icons.close}
          </button>
        )}
      </div>

      {/* Casino / Sports Toggle */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex rounded-lg overflow-hidden bg-white/5">
          <button
            data-testid="nav-casino"
            onClick={() => handleSectionSwitch('casino')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
              activeSection === 'casino'
                ? 'bg-accent-primary text-black'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            {icons.casino}
            Casino
          </button>
          <button
            data-testid="nav-sports"
            onClick={() => handleSectionSwitch('sports')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
              activeSection === 'sports'
                ? 'bg-accent-primary text-black'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            {icons.sports}
            Sports
          </button>
        </div>
      </div>

      {/* Management Panel Button - Fixed, always visible for management roles */}
      {panelConfig && (
        <div className="px-4 py-3 border-b border-white/10">
          <Link
            href={panelConfig.href}
            data-testid="nav-admin"
            onClick={handleNavClick}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold ${panelConfig.textColor} ${panelConfig.hoverBg} border-2 ${panelConfig.borderColor}`}
          >
            {icons[panelConfig.icon]}
            <span>{panelConfig.label}</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${panelConfig.badgeColor}`}>
              {panelConfig.badgeText}
            </span>
          </Link>
        </div>
      )}
      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Games/Sports Section */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {sectionLabel}
          </span>
        </div>

        <ul data-testid="nav-main-list" className="space-y-1 px-2">
          {currentNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  data-testid={`nav-${item.id}`}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                      : 'text-text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  {icons[item.icon]}
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge && (
                    <span data-testid={`badge-${item.id}`} className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                      item.badge === 'LIVE'
                        ? 'bg-red-500/20 text-red-400 animate-pulse'
                        : 'bg-accent-primary/20 text-accent-primary'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Divider */}
        <div className="my-4 mx-4 border-t border-white/10" />

        {/* Account Section - visible to ALL authenticated users */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Account
          </span>
        </div>

        <ul data-testid="nav-account-list" className="space-y-1 px-2">
          {/* Profile - Link to profile page */}
          <li>
            <button
              data-testid="nav-profile"
              onClick={() => { handleProtectedNav('/profile', onClose); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                pathname === '/profile'
                  ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {icons.profile}
              <span className="font-medium">Profile</span>
            </button>
          </li>
          {/* Wallet - Modal */}
          <li>
            <button
              data-testid="nav-wallet"
              onClick={() => { openWallet(); if (onClose) onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5"
            >
              {icons.wallet}
              <span className="font-medium">Wallet</span>
            </button>
          </li>
          {/* Statistics - Full Page */}
          <li>
            <Link
              href="/statistics"
              data-testid="nav-stats"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                pathname === '/statistics'
                  ? 'text-white bg-white/10'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {icons.stats}
              <span className="font-medium">Statistics</span>
            </Link>
          </li>
          {/* Settings - Modal */}
          <li>
            <button
              data-testid="nav-settings"
              onClick={() => setIsSettingsModalOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5"
            >
              {icons.settings}
              <span className="font-medium">Settings</span>
            </button>
          </li>
        </ul>

        {/* Divider */}
        <div className="my-4 mx-4 border-t border-white/10" />

        {/* Explore Section - visible to ALL */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Explore
          </span>
        </div>

        <ul data-testid="nav-explore-list" className="space-y-1 px-2">
          <li>
            <Link
              href="/vip"
              data-testid="nav-vip"
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                pathname === '/vip'
                  ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {icons.vip}
              <span className="font-medium">VIP Program</span>
              <span className="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded-full font-semibold">VIP</span>
            </Link>
          </li>
          <li>
            <Link
              href="/promotions"
              data-testid="nav-promotions"
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                pathname === '/promotions'
                  ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {icons.promotions}
              <span className="font-medium">Promotions</span>
            </Link>
          </li>
          <li>
            <button
              data-testid="nav-affiliates"
              onClick={() => { handleProtectedNav('/affiliates', onClose); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                pathname === '/affiliates'
                  ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {icons.affiliates}
              <span className="font-medium">
                {isSystemOwner ? 'Network Overview' : 'Affiliates'}
              </span>
              {isSystemOwner && (
                <span className="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded-full font-semibold">ROOT</span>
              )}
            </button>
          </li>
        </ul>


      {/* VIP / System Owner Banner */}
      <div className="p-4 border-t border-white/10">
        {isSystemOwner ? (
          <div data-testid="system-owner-banner" className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/30 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">🛡️</div>
            <p className="text-sm font-bold bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">SYSTEM OWNER</p>
            <p className="text-xs text-yellow-400/70 mt-1">Full platform control</p>
            <Link
              href="/admin/dashboard"
              data-testid="admin-quick-access"
              onClick={handleNavClick}
              className="block w-full mt-3 px-4 py-2 border border-yellow-500/50 text-yellow-400 text-sm rounded-lg hover:bg-yellow-500/10 transition-colors text-center"
            >
              Admin Dashboard
            </Link>
          </div>
        ) : (
          <div data-testid="vip-banner" className="bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 border border-accent-primary/20 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">👑</div>
            <p className="text-sm font-semibold text-accent-primary">VIP Program</p>
            <p className="text-xs text-text-secondary mt-1">Unlock exclusive rewards</p>
            <Link
              href="/vip"
              data-testid="vip-learn-more"
              onClick={handleNavClick}
              className="block w-full mt-3 px-4 py-2 border border-accent-primary/50 text-accent-primary text-sm rounded-lg hover:bg-accent-primary/10 transition-colors text-center"
            >
              Learn More
            </Link>
          </div>
        )}
      </div>

      </nav>
      {/* Modals */}
      <VIPModal isOpen={isVIPModalOpen} onClose={() => setIsVIPModalOpen(false)} />
      
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
    </aside>
  );
};

export default Sidebar;