'use client';

import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import config from '@/config/api';

// ============================================================
// DYNAMIC GAME REGISTRY - Add new games here and they appear everywhere
// ============================================================
const GAME_REGISTRY: Record<string, { icon: string; emoji: string; color: string; gradient: string; label: string }> = {
  CRASH:        { icon: '📈', emoji: '📈', color: '#F59E0B', gradient: 'from-yellow-500/20 to-orange-500/20', label: 'Crash' },
  DICE:         { icon: '🎲', emoji: '🎲', color: '#3B82F6', gradient: 'from-blue-500/20 to-indigo-500/20', label: 'Dice' },
  MINES:        { icon: '💣', emoji: '💣', color: '#EF4444', gradient: 'from-red-500/20 to-pink-500/20', label: 'Mines' },
  PLINKO:       { icon: '🔮', emoji: '🔮', color: '#8B5CF6', gradient: 'from-purple-500/20 to-violet-500/20', label: 'Plinko' },
  OLYMPUS:      { icon: '⚡', emoji: '⚡', color: '#F97316', gradient: 'from-orange-500/20 to-amber-500/20', label: 'Olympus' },
  DRAGON_BLAZE: { icon: '🐉', emoji: '🐉', color: '#DC2626', gradient: 'from-red-600/20 to-orange-600/20', label: 'Dragon Blaze' },
  NOVA_RUSH:    { icon: '🚀', emoji: '🚀', color: '#06B6D4', gradient: 'from-cyan-500/20 to-blue-500/20', label: 'Nova Rush' },
  LIMBO:        { icon: '🎯', emoji: '🎯', color: '#10B981', gradient: 'from-emerald-500/20 to-green-500/20', label: 'Limbo' },
  KENO:         { icon: '🎰', emoji: '🎰', color: '#EC4899', gradient: 'from-pink-500/20 to-rose-500/20', label: 'Keno' },
  WHEEL:        { icon: '🎡', emoji: '🎡', color: '#14B8A6', gradient: 'from-teal-500/20 to-emerald-500/20', label: 'Wheel' },
  BLACKJACK:    { icon: '🃏', emoji: '🃏', color: '#1D4ED8', gradient: 'from-blue-700/20 to-blue-500/20', label: 'Blackjack' },
  CARD_RUSH:    { icon: '🃏', emoji: '🃏', color: '#F59E0B', gradient: 'from-yellow-500/20 to-orange-500/20', label: 'Card Rush' },
  PENALTY_SHOOTOUT: { icon: '⚽', emoji: '⚽', color: '#22C55E', gradient: 'from-green-500/20 to-emerald-500/20', label: 'Penalty Shootout' },
  ROULETTE:     { icon: '🎰', emoji: '🎰', color: '#B91C1C', gradient: 'from-red-700/20 to-red-500/20', label: 'Roulette' },
  BACCARAT:     { icon: '🂡', emoji: '🂡', color: '#7C3AED', gradient: 'from-violet-600/20 to-purple-500/20', label: 'Baccarat' },
  EXTERNAL:     { icon: '🎮', emoji: '🎮', color: '#6B7280', gradient: 'from-gray-500/20 to-gray-600/20', label: 'External' },
};

// Fallback for any unknown game type
const DEFAULT_GAME_INFO = { icon: '🎮', emoji: '🎮', color: '#9CA3AF', gradient: 'from-gray-500/20 to-gray-600/20', label: 'Unknown' };

