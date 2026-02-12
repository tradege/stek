'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import config from '@/config/api';
import AuthGuard from '@/components/ui/AuthGuard';

const API_URL = config.apiUrl;

interface UserStats {
  totalBets: number;
  totalWagered: string;
  totalWon: string;
  totalLost: string;
  winRate: string;
  favoriteGame: string;
}

interface BetHistory {
  id: string;
  game: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: 'win' | 'loss';
  createdAt: string;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'activity' | 'bets'>('overview');
  const [betHistory, setBetHistory] = useState<BetHistory[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);

  // Auth handled by AuthGuard wrapper

  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        try {
          const token = localStorage.getItem('auth_token');
          const res = await fetch(`${API_URL}/users/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setStats(data);
          }
        } catch (e) {
          setStats({
            totalBets: 0,
            totalWagered: '0.00',
            totalWon: '0.00',
            totalLost: '0.00',
            winRate: '0.00',
            favoriteGame: 'Crash',
          });
        }
      };
      fetchStats();
    }
  }, [user]);

  // Fetch bet history when bets tab is active
  useEffect(() => {
    if (activeTab === 'bets' && user) {
      const fetchBets = async () => {
        setBetsLoading(true);
        try {
          const token = localStorage.getItem('auth_token');
          const res = await fetch(`${API_URL}/users/bets?limit=50`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setBetHistory((data.bets || data || []).map((b: any) => ({
              id: b.id,
              game: b.gameType || b.game || "Unknown",
              amount: Number(b.betAmount || b.amount || 0),
              multiplier: Number(b.multiplier || 0),
              payout: Number(b.payout || 0),
              result: b.isWin ? "win" : "loss",
              createdAt: b.createdAt,
            })));
          }
        } catch (e) {
          // Fallback mock data
          setBetHistory([]);
        } finally {
          setBetsLoading(false);
        }
      };
      fetchBets();
    }
  }, [activeTab, user]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
        </div>
      </MainLayout>
    );
  }

  const vipLevels = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'];
  const vipColors = ['text-amber-600', 'text-gray-400', 'text-yellow-400', 'text-cyan-400', 'text-purple-400', 'text-red-400'];
  const vipGradients = ['from-amber-700 to-amber-900', 'from-gray-400 to-gray-600', 'from-yellow-400 to-yellow-600', 'from-cyan-400 to-cyan-600', 'from-purple-400 to-purple-600', 'from-red-400 to-red-600'];
  const currentVipLevel = user?.vipLevel || 0;
  const vipName = vipLevels[Math.min(currentVipLevel, vipLevels.length - 1)] || 'Bronze';
  const vipColor = vipColors[Math.min(currentVipLevel, vipColors.length - 1)];
  const isSystemOwner = user?.role === 'ADMIN' || user?.role === 'SUPER_MASTER';

  // Calculate P&L
  const totalWon = parseFloat(stats?.totalWon || '0');
  const totalLost = parseFloat(stats?.totalLost || '0');
  const pnl = totalWon - totalLost;

  // Wallet balances from user object
  const balances = Array.isArray(user?.balance) ? user.balance : [];

  return (
    <AuthGuard>
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6" data-testid="profile-page">
        {/* Profile Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${vipGradients[Math.min(currentVipLevel, vipGradients.length - 1)]} flex items-center justify-center shadow-lg`}>
                <span className="text-4xl font-bold text-white">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className={`absolute -bottom-2 -right-2 ${isSystemOwner ? 'bg-gradient-to-r from-yellow-500 to-amber-600' : `bg-gradient-to-r ${vipGradients[Math.min(currentVipLevel, vipGradients.length - 1)]}`} text-white text-xs font-bold px-2 py-1 rounded-lg`}>
                {isSystemOwner ? '🛡️ ROOT' : vipName}
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">{user?.username || 'Player'}</h1>
              <p className="text-text-secondary mt-1">{user?.email || ''}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {isSystemOwner ? (
                  <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-bold border border-yellow-500/30">
                    🛡️ SYSTEM OWNER
                  </span>
                ) : (
                  <span className={`px-3 py-1 bg-accent-primary/10 ${vipColor} rounded-lg text-sm font-medium border border-accent-primary/20`}>
                    VIP Level {currentVipLevel}
                  </span>
                )}
                <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium border border-green-500/20">
                  Active
                </span>
                <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-lg text-sm font-medium border border-white/10">
                  Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              {isSystemOwner ? (
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-xl font-semibold hover:from-yellow-400 hover:to-amber-500 transition-all text-sm"
                >
                  🛡️ Admin Panel
                </button>
              ) : (
                <button
                  onClick={() => router.push('/vip')}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-400 hover:to-orange-400 transition-all text-sm"
                >
                  VIP Program
                </button>
              )}
              <button
                onClick={() => router.push('/responsible-gaming')}
                className="px-4 py-2 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all text-sm border border-white/20"
              >
                Limits
              </button>
            </div>
          </div>
        </div>

        {/* Wallet Balances */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            Wallet
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {balances.length > 0 ? balances.map((bal: any, i: number) => (
              <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-text-secondary text-xs uppercase">{bal.currency || 'USD'}</p>
                <p className="text-xl font-bold text-white font-mono mt-1">
                  ${parseFloat(bal.available || bal.amount || '0').toFixed(2)}
                </p>
              </div>
            )) : (
              <div className="col-span-full bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-text-secondary text-sm">No balances available</p>
              </div>
            )}
            {/* P&L Card */}
            <div className={`bg-white/5 rounded-xl p-4 border ${pnl >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
              <p className="text-text-secondary text-xs uppercase">Net P&L</p>
              <p className={`text-xl font-bold font-mono mt-1 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-card border border-white/10 rounded-xl p-1 overflow-x-auto">
          {(['overview', 'bets', 'security', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all capitalize whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'bets' ? 'Bet History' : tab === 'security' ? 'Security' : 'Activity'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Bets</p>
              <p className="text-2xl font-bold text-white font-mono">{stats?.totalBets?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Wagered</p>
              <p className="text-2xl font-bold text-accent-primary font-mono">${stats?.totalWagered || '0.00'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Won</p>
              <p className="text-2xl font-bold text-green-400 font-mono">${stats?.totalWon || '0.00'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Lost</p>
              <p className="text-2xl font-bold text-red-400 font-mono">${stats?.totalLost || '0.00'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-white">{stats?.winRate || '0'}%</p>
              <div className="w-full bg-white/5 rounded-full h-2 mt-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(parseFloat(stats?.winRate || '0'), 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Favorite Game</p>
              <p className="text-2xl font-bold text-white">{stats?.favoriteGame || 'N/A'}</p>
            </div>

            {/* VIP Progress / System Owner Card */}
            {isSystemOwner ? (
              <div className="col-span-full bg-gradient-to-br from-yellow-500/5 to-amber-500/5 border border-yellow-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">🛡️ System Owner</h3>
                  <span className="text-yellow-400 font-bold bg-yellow-500/10 px-3 py-1 rounded-lg border border-yellow-500/30">👑 ROOT ADMIN</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <p className="text-yellow-400 text-2xl mb-1">🛡️</p>
                    <p className="text-white font-semibold">Full Access</p>
                    <p className="text-text-secondary text-xs mt-1">All platform controls</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <p className="text-yellow-400 text-2xl mb-1">📊</p>
                    <p className="text-white font-semibold">Analytics</p>
                    <p className="text-text-secondary text-xs mt-1">Real-time monitoring</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                    <p className="text-yellow-400 text-2xl mb-1">⚙️</p>
                    <p className="text-white font-semibold">Management</p>
                    <p className="text-text-secondary text-xs mt-1">Users & system config</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="col-span-full bg-bg-card border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">VIP Progress</h3>
                  <span className={`${vipColor} font-semibold`}>Level {currentVipLevel} - {vipName}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-3">
                  <div
                    className={`bg-gradient-to-r ${vipGradients[Math.min(currentVipLevel, vipGradients.length - 1)]} h-3 rounded-full transition-all`}
                    style={{ width: `${Math.min(((currentVipLevel + 1) / 6) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-text-secondary">
                  {vipLevels.map((level, i) => (
                    <span key={level} className={i <= currentVipLevel ? vipColors[i] : 'text-text-secondary'}>
                      {level}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bets' && (
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Bet History</h3>
            {betsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
              </div>
            ) : betHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-text-secondary text-xs font-medium py-3 px-2">Game</th>
                      <th className="text-right text-text-secondary text-xs font-medium py-3 px-2">Bet</th>
                      <th className="text-right text-text-secondary text-xs font-medium py-3 px-2">Multi</th>
                      <th className="text-right text-text-secondary text-xs font-medium py-3 px-2">Payout</th>
                      <th className="text-right text-text-secondary text-xs font-medium py-3 px-2">Result</th>
                      <th className="text-right text-text-secondary text-xs font-medium py-3 px-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {betHistory.map((bet) => (
                      <tr key={bet.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2 text-white text-sm font-medium">{bet.game}</td>
                        <td className="py-3 px-2 text-right text-white text-sm font-mono">${bet.amount.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-cyan-400 text-sm font-mono">{bet.multiplier}x</td>
                        <td className="py-3 px-2 text-right text-sm font-mono">
                          <span className={bet.result === 'win' ? 'text-green-400' : 'text-red-400'}>
                            ${bet.payout.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            bet.result === 'win' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {bet.result === 'win' ? 'Won' : 'Lost'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-text-secondary text-xs">
                          {new Date(bet.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-text-secondary">No bets yet. Start playing to see your history!</p>
                <button
                  onClick={() => router.push('/games/crash')}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all text-sm"
                >
                  Play Now
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Security Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Two-Factor Authentication</p>
                    <p className="text-text-secondary text-sm">Add an extra layer of security</p>
                  </div>
                  <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-sm border border-red-500/20">
                    Disabled
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Email Verification</p>
                    <p className="text-text-secondary text-sm">Verify your email address</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-sm border border-green-500/20">
                    Verified
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Password</p>
                    <p className="text-text-secondary text-sm">Last changed: Never</p>
                  </div>
                  <button className="px-4 py-2 bg-accent-primary/10 text-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/20 transition-all border border-accent-primary/20">
                    Change
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-white font-medium">Active Sessions</p>
                    <p className="text-text-secondary text-sm">Manage your active sessions</p>
                  </div>
                  <span className="text-accent-primary font-semibold">1 Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {[
                { action: 'Login', time: 'Just now', icon: '🔐', color: 'border-blue-500/20' },
                { action: 'Placed bet on Crash', time: '2 hours ago', icon: '🎮', color: 'border-cyan-500/20' },
                { action: 'Won 2.5x on Crash', time: '2 hours ago', icon: '🏆', color: 'border-green-500/20' },
                { action: 'Deposit 100 USDT', time: '1 day ago', icon: '💰', color: 'border-yellow-500/20' },
                { action: 'Account created', time: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A', icon: '✨', color: 'border-purple-500/20' },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-4 p-3 bg-white/5 rounded-xl border ${item.color}`}>
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <p className="text-white font-medium">{item.action}</p>
                    <p className="text-text-secondary text-sm">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
    </AuthGuard>
  );
}