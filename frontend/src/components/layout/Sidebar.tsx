'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import VIPModal from '@/components/modals/VIPModal';
import WalletModal from '@/components/modals/WalletModal';
import StatisticsModal from '@/components/modals/StatisticsModal';
import SettingsModal from '@/components/modals/SettingsModal';
import ChatSidebar from '@/components/chat/ChatSidebar';

// Icons (using simple SVG placeholders - replace with your icon library)
const icons = {
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
};

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof icons;
  href: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/' },
  { id: 'crash', label: 'Crash', icon: 'crash', href: '/games/crash', badge: 'HOT' },
  { id: 'plinko', label: 'Plinko', icon: 'plinko', href: '/games/plinko', badge: 'NEW' },
  { id: 'dice', label: 'Dice', icon: 'dice', href: '/games/dice' },
  { id: 'mines', label: 'Mines', icon: 'mines', href: '/games/mines' },
];

const secondaryNavItems: NavItem[] = [
  { id: 'wallet', label: 'Wallet', icon: 'wallet', href: '/wallet' },
  { id: 'chat', label: 'Chat', icon: 'chat', href: '/chat' },
  { id: 'stats', label: 'Statistics', icon: 'stats', href: '/stats' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
];

interface SidebarProps {
  onClose?: () => void;
}

/**
 * Sidebar - Main navigation sidebar
 * Electric Cyberpunk theme with glowing accents
 */
const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = React.useState<'casino' | 'sports'>('casino');
  const [isVIPModalOpen, setIsVIPModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const handleNavClick = () => {
    // Close sidebar on mobile when navigating
    if (onClose) {
      onClose();
    }
  };
  
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
        {/* Close button - mobile only */}
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
            onClick={() => setActiveSection('casino')}
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
            onClick={() => setActiveSection('sports')}
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
      
      {/* Main Navigation */}
      <nav data-testid="main-nav" className="flex-1 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {/* Games Section */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Games
          </span>
        </div>
        
        <ul data-testid="nav-games-list" className="space-y-1 px-2">
          {mainNavItems.map((item) => {
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
                    <span data-testid={`badge-${item.id}`} className="px-2 py-0.5 text-[10px] bg-accent-primary/20 text-accent-primary rounded-full font-semibold">
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
        
        {/* Secondary Section */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Account
          </span>
        </div>
        
        <ul data-testid="nav-account-list" className="space-y-1 px-2">
          <li>
            <button
              data-testid="nav-wallet"
              onClick={() => setIsWalletModalOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5"
            >
              {icons.wallet}
              <span className="font-medium">Wallet</span>
            </button>
          </li>
          <li>
            <button
              data-testid="nav-chat"
              onClick={() => setIsChatOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5"
            >
              {icons.chat}
              <span className="font-medium">Chat</span>
            </button>
          </li>
          <li>
            <button
              data-testid="nav-stats"
              onClick={() => setIsStatsModalOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5"
            >
              {icons.stats}
              <span className="font-medium">Statistics</span>
            </button>
          </li>
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
          {/* Admin Link - Only visible to ADMIN users */}
          {user?.role === 'ADMIN' && (
            <>
              <li>
                <div className="my-2 mx-3 border-t border-white/10" />
              </li>
              <li>
                <Link
                  href="/admin/dashboard"
                  data-testid="nav-admin"
                  onClick={handleNavClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[#1475e1] hover:text-yellow-300 hover:bg-yellow-400/10 border border-[#1475e1]/20"
                >
                  {icons.admin}
                  <span className="font-medium">Admin Panel</span>
                  <span className="px-2 py-0.5 text-[10px] bg-yellow-400/20 text-[#1475e1] rounded-full font-semibold">ADMIN</span>
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
      
      {/* VIP Banner */}
      <div className="p-4 border-t border-white/10">
        <div data-testid="vip-banner" className="bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 border border-accent-primary/20 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">👑</div>
          <p className="text-sm font-semibold text-accent-primary">VIP Program</p>
          <p className="text-xs text-text-secondary mt-1">Unlock exclusive rewards</p>
          <button 
            data-testid="vip-learn-more"
            onClick={() => setIsVIPModalOpen(true)}
            className="w-full mt-3 px-4 py-2 border border-accent-primary/50 text-accent-primary text-sm rounded-lg hover:bg-accent-primary/10 transition-colors"
          >
            Learn More
          </button>
        </div>
      </div>
      
      {/* Modals */}
      <VIPModal isOpen={isVIPModalOpen} onClose={() => setIsVIPModalOpen(false)} />
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      <StatisticsModal isOpen={isStatsModalOpen} onClose={() => setIsStatsModalOpen(false)} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      <ChatSidebar isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </aside>
  );
};

export default Sidebar;
