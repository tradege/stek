'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import WalletModal from '@/components/wallet/WalletModal';
import { SoundToggleButton } from '@/hooks/useGameSounds';

interface HeaderProps {
  onMenuClick?: () => void;
  onChatClick?: () => void;
  isMobile?: boolean;
}

/**
 * Header - Top navigation bar
 * Contains: Menu (mobile), Search, Wallet Balance, Sound, Notifications, User Menu, Chat (mobile)
 */
const Header: React.FC<HeaderProps> = ({ onMenuClick, onChatClick, isMobile }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Get primary balance (USDT)
  const primaryBalance = user?.balance?.find(b => b.currency === 'USDT');
  const balanceAmount = primaryBalance ? parseFloat(primaryBalance.available) : 0;

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg-card/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            {isMobile && onMenuClick && (
              <button
                onClick={onMenuClick}
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
                className="w-48 lg:w-64 bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-text-secondary focus:outline-none focus:border-accent-primary/50 transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            
            {/* Live Stats - Desktop only */}
            <div className="hidden xl:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-text-secondary">Online:</span>
                <span className="text-white font-semibold tabular-nums">12,847</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Bets Today:</span>
                <span className="text-white font-semibold tabular-nums">1.2M</span>
              </div>
            </div>
          </div>
          
          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-4">
            {isLoading ? (
              // Loading state
              <div className="flex items-center gap-4">
                <div className="w-24 sm:w-32 h-10 bg-white/5 rounded-lg animate-pulse" />
                <div className="w-10 h-10 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : isAuthenticated && user ? (
              // Authenticated user
              <>
                {/* Wallet Balance */}
                <div className="relative">
                  <button
                    onClick={() => setIsWalletOpen(!isWalletOpen)}
                    className="flex items-center gap-2 sm:gap-3 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:border-accent-primary/50 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">
                      ₮
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-mono tabular-nums text-white">
                        {balanceAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-[10px] text-text-secondary hidden sm:block">USDT</span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-text-secondary transition-transform hidden sm:block ${
                        isWalletOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {/* Wallet Dropdown */}
                  {isWalletOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-bg-card border border-white/10 rounded-xl p-4 z-50 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-white">Wallet</h3>
                        <Link href="/wallet" className="text-accent-primary text-sm hover:underline">
                          View All
                        </Link>
                      </div>
                      
                      {/* Balance List */}
                      <div className="space-y-2">
                        {user.balance?.map((bal) => (
                          <div key={bal.currency} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">
                                ₮
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{bal.currency}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono tabular-nums text-white">
                                {parseFloat(bal.available).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              {parseFloat(bal.locked) > 0 && (
                                <p className="text-xs text-text-secondary">
                                  Locked: {parseFloat(bal.locked).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                        <button 
                          onClick={() => { setIsWalletOpen(false); setIsWalletModalOpen(true); }}
                          className="flex-1 py-2 px-4 bg-accent-primary text-black font-medium rounded-lg hover:bg-accent-primary/90 transition-colors text-sm"
                        >
                          Deposit
                        </button>
                        <button 
                          onClick={() => { setIsWalletOpen(false); setIsWalletModalOpen(true); }}
                          className="flex-1 py-2 px-4 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors text-sm"
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Deposit Button - Desktop */}
                <button 
                  onClick={() => setIsWalletModalOpen(true)}
                  className="hidden sm:flex items-center gap-2 py-2 px-4 bg-accent-primary text-black font-medium rounded-lg hover:bg-accent-primary/90 transition-colors shadow-glow-cyan-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Deposit</span>
                </button>

                {/* Sound Toggle */}
                <SoundToggleButton />
                
                {/* Notifications */}
                <button className="relative p-2 text-text-secondary hover:text-white transition-colors hidden sm:block">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>

                {/* Chat Button - Mobile */}
                {isMobile && onChatClick && (
                  <button
                    onClick={onChatClick}
                    className="p-2 text-text-secondary hover:text-white transition-colors lg:hidden"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                )}
                
                {/* User Menu */}
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-cyan-600 flex items-center justify-center shadow-glow-cyan-sm">
                      <span className="text-sm font-bold text-black">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="hidden lg:block text-left">
                      <p className="text-sm font-medium text-white">{user.displayName || user.username}</p>
                      <p className="text-xs text-text-secondary capitalize">{user.role.toLowerCase()}</p>
                    </div>
                  </button>

                  {/* User Dropdown */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-bg-card border border-white/10 rounded-xl p-2 z-50 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <Link href="/profile" className="block px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg">
                        Profile
                      </Link>
                      <Link href="/settings" className="block px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg">
                        Settings
                      </Link>
                      <Link href="/transactions" className="block px-3 py-2 text-sm text-white hover:bg-white/5 rounded-lg">
                        Transactions
                      </Link>
                      {/* Admin Link */}
                      {user.role === 'ADMIN' && (
                        <>
                          <div className="border-t border-white/10 my-2" />
                          <Link href="/admin/transactions" className="block px-3 py-2 text-sm text-accent-primary hover:bg-white/5 rounded-lg">
                            🛡️ Admin Panel
                          </Link>
                        </>
                      )}
                      <div className="border-t border-white/10 my-2" />
                      <button 
                        onClick={logout}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/5 rounded-lg"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Not authenticated
              <div className="flex items-center gap-2 sm:gap-3">
                <Link href="/login" className="py-2 px-3 sm:px-4 text-white hover:bg-white/5 rounded-lg transition-colors text-sm">
                  Sign In
                </Link>
                <Link href="/register" className="py-2 px-3 sm:px-4 bg-accent-primary text-black font-medium rounded-lg hover:bg-accent-primary/90 transition-colors text-sm shadow-glow-cyan-sm">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </>
  );
};

export default Header;
