'use client';

import { useEffect, useState } from 'react';
import config from '@/config/api';

// Same dynamic game registry
const GAME_REGISTRY: Record<string, { icon: string; label: string; color: string }> = {
  CRASH:        { icon: '📈', label: 'Crash', color: '#F59E0B' },
  DICE:         { icon: '🎲', label: 'Dice', color: '#3B82F6' },
  MINES:        { icon: '💣', label: 'Mines', color: '#EF4444' },
  PLINKO:       { icon: '🔮', label: 'Plinko', color: '#8B5CF6' },
  OLYMPUS:      { icon: '⚡', label: 'Olympus', color: '#F97316' },
  DRAGON_BLAZE: { icon: '🐉', label: 'Dragon Blaze', color: '#DC2626' },
  NOVA_RUSH:    { icon: '🚀', label: 'Nova Rush', color: '#06B6D4' },
  LIMBO:        { icon: '🎯', label: 'Limbo', color: '#10B981' },
  KENO:         { icon: '🎰', label: 'Keno', color: '#EC4899' },
  WHEEL:        { icon: '🎡', label: 'Wheel', color: '#14B8A6' },
  BLACKJACK:    { icon: '🃏', label: 'Blackjack', color: '#1D4ED8' },
  ROULETTE:     { icon: '🎰', label: 'Roulette', color: '#B91C1C' },
  BACCARAT:     { icon: '🂡', label: 'Baccarat', color: '#7C3AED' },
};

function getGameInfo(key: string) {
  return GAME_REGISTRY[key] || { icon: '🎮', label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: '#9CA3AF' };
}

function formatCurrency(n: number): string {
  if (!n || isNaN(n)) return '$0.00';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatisticsModal({ isOpen, onClose }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) fetchStats();
  }, [isOpen]);

  async function fetchStats() {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`${config.apiUrl}/users/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const gb = stats?.gameBreakdown || {};
  const games = Object.entries(gb).sort((a: any, b: any) => b[1].bets - a[1].bets);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1d2e] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-accent-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <h2 className="text-xl font-bold text-white">Statistics</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-white text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-130px)] px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            </div>
          ) : stats ? (
            <>
              {/* Top Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-xs mb-1">Total Wagered</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(Number(stats.totalWager) || 0)}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-xs mb-1">Total Profit</p>
                  <p className={`text-xl font-bold ${(Number(stats.totalProfit) || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(Number(stats.totalProfit) || 0)}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-xs mb-1">Total Bets</p>
                  <p className="text-xl font-bold text-white">{(Number(stats.totalBets) || 0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-text-secondary text-xs mb-1">Win Rate</p>
                  <p className="text-xl font-bold text-accent-primary">{(Number(stats.winRate) || 0).toFixed(1)}%</p>
                </div>
              </div>

              {/* Highlights */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <p className="text-white font-medium">Biggest Win</p>
                      <p className="text-text-secondary text-xs">Single bet profit</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-yellow-400">{formatCurrency(Number(stats.biggestWin) || 0)}</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚀</span>
                    <div>
                      <p className="text-white font-medium">Highest Multiplier</p>
                      <p className="text-text-secondary text-xs">Best cashout</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-cyan-400">{Number(stats.biggestMultiplier || 0).toFixed(2)}x</p>
                </div>
              </div>

              {/* Dynamic Games Grid */}
              <div>
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Games Played</h3>
                <div className="grid grid-cols-3 gap-2">
                  {games.map(([name, data]: any) => {
                    const info = getGameInfo(name);
                    return (
                      <div key={name} className="p-3 bg-white/5 rounded-xl border border-white/10 text-center hover:bg-white/10 transition-colors">
                        <span className="text-2xl block">{info.icon}</span>
                        <p className="text-white font-bold mt-1">{data.bets}</p>
                        <p className="text-text-secondary text-xs">{info.label}</p>
                      </div>
                    );
                  })}
                  {games.length === 0 && (
                    <div className="col-span-3 text-center py-4 text-text-secondary text-sm">
                      No games played yet
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-text-secondary">Failed to load statistics</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5">
          <button onClick={onClose} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
