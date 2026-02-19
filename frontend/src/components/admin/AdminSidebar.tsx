'use client';

import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/contexts/BrandingContext';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy,
  LayoutDashboard,
  Users,
  DollarSign,
  CreditCard,
  Gamepad2,
  Settings,
  ArrowLeft,
  Globe,
  Shield,
  X,
  Menu,
  Wallet,
  ScrollText,
  Palette,
  Gift,
} from 'lucide-react';

// ============================================
// NAV ITEMS - Admin-specific links
// ============================================
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

// Items visible to ALL admins (including white-label)
const adminNavItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: '/admin/dashboard',
    badge: 'LIVE',
  },
  {
    id: 'users',
    label: 'Users',
    icon: <Users className="w-5 h-5" />,
    href: '/admin/users',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: <DollarSign className="w-5 h-5" />,
    href: '/admin/finance',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    icon: <CreditCard className="w-5 h-5" />,
    href: '/admin/transactions',
  },
  {
    id: 'withdrawals',
    label: 'Withdrawals',
    icon: <Wallet className="w-5 h-5" />,
    href: '/admin/withdrawals',
  },
  {
    id: 'game-logs',
    label: 'Game Logs',
    icon: <ScrollText className="w-5 h-5" />,
    href: '/admin/game-history',
  },
  {
    id: 'games',
    label: 'Game Control',
    icon: <Gamepad2 className="w-5 h-5" />,
    href: '/admin/games',
  },
  {
    id: "sports",
    label: "Sports Betting",
    icon: <Trophy className="w-5 h-5" />,
    href: "/admin/sports",
    badge: "NEW",
  },
  {
    id: 'affiliate-settings',
    label: 'Affiliate Settings',
    icon: <Users className="w-5 h-5" />,
    href: '/admin/affiliate-settings',
  },
  {
    id: 'reward-pool',
    label: 'Reward Pool',
    icon: <Gift className="w-5 h-5" />,
    href: '/admin/reward-pool',
    badge: 'NEW',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    href: '/admin/settings',
  },
];

// Items visible ONLY to Super Admin (marketedgepros@gmail.com)
const superAdminOnlyItems: NavItem[] = [
  {
    id: 'brand-settings',
    label: 'Brand Settings',
    icon: <Palette className="w-5 h-5" />,
    href: '/admin/brand-settings',
  },
  {
    id: 'god-mode',
    label: 'God Mode',
    icon: <Shield className="w-5 h-5" />,
    href: '/admin/god-mode',
    badge: 'GOD',
  },
];

// ============================================
// ADMIN SIDEBAR COMPONENT
// Cloned from Sidebar.tsx - identical structure
// ============================================
interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export default function AdminSidebar({ isOpen, onClose, onOpen }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { branding } = useBranding();
  const isSuperAdmin = user?.role === 'ADMIN' && user?.email === 'marketedgepros@gmail.com';

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          data-testid="admin-sidebar-overlay"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container - EXACT same structure as MainLayout aside */}
      <aside
        data-testid="admin-sidebar"
        className={`fixed top-0 left-0 h-full w-64 bg-bg-card border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Inner sidebar - EXACT same structure as Sidebar.tsx */}
        <div className="h-full flex flex-col bg-bg-card">
          {/* Logo + Close Button - Same as Sidebar.tsx */}
          <div className="p-4 lg:p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-primary flex items-center justify-center shadow-glow">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 data-testid="admin-logo-text" className="text-xl font-bold text-white">
                  {branding?.brandName || 'Casino'}
                </h1>
                <p className="text-xs text-text-secondary">Admin Panel</p>
              </div>
            </div>
            {/* Close button - mobile only (same as Sidebar.tsx) */}
            <button
              data-testid="admin-sidebar-close"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Admin Mode Toggle - Same position as Casino/Sports toggle */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex rounded-lg overflow-hidden bg-white/5">
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-accent-primary text-black">
                <Shield className="w-4 h-4" />
                Admin Mode
              </div>
            </div>
          </div>

          {/* Main Navigation - Same structure as Sidebar.tsx */}
          <nav
            data-testid="admin-main-nav"
            className="flex-1 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
          >
            {/* Section Header */}
            <div className="px-4 mb-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Management
              </span>
            </div>

            {/* Nav Items - Same styling as Sidebar.tsx links */}
            <ul data-testid="admin-nav-list" className="space-y-1 px-2">
              {adminNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname?.startsWith(item.href));
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      data-testid={`admin-nav-${item.id}`}
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.badge && (
                        <span
                          data-testid={`admin-badge-${item.id}`}
                          className="px-2 py-0.5 text-[10px] bg-accent-primary/20 text-accent-primary rounded-full font-semibold"
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
              {/* Super Admin Only Items */}
              {isSuperAdmin && superAdminOnlyItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname?.startsWith(item.href));
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      data-testid={`admin-nav-${item.id}`}
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-accent-primary/20 text-accent-primary shadow-glow-cyan-sm'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.badge && (
                        <span
                          data-testid={`admin-badge-${item.id}`}
                          className="px-2 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded-full font-semibold"
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Divider - Same as Sidebar.tsx */}
            <div className="my-4 mx-4 border-t border-white/10" />

            {/* Quick Actions Section */}
            <div className="px-4 mb-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Quick Actions
              </span>
            </div>

            <ul className="space-y-1 px-2">
              {isSuperAdmin && (
              <li>
                <Link
                  href="/super-admin/dashboard"
                  onClick={handleNavClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-accent-primary hover:text-accent-primary hover:bg-accent-primary/10 group"
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-medium">Super Admin</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-accent-primary/20 text-accent-primary rounded-full font-semibold ml-auto">SA</span>
                </Link>
              </li>
              )}
              <li>
                <Link
                  href="/"
                  data-testid="admin-nav-back"
                  onClick={handleNavClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5 group"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="font-medium">Back to Casino</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Admin Banner */}
          <div className="p-4 border-t border-white/10">
            {isSuperAdmin ? (
              <div
                data-testid="admin-banner"
                className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/30 rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-2">🛡️</div>
                <p className="text-sm font-bold bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">God Mode</p>
                <p className="text-xs text-yellow-400/70 mt-1">Full system control</p>
                <Link
                  href="/admin/god-mode"
                  data-testid="admin-god-mode-link"
                  className="block w-full mt-3 px-4 py-2 border border-yellow-500/50 text-yellow-400 text-sm rounded-lg hover:bg-yellow-500/10 transition-colors text-center"
                >
                  Open Controls
                </Link>
              </div>
            ) : (
              <div
                data-testid="admin-banner"
                className="bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 border border-accent-primary/20 rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-2">⚙️</div>
                <p className="text-sm font-semibold text-accent-primary">Admin Panel</p>
                <p className="text-xs text-text-secondary mt-1">Manage your platform</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
