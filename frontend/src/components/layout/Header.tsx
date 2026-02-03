import React, { useState } from 'react';

/**
 * Header - Top navigation bar
 * Contains: Search, Wallet Balance, Notifications, User Menu
 */
const Header: React.FC = () => {
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  
  // Mock data - would come from context/state in real app
  const walletBalance = {
    total: 12543.87,
    currency: 'USDT',
    change: '+2.4%',
  };
  
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
      
      {/* Right Section - Wallet & User */}
      <div className="flex items-center gap-4">
        {/* Wallet Balance */}
        <div className="relative">
          <button
            onClick={() => setIsWalletOpen(!isWalletOpen)}
            className="wallet-balance hover:border-accent-primary/50 transition-colors"
          >
            {/* Crypto Icon */}
            <div className="crypto-usdt">₮</div>
            
            {/* Balance */}
            <div className="flex flex-col items-end">
              <span className="wallet-amount">
                {walletBalance.total.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-success-primary">{walletBalance.change}</span>
            </div>
            
            {/* Dropdown Arrow */}
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
                <button className="text-accent-primary text-sm hover:underline">
                  View All
                </button>
              </div>
              
              {/* Currency List */}
              <div className="space-y-3">
                <WalletRow icon="₿" name="Bitcoin" symbol="BTC" balance={0.0234} usd={1523.45} color="btc" />
                <WalletRow icon="Ξ" name="Ethereum" symbol="ETH" balance={1.234} usd={3421.87} color="eth" />
                <WalletRow icon="₮" name="Tether" symbol="USDT" balance={12543.87} usd={12543.87} color="usdt" />
                <WalletRow icon="◎" name="Solana" symbol="SOL" balance={45.67} usd={4567.00} color="sol" />
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
          {/* Notification Badge */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger-primary rounded-full" />
        </button>
        
        {/* User Avatar */}
        <button className="flex items-center gap-3 p-2 hover:bg-card-hover rounded-lg transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-glow-cyan-sm">
            <span className="text-sm font-bold text-text-inverse">JD</span>
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-sm font-medium">John Doe</p>
            <p className="text-xs text-text-secondary">VIP Gold</p>
          </div>
        </button>
      </div>
    </header>
  );
};

// Wallet Row Component
interface WalletRowProps {
  icon: string;
  name: string;
  symbol: string;
  balance: number;
  usd: number;
  color: 'btc' | 'eth' | 'usdt' | 'sol';
}

const WalletRow: React.FC<WalletRowProps> = ({ icon, name, symbol, balance, usd, color }) => {
  const colorClasses = {
    btc: 'crypto-btc',
    eth: 'crypto-eth',
    usdt: 'crypto-usdt',
    sol: 'crypto-sol',
  };
  
  return (
    <div className="flex items-center justify-between p-2 hover:bg-card-hover rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className={colorClasses[color]}>{icon}</div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-text-secondary">{symbol}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono tabular-nums">{balance.toFixed(4)}</p>
        <p className="text-xs text-text-secondary">${usd.toLocaleString()}</p>
      </div>
    </div>
  );
};

export default Header;
