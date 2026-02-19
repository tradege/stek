'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Users, TrendingUp, Activity, ArrowDown, ArrowUp,
  CreditCard, Gamepad2, RefreshCw, ArrowDownLeft, ArrowUpRight,
  Clock, Shield, AlertTriangle, ChevronRight, Package
} from 'lucide-react';
import config from '@/config/api';

interface DashboardStats {
  totalRevenue: number;
  totalUsers: number;
  activeUsers: number;
  activeUsersLast24h: number;
  pendingApprovalUsers: number;
  pendingTransactions: number;
  totalGGR: number;
  providerFees: number;
  netProfit: number;
  totalDeposits: number;
  totalWithdrawals: number;
  activeSessions: number;
  totalBets: number;
  stats: { wagered: number; payouts: number };
}

const API_URL = config.apiUrl;

export default function AdminDashboard() {
  const { token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (token) fetchDashboardStats();
  }, [token]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const authToken = token || localStorage.getItem('auth_token');
      if (!authToken) throw new Error('No authentication token found');
      const response = await fetch(`${API_URL}/api/admin/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setStats({
        totalRevenue: data.totalRevenue ?? data.totalGGR ?? 0,
        totalUsers: data.totalUsers ?? 0,
        activeUsers: data.activeUsers ?? 0,
        activeUsersLast24h: data.activeUsersLast24h ?? 0,
        pendingApprovalUsers: data.pendingApprovalUsers ?? 0,
        pendingTransactions: data.pendingTransactions ?? 0,
        totalGGR: data.totalGGR ?? data.ggr ?? 0,
        providerFees: data.providerFees ?? data.providerFee ?? 0,
        netProfit: data.netProfit ?? 0,
        totalDeposits: data.totalDeposits ?? 0,
        totalWithdrawals: data.totalWithdrawals ?? 0,
        activeSessions: data.activeSessions ?? 0,
        totalBets: data.totalBets ?? 0,
        stats: data.stats ?? { wagered: 0, payouts: 0 },
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (error: any) {
      setError(error.message || 'Failed to load dashboard stats');
    } finally { setLoading(false); }
  };

  const fmt = (val: number) => {
    if (Math.abs(val) >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(val) >= 1_000) return '$' + (val / 1_000).toFixed(2) + 'K';
    return '$' + val.toFixed(2);
  };

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error && !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchDashboardStats} className="px-4 py-2 bg-accent-primary text-black rounded-lg hover:bg-accent-primary/90">Retry</button>
      </div>
    </div>
  );

  if (!stats) return null;

  const netDeposits = stats.totalDeposits - stats.totalWithdrawals;
  const depositRatio = stats.totalDeposits > 0 ? (stats.totalWithdrawals / stats.totalDeposits * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Dashboard Overview</h1>
          <p className="text-text-secondary">Welcome back! Here's your casino at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={fetchDashboardStats} disabled={loading}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(stats.pendingApprovalUsers > 0 || stats.pendingTransactions > 0) && (
        <div className="flex gap-4 flex-wrap">
          {stats.pendingApprovalUsers > 0 && (
            <button onClick={() => router.push('/admin/users')}
              className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 hover:bg-yellow-500/20 transition-colors">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">{stats.pendingApprovalUsers} pending user{stats.pendingApprovalUsers > 1 ? 's' : ''}</span>
              <ChevronRight className="w-4 h-4 text-yellow-400" />
            </button>
          )}
          {stats.pendingTransactions > 0 && (
            <button onClick={() => router.push('/admin/transactions')}
              className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3 hover:bg-orange-500/20 transition-colors">
              <Clock className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400 font-medium">{stats.pendingTransactions} pending transaction{stats.pendingTransactions > 1 ? 's' : ''}</span>
              <ChevronRight className="w-4 h-4 text-orange-400" />
            </button>
          )}
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-secondary text-xs">Net Profit</p>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-green-400">{fmt(stats.netProfit)}</h3>
          <p className="text-xs text-text-tertiary mt-1">GGR - Provider Fees</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-secondary text-xs">Total Players</p>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-blue-400">{stats.totalUsers.toLocaleString()}</h3>
          <p className="text-xs text-text-tertiary mt-1">{stats.activeUsersLast24h} active in 24h</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-secondary text-xs">Total Wagered</p>
            <Gamepad2 className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold text-purple-400">{fmt(stats.stats.wagered)}</h3>
          <p className="text-xs text-text-tertiary mt-1">{stats.totalBets.toLocaleString()} bets placed</p>
        </div>

        <div className="bg-gradient-to-br from-accent-primary/20 to-accent-primary/10 border border-accent-primary/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-text-secondary text-xs">GGR</p>
            <TrendingUp className="w-5 h-5 text-accent-primary" />
          </div>
          <h3 className="text-2xl font-bold text-accent-primary">{fmt(stats.totalGGR)}</h3>
          <p className="text-xs text-text-tertiary mt-1">Gross Gaming Revenue</p>
        </div>
      </div>

      {/* Money Flow */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Money Flow</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-text-secondary">Deposits</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">{fmt(stats.totalDeposits)}</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-text-secondary">Withdrawals</span>
            </div>
            <p className="text-xl font-bold text-orange-400">{fmt(stats.totalWithdrawals)}</p>
          </div>
          <div className={`${netDeposits >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`w-4 h-4 ${netDeposits >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              <span className="text-xs text-text-secondary">Net Deposits</span>
            </div>
            <p className={`text-xl font-bold ${netDeposits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {netDeposits >= 0 ? '+' : ''}{fmt(netDeposits)}
            </p>
          </div>
          <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-accent-primary" />
              <span className="text-xs text-text-secondary">Payout Ratio</span>
            </div>
            <p className="text-xl font-bold text-accent-primary">{depositRatio.toFixed(1)}%</p>
          </div>
        </div>

        {/* Deposit vs Withdrawal bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-text-tertiary mb-1">
            <span>Deposits: {fmt(stats.totalDeposits)}</span>
            <span>Withdrawals: {fmt(stats.totalWithdrawals)}</span>
          </div>
          <div className="h-3 bg-bg-main rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 rounded-l-full transition-all"
              style={{ width: `${stats.totalDeposits > 0 ? Math.min((stats.totalDeposits / (stats.totalDeposits + stats.totalWithdrawals)) * 100, 100) : 50}%` }} />
            <div className="h-full bg-orange-500 rounded-r-full transition-all"
              style={{ width: `${stats.totalWithdrawals > 0 ? Math.min((stats.totalWithdrawals / (stats.totalDeposits + stats.totalWithdrawals)) * 100, 100) : 50}%` }} />
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg"><TrendingUp className="w-5 h-5 text-green-400" /></div>
            <div>
              <p className="text-text-secondary text-xs">GGR</p>
              <h3 className="text-xl font-bold text-green-400">{fmt(stats.totalGGR)}</h3>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">Bets - Payouts</p>
        </div>

        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-500/20 rounded-lg"><Package className="w-5 h-5 text-red-400" /></div>
            <div>
              <p className="text-text-secondary text-xs">Provider Fees</p>
              <h3 className={`text-xl font-bold ${stats.providerFees > 0 ? 'text-red-400' : 'text-text-secondary'}`}>
                {stats.providerFees > 0 ? '-' + fmt(stats.providerFees) : '$0.00'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">{stats.providerFees > 0 ? 'External provider fees' : 'All games in-house'}</p>
        </div>

        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-accent-primary/20 rounded-lg"><DollarSign className="w-5 h-5 text-accent-primary" /></div>
            <div>
              <p className="text-text-secondary text-xs">Net Profit</p>
              <h3 className="text-xl font-bold text-accent-primary">{fmt(stats.netProfit)}</h3>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">Your actual earnings</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Manage Users', icon: Users, path: '/admin/users', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
            { label: 'Finance & GGR', icon: DollarSign, path: '/admin/finance', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
            { label: 'Game Settings', icon: Gamepad2, path: '/admin/games', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
            { label: 'Transactions', icon: CreditCard, path: '/admin/transactions', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
          ].map(action => (
            <button key={action.label} onClick={() => router.push(action.path)}
              className={`flex items-center gap-3 p-4 rounded-lg border ${action.color} hover:opacity-80 transition-opacity`}>
              <action.icon className="w-5 h-5" />
              <span className="text-sm font-medium text-white">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <div>
              <p className="text-sm text-white font-medium">Backend API</p>
              <p className="text-xs text-text-tertiary">Operational</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <div>
              <p className="text-sm text-white font-medium">Database</p>
              <p className="text-xs text-text-tertiary">Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <div>
              <p className="text-sm text-white font-medium">WebSocket</p>
              <p className="text-xs text-text-tertiary">{stats.activeSessions} sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
            <div>
              <p className="text-sm text-white font-medium">Sports Feed</p>
              <p className="text-xs text-text-tertiary">Live (Cron active)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
