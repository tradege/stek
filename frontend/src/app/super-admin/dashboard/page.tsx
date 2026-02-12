'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  Globe,
  Zap,
} from 'lucide-react';
import config from '@/config/api';
import Link from 'next/link';

const API_URL = config.apiUrl;

interface DashboardStats {
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  const statCards = stats
    ? [
        {
          label: 'Total Brands',
          value: stats.totalBrands.toString(),
          sub: `${stats.activeBrands} active`,
          icon: <Building2 className="w-6 h-6" />,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10',
          borderColor: 'border-cyan-500/20',
        },
        {
          label: 'Total Players',
          value: (stats.totalPlayers || 0).toLocaleString(),
          sub: 'across all brands',
          icon: <Users className="w-6 h-6" />,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10',
          borderColor: 'border-cyan-500/20',
        },
        {
          label: 'Total Wagered',
          value: formatCurrency(stats.totalWagered),
          sub: `${(stats.totalBets || 0).toLocaleString()} bets`,
          icon: <Activity className="w-6 h-6" />,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
        },
        {
          label: 'Total GGR',
          value: formatCurrency(stats.totalGGR),
          sub: stats.totalGGR >= 0 ? 'Profit' : 'Loss',
          icon: <TrendingUp className="w-6 h-6" />,
          color: stats.totalGGR >= 0 ? 'text-green-400' : 'text-red-400',
          bgColor: stats.totalGGR >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
          borderColor: stats.totalGGR >= 0 ? 'border-green-500/20' : 'border-red-500/20',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-text-secondary mt-1">Monitor all brands and revenue streams</p>
        </div>
        <Link
          href="/super-admin/tenants/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
        >
          <Building2 className="w-4 h-4" />
          Create Brand
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`${card.bgColor} border ${card.borderColor} rounded-xl p-5 transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`${card.color}`}>{card.icon}</span>
              <span className="text-xs text-text-secondary">{card.sub}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-sm text-text-secondary mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Brands Table */}
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">All Brands</h2>
            <p className="text-sm text-text-secondary">{tenants.length} brands registered</p>
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
              {tenants.map((tenant) => (
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
              {tenants.length === 0 && (
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
