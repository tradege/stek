'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useModal } from '@/contexts/ModalContext';
import { useProtectedNav } from '@/hooks/useProtectedNav';
import { useSoundContextSafe } from '@/contexts/SoundContext';

// Header Sound Toggle — connected to SoundContext (master)
function HeaderSoundToggle() {
  const { masterSoundEnabled, setMasterSound } = useSoundContextSafe();
  const isMuted = !masterSoundEnabled;

  return (
    <button
      onClick={() => setMasterSound(!masterSoundEnabled)}
      className={`p-2 rounded-lg transition-all ${
        isMuted
          ? 'bg-white/5 text-gray-500 hover:text-white'
          : 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
      }`}
      title={isMuted ? 'Unmute all sounds' : 'Mute all sounds'}
    >
      {isMuted ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )}
    </button>
  );
}

interface HeaderProps {
  onMenuClick?: () => void;
  onChatClick?: () => void;
  isMobile?: boolean;
}

// Format number to compact form (1.2k, 1.2M, etc.)
const formatCompact = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

// Role badge configuration
const roleBadgeConfig: Record<string, { text: string; color: string }> = {
  ADMIN: { text: '🛡️ ROOT', color: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border-yellow-500/30' },
  SUPER_MASTER: { text: 'SUPER', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  MASTER: { text: 'MASTER', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  AGENT: { text: 'AGENT', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  USER: { text: '', color: '' },
};

/**
 * Header - Top navigation bar
 * Uses ModalContext for Login/Register/Wallet modals (no page navigation needed)
 */
const Header: React.FC<HeaderProps> = ({ onMenuClick, onChatClick, isMobile }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const { openLogin, openRegister, openWallet } = useModal();
  const { handleProtectedNav } = useProtectedNav();
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Real-time stats
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [betsToday, setBetsToday] = useState<number>(0);
  const [totalVolume, setTotalVolume] = useState<number>(0);

  // Get primary balance (USDT)
  const primaryBalance = user?.balance?.find(b => b.currency === 'USDT');
  const balanceAmount = primaryBalance ? parseFloat(primaryBalance.available) : 0;

  // Listen for real-time stats from socket
  useEffect(() => {
    if (!socket) return;
    const handleOnlineUsers = (count: number) => setOnlineUsers(count);
    const handleGlobalStats = (stats: { onlineUsers?: number; betsToday?: number; totalVolume?: number }) => {
      if (stats.onlineUsers !== undefined) setOnlineUsers(stats.onlineUsers);
      if (stats.betsToday !== undefined) setBetsToday(stats.betsToday);
      if (stats.totalVolume !== undefined) setTotalVolume(stats.totalVolume);
    };
    socket.on('stats:online', handleOnlineUsers);
    socket.on('stats:global', handleGlobalStats);
    socket.emit('stats:request');
    return () => {
      socket.off('stats:online', handleOnlineUsers);
      socket.off('stats:global', handleGlobalStats);
    };
  }, [socket]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userRole = user?.role || 'USER';
  const roleBadge = roleBadgeConfig[userRole] || roleBadgeConfig.USER;
  const isSystemOwner = userRole === 'ADMIN' || userRole === 'SUPER_MASTER';

  return (
    <header data-testid="header" className="sticky top-0 z-30 bg-bg-card/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          {isMobile && onMenuClick && (
            <button
              onClick={onMenuClick}
              data-testid="mobile-menu-btn"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Search - Hidden on mobile */}
          <div className="relative hidden sm:block">
            <input
              type="text"
              placeholder="Search games..."
              data-testid="header-search"
              className="w-48 lg:w-64 bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-text-secondary focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Live Stats - Desktop only */}
          <div className="hidden xl:flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-text-secondary">Online:</span>
              <span className="text-white font-semibold tabular-nums">
                {onlineUsers > 0 ? formatCompact(onlineUsers) : '...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Bets Today:</span>
              <span className="text-white font-semibold tabular-nums">
                {betsToday > 0 ? formatCompact(betsToday) : '...'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isLoading ? (
            <div className="flex items-center gap-4">
              <div className="w-24 sm:w-32 h-10 bg-white/5 rounded-lg animate-pulse" />
              <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
            </div>
          ) : isAuthenticated && user ? (
            <>
              {/* Wallet Balance */}
              <div className="relative">
                <button
                  onClick={() => setIsWalletOpen(!isWalletOpen)}
                  data-testid="header-wallet-balance"
                  className="flex items-center gap-2 sm:gap-3 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:border-accent-primary/50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">
                    ₮
                  </div>
                  <span className="text-white font-semibold tabular-nums hidden sm:block">
                    {balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-text-secondary text-sm hidden sm:block">USDT</span>
                  <svg className={`w-4 h-4 text-text-secondary transition-transform ${isWalletOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isWalletOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-bg-card border border-white/10 rounded-lg shadow-xl py-2 z-50">
                    <button
                      onClick={() => { openWallet('deposit'); setIsWalletOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Deposit
                    </button>
                    <button
                      onClick={() => { openWallet('withdraw'); setIsWalletOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                      Withdraw
                    </button>
                  </div>
                )}
              </div>

              {/* Deposit Button */}
              <button
                onClick={() => openWallet('deposit')}
                data-testid="header-deposit"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-black font-semibold rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Deposit
              </button>

              {/* Sound Toggle */}
              <HeaderSoundToggle />

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  data-testid="header-notifications"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors relative"
                >
                  <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                {isNotificationsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-bg-card border border-white/10 rounded-lg shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-white/10">
                      <p className="text-white font-medium text-sm">Notifications</p>
                    </div>
                    <div className="p-4 text-center">
                      <svg className="w-8 h-8 text-text-secondary mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p className="text-text-secondary text-sm">No new notifications</p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  data-testid="user-menu"
                  className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold text-sm">
                    {user.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-white font-medium hidden sm:block max-w-24 truncate">
                    {user.username}
                  </span>
                  {roleBadge.text && (
                    <span className={`hidden sm:inline-block px-1.5 py-0.5 text-[9px] rounded border font-semibold ${roleBadge.color}`}>
                      {roleBadge.text}
                    </span>
                  )}
                </button>

                {/* User Dropdown */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-bg-card border border-white/10 rounded-lg shadow-xl py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white font-medium truncate">{user.username}</p>
                      <p className="text-text-secondary text-xs truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-semibold">
                          VIP {user.vipLevel || 0}
                        </span>
                        {roleBadge.text && (
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${roleBadge.color}`}>
                            {roleBadge.text}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {user.xp || 0} XP
                        </span>
                      </div>
                    </div>

                    {/* Profile Link */}
                    <button
                      onClick={() => { setIsUserMenuOpen(false); handleProtectedNav('/profile'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </button>

                    {/* My Bets / History */}
                    <button
                      onClick={() => { setIsUserMenuOpen(false); handleProtectedNav('/profile'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      My Bets &amp; History
                    </button>

                    {/* VIP */}
                    <Link
                      href="/vip"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      VIP Program
                    </Link>

                    {/* Affiliates / Network Overview */}
                    <Link
                      href="/affiliates"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {isSystemOwner ? 'Network Overview' : 'Affiliates'}
                    </Link>

                    {/* Admin Panel for management roles */}
                    {userRole !== 'USER' && (
                      <>
                        <div className="my-1 mx-3 border-t border-white/10" />
                        <Link
                          href="/admin/dashboard"
                          onClick={() => setIsUserMenuOpen(false)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-2 ${
                            userRole === 'ADMIN' ? 'text-red-400' :
                            userRole === 'SUPER_MASTER' ? 'text-purple-400' :
                            userRole === 'MASTER' ? 'text-orange-400' :
                            'text-blue-400'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {userRole === 'ADMIN' ? 'Admin Panel' :
                           userRole === 'SUPER_MASTER' ? 'Admin Panel' :
                           userRole === 'MASTER' ? 'Master Panel' :
                           'Agent Panel'}
                        </Link>
                      </>
                    )}

                    {/* Divider + Logout */}
                    <div className="my-1 mx-3 border-t border-white/10" />
                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Chat Button */}
              {isMobile && onChatClick && (
                <button
                  onClick={onChatClick}
                  data-testid="mobile-chat-btn"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors relative lg:hidden"
                >
                  <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full" />
                </button>
              )}
            </>
          ) : (
            // Not authenticated - use modal openers instead of page links
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={openLogin}
                data-testid="header-login"
                className="px-4 py-2 text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
              >
                Login
              </button>
              <button
                onClick={openRegister}
                data-testid="header-register"
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-black font-semibold rounded-lg transition-colors text-sm"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;