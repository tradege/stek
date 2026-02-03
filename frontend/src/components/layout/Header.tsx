'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Header - Top navigation bar
 * Contains: Search, Wallet Balance, Notifications, User Menu
 */
const Header: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Get primary balance (USDT)
  const primaryBalance = user?.balance?.find(b => b.currency === 'USDT');
  const balanceAmount = primaryBalance ? parseFloat(primaryBalance.available) : 0;

  return (
    <header className="header">
      {/* Left Section - Search */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search games..."
            className="input w-64 pl-10 py-2 text-sm"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
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
        
        {/* Live Stats */}
        <div className="hidden lg:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-primary animate-pulse" />
            <span className="text-text-secondary">Online:</span>
            <span className="text-text-primary font-semibold tabular-nums">12,847</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Bets Today:</span>
            <span className="text-text-primary font-semibold tabular-nums">1.2M</span>
          </div>
        </div>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          // Loading state
          <div className="flex items-center gap-4">
            <div className="w-32 h-10 bg-card-hover rounded-lg animate-pulse" />
            <div className="w-10 h-10 bg-card-hover rounded-lg animate-pulse" />
          </div>
        ) : isAuthenticated && user ? (
          // Authenticated user
          <>
            {/* Wallet Balance */}
            <div className="relative">
              <button
                onClick={() => setIsWalletOpen(!isWalletOpen)}
                className="wallet-balance hover:border-accent-primary/50 transition-colors"
              >
                <div className="crypto-usdt">₮</div>
                <div className="flex flex-col items-end">
                  <span className="wallet-amount">
                    {balanceAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs text-text-secondary">USDT</span>
                </div>
                <svg
                  className={`w-4 h-4 text-text-secondary transition-transform ${
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
                <div className="absolute right-0 top-full mt-2 w-72 card p-4 z-dropdown animate-slide-down">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Wallet</h3>
                    <Link href="/wallet" className="text-accent-primary text-sm hover:underline">
                      View All
                    </Link>
                  </div>
                  
                  {/* Balance List */}
                  <div className="space-y-3">
                    {user.balance?.map((bal) => (
                      <div key={bal.currency} className="flex items-center justify-between p-2 hover:bg-card-hover rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="crypto-usdt">₮</div>
                          <div>
                            <p className="text-sm font-medium">{bal.currency}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono tabular-nums">
                            {parseFloat(bal.available).toFixed(2)}
                          </p>
                          {parseFloat(bal.locked) > 0 && (
                            <p className="text-xs text-text-tertiary">
                              Locked: {parseFloat(bal.locked).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-card-border">
                    <button className="btn-primary flex-1 py-2 text-sm">Deposit</button>
                    <button className="btn-ghost flex-1 py-2 text-sm">Withdraw</button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Deposit Button */}
            <button className="btn-primary py-2 px-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Deposit</span>
            </button>
            
            {/* Notifications */}
            <button className="relative p-2 text-text-secondary hover:text-text-primary transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger-primary rounded-full" />
            </button>
            
            {/* User Menu */}
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 p-2 hover:bg-card-hover rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-glow-cyan-sm">
                  <span className="text-sm font-bold text-text-inverse">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium">{user.displayName || user.username}</p>
                  <p className="text-xs text-text-secondary capitalize">{user.role.toLowerCase()}</p>
                </div>
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 card p-2 z-dropdown animate-slide-down">
                  <Link href="/profile" className="block px-3 py-2 text-sm hover:bg-card-hover rounded-lg">
                    Profile
                  </Link>
                  <Link href="/settings" className="block px-3 py-2 text-sm hover:bg-card-hover rounded-lg">
                    Settings
                  </Link>
                  <Link href="/transactions" className="block px-3 py-2 text-sm hover:bg-card-hover rounded-lg">
                    Transactions
                  </Link>
                  <div className="border-t border-card-border my-2" />
                  <button 
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-sm text-danger-primary hover:bg-card-hover rounded-lg"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          // Not authenticated
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost py-2 px-4">
              Sign In
            </Link>
            <Link href="/register" className="btn-primary py-2 px-4">
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