function getGameInfo(gameType: string) {
  return GAME_REGISTRY[gameType] || { ...DEFAULT_GAME_INFO, label: gameType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
}

interface GameBreakdown {
  bets: number;
  wagered: number;
  won: number;
}

interface StatsData {
  totalWager: number;
  totalWin: number;
  totalProfit: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  winRate: number;
  biggestWin: number;
  biggestMultiplier: number;
  gameBreakdown: Record<string, GameBreakdown>;
}

function formatCurrency(n: number): string {
  if (n === undefined || n === null || isNaN(n)) return '$0.00';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'history'>('overview');

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const res = await fetch(`${config.apiUrl}/users/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats({
        totalWager: Number(data.totalWager) || 0,
        totalWin: Number(data.totalWin) || 0,
        totalProfit: Number(data.totalProfit) || 0,
        totalBets: Number(data.totalBets) || 0,
        wonBets: Number(data.wonBets) || 0,
        lostBets: Number(data.lostBets) || 0,
        winRate: Number(data.winRate) || 0,
        biggestWin: Number(data.biggestWin) || 0,
        biggestMultiplier: Number(data.biggestMultiplier) || 0,
        gameBreakdown: data.gameBreakdown || {},
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Get sorted games from breakdown (dynamic - any game that has bets will show)
  const games = stats ? Object.entries(stats.gameBreakdown).sort((a, b) => b[1].bets - a[1].bets) : [];
  const totalGameBets = games.reduce((sum, [, d]) => sum + d.bets, 0);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'games' as const, label: 'Games', icon: '🎮' },
    { id: 'history' as const, label: 'History', icon: '📋' },
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-primary/30 to-accent-primary/10 flex items-center justify-center text-3xl">
            📊
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Statistics</h1>
            <p className="text-text-secondary">Your complete gaming performance overview</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/25'
                  : 'text-text-secondary hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400 text-lg">{error}</p>
            <button onClick={fetchStats} className="mt-4 px-6 py-2 bg-accent-primary rounded-lg text-white">Retry</button>
          </div>
        ) : stats ? (
          <>
            {/* ============ OVERVIEW TAB ============ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Top Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/10">
                    <p className="text-text-secondary text-sm mb-2">Total Wagered</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalWager)}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/10">
                    <p className="text-text-secondary text-sm mb-2">Total Profit</p>
                    <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stats.totalProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalProfit)}
                    </p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/10">
                    <p className="text-text-secondary text-sm mb-2">Total Bets</p>
                    <p className="text-2xl font-bold text-white">{stats.totalBets.toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/10">
                    <p className="text-text-secondary text-sm mb-2">Win Rate</p>
                    <p className="text-2xl font-bold text-accent-primary">{stats.winRate.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Win/Loss Bar */}
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex justify-between mb-3">
                    <span className="text-green-400 font-medium">Wins: {stats.wonBets}</span>
                    <span className="text-red-400 font-medium">Losses: {stats.lostBets}</span>
                  </div>
                  <div className="h-4 bg-red-500/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000"
                      style={{ width: `${stats.totalBets > 0 ? (stats.wonBets / stats.totalBets) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-2xl border border-yellow-500/20">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">🏆</span>
                      <div>
                        <p className="text-white font-semibold text-lg">Biggest Win</p>
                        <p className="text-text-secondary text-sm">Single bet profit</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400">{formatCurrency(stats.biggestWin)}</p>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">🚀</span>
                      <div>
                        <p className="text-white font-semibold text-lg">Highest Multiplier</p>
                        <p className="text-text-secondary text-sm">Best cashout</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-cyan-400">{Number(stats.biggestMultiplier).toFixed(2)}x</p>
                  </div>
                </div>

                {/* Dynamic Games Played Grid */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Games Played</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {games.map(([name, data]) => {
                      const info = getGameInfo(name);
                      return (
                        <div key={name} className={`p-4 bg-gradient-to-br ${info.gradient} rounded-xl border border-white/10 text-center hover:scale-105 transition-transform`}>
                          <span className="text-3xl block mb-2">{info.emoji}</span>
                          <p className="text-white font-bold text-xl">{data.bets.toLocaleString()}</p>
                          <p className="text-text-secondary text-sm">{info.label}</p>
                          <p className="text-xs mt-1" style={{ color: info.color }}>
                            {data.bets > 0 ? ((data.won / data.bets) * 100).toFixed(0) : 0}% win
                          </p>
                        </div>
                      );
                    })}
                    {games.length === 0 && (
                      <div className="col-span-full text-center py-8 text-text-secondary">
                        No games played yet. Start playing to see your stats!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============ GAMES TAB ============ */}
            {activeTab === 'games' && (
              <div className="space-y-4">
                {games.length === 0 ? (
                  <div className="text-center py-20 text-text-secondary">
                    <span className="text-5xl block mb-4">🎮</span>
                    <p className="text-lg">No games played yet</p>
                  </div>
                ) : (
                  games.map(([name, data]) => {
                    const info = getGameInfo(name);
                    const winRate = data.bets > 0 ? ((data.won / data.bets) * 100) : 0;
                    const sharePercent = totalGameBets > 0 ? ((data.bets / totalGameBets) * 100) : 0;
                    return (
                      <div key={name} className={`bg-gradient-to-r ${info.gradient} border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <span className="text-4xl">{info.emoji}</span>
                            <div>
                              <h3 className="text-xl font-bold text-white">{info.label}</h3>
                              <p className="text-text-secondary text-sm">{sharePercent.toFixed(1)}% of total bets</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-white">{data.bets.toLocaleString()}</p>
                            <p className="text-text-secondary text-sm">total bets</p>
                          </div>
                        </div>
                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-black/20 rounded-xl p-3 text-center">
                            <p className="text-text-secondary text-xs mb-1">Wagered</p>
                            <p className="text-white font-bold">{formatCurrency(data.wagered)}</p>
                          </div>
                          <div className="bg-black/20 rounded-xl p-3 text-center">
                            <p className="text-text-secondary text-xs mb-1">Wins</p>
                            <p className="text-green-400 font-bold">{data.won}</p>
                          </div>
                          <div className="bg-black/20 rounded-xl p-3 text-center">
                            <p className="text-text-secondary text-xs mb-1">Win Rate</p>
                            <p className="font-bold" style={{ color: info.color }}>{winRate.toFixed(1)}%</p>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${winRate}%`, backgroundColor: info.color }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ============ HISTORY TAB ============ */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Summary Table */}
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                  <div className="p-5 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">Overall Summary</h3>
                  </div>
                  <table className="w-full text-left">
                    <tbody>
                      {[
                        { label: 'Total Wagered', value: formatCurrency(stats.totalWager), color: 'text-white' },
                        { label: 'Total Won', value: formatCurrency(stats.totalWin), color: 'text-green-400' },
                        { label: 'Net Profit/Loss', value: `${stats.totalProfit >= 0 ? '+' : ''}${formatCurrency(stats.totalProfit)}`, color: stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
                        { label: 'Total Bets', value: stats.totalBets.toLocaleString(), color: 'text-white' },
                        { label: 'Won Bets', value: stats.wonBets.toLocaleString(), color: 'text-green-400' },
                        { label: 'Lost Bets', value: stats.lostBets.toLocaleString(), color: 'text-red-400' },
                        { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: 'text-accent-primary' },
                        { label: 'Biggest Win', value: formatCurrency(stats.biggestWin), color: 'text-yellow-400' },
                        { label: 'Highest Multiplier', value: `${Number(stats.biggestMultiplier).toFixed(2)}x`, color: 'text-cyan-400' },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 px-5 text-text-secondary">{row.label}</td>
                          <td className={`py-3 px-5 text-right font-mono font-bold ${row.color}`}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Per-Game Breakdown Table */}
                {games.length > 0 && (
                  <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                      <h3 className="text-lg font-bold text-white">Per-Game Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5">
                            <th className="py-3 px-5 text-text-secondary text-sm font-semibold">Game</th>
                            <th className="py-3 px-5 text-text-secondary text-sm font-semibold text-right">Bets</th>
                            <th className="py-3 px-5 text-text-secondary text-sm font-semibold text-right">Wagered</th>
                            <th className="py-3 px-5 text-text-secondary text-sm font-semibold text-right">Wins</th>
                            <th className="py-3 px-5 text-text-secondary text-sm font-semibold text-right">Win Rate</th>
                            <th className="py-3 px-5 text-text-secondary text-sm font-semibold text-right">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {games.map(([name, data]) => {
                            const info = getGameInfo(name);
                            const wr = data.bets > 0 ? ((data.won / data.bets) * 100).toFixed(1) : '0.0';
                            const share = totalGameBets > 0 ? ((data.bets / totalGameBets) * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={name} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-5 text-white font-medium">
                                  <span className="mr-2">{info.emoji}</span>{info.label}
                                </td>
                                <td className="py-3 px-5 text-white text-right font-mono">{data.bets.toLocaleString()}</td>
                                <td className="py-3 px-5 text-white text-right font-mono">{formatCurrency(data.wagered)}</td>
                                <td className="py-3 px-5 text-green-400 text-right font-mono">{data.won}</td>
                                <td className="py-3 px-5 text-right font-mono" style={{ color: info.color }}>{wr}%</td>
                                <td className="py-3 px-5 text-text-secondary text-right font-mono">{share}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
