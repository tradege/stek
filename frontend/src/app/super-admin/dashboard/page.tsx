'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  Globe,
  Bot,
  UserCheck,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import config from '@/config/api';
import Link from 'next/link';

const API_URL = config.apiUrl;

interface PlayerStats {
  count: number;
  bets: number;
  wagered: number;
  payout: number;
  ggr: number;
}

interface DashboardStats {
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
  realPlayers: PlayerStats;
  bots: PlayerStats;
  // Legacy
  totalPlayers: number;
  totalBets: number;
  totalWagered: number;
  totalPayout: number;
  totalGGR: number;
}

interface TenantSummary {
  id: string;
  brandName: string;
  domain: string;
  active: boolean;
  isPlatform?: boolean;
  stats: {
    totalPlayers: number;
    totalBets: number;
    ggr: number;
    ggrFee: number;
    commission: number;
  };
}

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [dashRes, tenantsRes] = await Promise.all([
        fetch(`${API_URL}/api/super-admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/super-admin/tenants`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (dashRes.ok) {
        setStats(await dashRes.json());
      }
      if (tenantsRes.ok) {
        setTenants(await tenantsRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    const v = Number(val) || 0;
    if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  const formatNumber = (val: number | null | undefined) => {
    return (Number(val) || 0).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  const real = stats?.realPlayers || { count: 0, bets: 0, wagered: 0, payout: 0, ggr: 0 };
  const bot = stats?.bots || { count: 0, bets: 0, wagered: 0, payout: 0, ggr: 0 };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-text-secondary mt-1">Monitor all brands, players, and bot activity</p>
        </div>
        <Link
          href="/super-admin/tenants/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
        >
          <Building2 className="w-4 h-4" />
          Create Brand
        </Link>
      </div>

      {/* Brand Overview - compact row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-cyan-500/20 rounded-lg">
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-cyan-400">{stats?.totalBrands || 0}</p>
            <p className="text-xs text-text-secondary">White Label Brands ({Math.max(0, (stats?.activeBrands || 0) - 1)} active)</p>
          </div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-green-500/20 rounded-lg">
            <UserCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">{formatNumber(real.count)}</p>
            <p className="text-xs text-text-secondary">Real Players</p>
          </div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-400">{formatNumber(bot.count)}</p>
            <p className="text-xs text-text-secondary">Active Bots</p>
          </div>
        </div>
      </div>

      {/* ===== SECTION 1: REAL PLAYERS ===== */}
      <div className="bg-bg-card border border-green-500/20 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Real Players</h2>
              <p className="text-xs text-text-secondary">Actual registered users — real money, real bets</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-white/5">
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Players</p>
            <p className="text-xl font-bold text-green-400">{formatNumber(real.count)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Total Bets</p>
            <p className="text-xl font-bold text-white">{formatNumber(real.bets)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Total Wagered</p>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(real.wagered)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Total Payouts</p>
            <p className="text-xl font-bold text-yellow-400">{formatCurrency(real.payout)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">GGR (Profit)</p>
            <div className="flex items-center gap-2">
              <p className={`text-xl font-bold ${real.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(real.ggr)}
              </p>
              {real.ggr >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: BOTS ===== */}
      <div className="bg-bg-card border border-purple-500/20 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Bot Activity</h2>
              <p className="text-xs text-text-secondary">Artificial activity — bots create atmosphere, not counted in revenue</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-white/5">
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Bots</p>
            <p className="text-xl font-bold text-purple-400">{formatNumber(bot.count)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Total Bets</p>
            <p className="text-xl font-bold text-white">{formatNumber(bot.bets)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Total Wagered</p>
            <p className="text-xl font-bold text-purple-300">{formatCurrency(bot.wagered)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Total Payouts</p>
            <p className="text-xl font-bold text-purple-300">{formatCurrency(bot.payout)}</p>
          </div>
          <div className="bg-bg-card p-5">
            <p className="text-xs text-text-secondary mb-1">Bot P&L</p>
            <div className="flex items-center gap-2">
              <p className={`text-xl font-bold ${bot.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(bot.ggr)}
              </p>
              {bot.ggr >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-400" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 3: WHITE LABELS ===== */}
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">White Label Brands</h2>
              <p className="text-sm text-text-secondary">{tenants.filter(t => !t.isPlatform).length} brands registered — real players only</p>
            </div>
          </div>
          <Link
            href="/super-admin/tenants"
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View All →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Brand</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Domain</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Players</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Bets</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">GGR</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Fee %</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Commission</th>
              </tr>
            </thead>
            <tbody>
              {tenants.filter(t => !t.isPlatform).map((tenant) => (
                <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/super-admin/tenants`} className="flex items-center gap-3 hover:text-cyan-400 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="font-medium text-white">{tenant.brandName}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">{tenant.domain}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        tenant.active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {tenant.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-white">{(tenant.stats?.totalPlayers || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm text-white">{(tenant.stats?.totalBets || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-medium ${(tenant.stats?.ggr || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(tenant.stats?.ggr)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-yellow-400">{tenant.stats?.ggrFee || 12}%</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-bold ${(tenant.stats?.commission || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(tenant.stats?.commission)}
                    </span>
                  </td>
                </tr>
              ))}
              {tenants.filter(t => !t.isPlatform).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-secondary">
                    No brands registered yet. Create your first brand to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
