'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserStats {
  totalWager: number;
  totalProfit: number;
  totalBets: number;
  winRate: number;
  biggestWin: number;
  biggestMultiplier: number;
  gamesPlayed: {
    crash: number;
    dice: number;
    mines: number;
    plinko: number;
  };
}

const StatisticsModal: React.FC<StatisticsModalProps> = ({ isOpen, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchStats();
    }
  }, [isOpen, isAuthenticated]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000'}/users/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Use fallback data if API fails
        setStats({
          totalWager: 0,
          totalProfit: 0,
          totalBets: 0,
          winRate: 0,
          biggestWin: 0,
          biggestMultiplier: 0,
          gamesPlayed: {
            crash: 0,
            dice: 0,
            mines: 0,
            plinko: 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Use fallback data
      setStats({
        totalWager: 0,
        totalProfit: 0,
        totalBets: 0,
        winRate: 0,
        biggestWin: 0,
        biggestMultiplier: 0,
        gamesPlayed: {
          crash: 0,
          dice: 0,
          mines: 0,
          plinko: 0,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };


  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div data-testid="statistics-modal" className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-[#1475e1]/20 to-[#1475e1]/20">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              My Statistics
            </h2>
            <button
              data-testid="statistics-close"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isAuthenticated ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-white font-semibold mb-2">Login Required</h3>
              <p className="text-text-secondary text-sm">Please login to view your statistics</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Main Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Total Wager */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-sm mb-1">Total Wagered</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalWager)}</p>
                </div>

                {/* Total Profit */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-sm mb-1">Total Profit</p>
                  <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.totalProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalProfit)}
                  </p>
                </div>

                {/* Total Bets */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-sm mb-1">Total Bets</p>
                  <p className="text-2xl font-bold text-white">{stats.totalBets.toLocaleString()}</p>
                </div>

                {/* Win Rate */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-sm mb-1">Win Rate</p>
                  <p className="text-2xl font-bold text-accent-primary">{stats.winRate.toFixed(1)}%</p>
                </div>
              </div>

              {/* Highlights */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Highlights</h3>
                
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <p className="text-white font-medium">Biggest Win</p>
                      <p className="text-text-secondary text-sm">Single bet profit</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-yellow-400">{formatCurrency(stats.biggestWin)}</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#1475e1]/10 to-[#1475e1]/10 rounded-xl border border-[#1475e1]/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <p className="text-white font-medium">Highest Multiplier</p>
                      <p className="text-text-secondary text-sm">Best cashout</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-[#1475e1]">{stats.biggestMultiplier.toFixed(2)}x</p>
                </div>
              </div>

              {/* Games Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Games Played</h3>
                
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                    <span className="text-2xl">📈</span>
                    <p className="text-white font-bold mt-1">{stats.gamesPlayed.crash}</p>
                    <p className="text-text-secondary text-xs">Crash</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                    <span className="text-2xl">🎲</span>
                    <p className="text-white font-bold mt-1">{stats.gamesPlayed.dice}</p>
                    <p className="text-text-secondary text-xs">Dice</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                    <span className="text-2xl">💣</span>
                    <p className="text-white font-bold mt-1">{stats.gamesPlayed.mines}</p>
                    <p className="text-text-secondary text-xs">Mines</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center">
                    <span className="text-2xl">🔮</span>
                    <p className="text-white font-bold mt-1">{stats.gamesPlayed.plinko}</p>
                    <p className="text-text-secondary text-xs">Plinko</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatisticsModal;
