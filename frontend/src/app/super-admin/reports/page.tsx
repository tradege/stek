'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface BrandReport {
  tenantId: string;
  brandName: string;
  domain: string;
  active: boolean;
  totalPlayers: number;
  totalBets: number;
  totalWagered: number;
  totalPayout: number;
  ggr: number;
  ggrFee: number;
  commission: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBonuses: number;
  playersRealBalance: number;
  playersBonusBalance: number;
  houseBalance: number;
}

interface MasterStats {
  totalBrands: number;
  totalPlayers: number;
  totalWagered: number;
  totalGGR: number;
  totalCommission: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBonuses: number;
  totalPlayersBalance: number;
}

export default function MasterReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<BrandReport[]>([]);
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('commission');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (token) fetchReports();
  }, [token]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.brands || []);
        setStats(data.totals || null);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedReports = [...reports].sort((a, b) => {
    const aVal = (a as any)[sortField] || 0;
    const bVal = (b as any)[sortField] || 0;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Master Reports</h1>
          <p className="text-text-secondary mt-1">Revenue and performance across all brands</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-bg-card border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-text-secondary">Brands</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{stats.totalBrands}</p>
          </div>
          <div className="bg-bg-card border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-text-secondary">Total Players</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{(stats.totalPlayers || 0).toLocaleString()}</p>
          </div>
          <div className="bg-bg-card border border-emerald-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-text-secondary">Total Deposits</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.totalDeposits)}</p>
          </div>
          <div className="bg-bg-card border border-green-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-text-secondary">Total GGR</span>
            </div>
            <p className={`text-2xl font-bold ${(stats.totalGGR || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(stats.totalGGR)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-text-secondary">Your Commission</span>
            </div>
            <p className={`text-2xl font-bold ${(stats.totalCommission || 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {formatCurrency(stats.totalCommission)}
            </p>
          </div>
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">All Brands Performance</h2>
          <p className="text-sm text-text-secondary mt-1">Click column headers to sort</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase">Brand</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-text-secondary uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('totalPlayers')}
                >
                  Players <SortIcon field="totalPlayers" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-emerald-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('totalDeposits')}
                >
                  Deposits <SortIcon field="totalDeposits" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-yellow-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('totalBonuses')}
                >
                  Bonuses <SortIcon field="totalBonuses" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-text-secondary uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('totalBets')}
                >
                  Bets <SortIcon field="totalBets" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-blue-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('totalWagered')}
                >
                  Wagered <SortIcon field="totalWagered" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-green-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('ggr')}
                >
                  GGR <SortIcon field="ggr" />
                </th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-text-secondary uppercase">Fee %</th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-yellow-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('commission')}
                >
                  Commission <SortIcon field="commission" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-orange-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('totalWithdrawals')}
                >
                  Withdrawals <SortIcon field="totalWithdrawals" />
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-cyan-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('playersRealBalance')}
                >
                  Players Balance <SortIcon field="playersRealBalance" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedReports.map((brand) => (
                <tr key={brand.tenantId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{brand.brandName}</p>
                    <p className="text-xs text-text-secondary">{brand.domain}</p>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${
                        brand.active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {brand.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right text-sm text-white">
                    {(brand.totalPlayers || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right text-sm font-medium text-emerald-400">
                    {formatCurrency(brand.totalDeposits)}
                  </td>
                  <td className="px-3 py-4 text-right text-sm font-medium text-yellow-400">
                    {formatCurrency(brand.totalBonuses)}
                  </td>
                  <td className="px-3 py-4 text-right text-sm text-white">
                    {(brand.totalBets || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right text-sm font-medium text-blue-400">
                    {formatCurrency(brand.totalWagered)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className={`text-sm font-medium ${(brand.ggr || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(brand.ggr)}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right text-sm text-text-secondary font-medium">
                    {brand.ggrFee}%
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className={`text-sm font-bold ${(brand.commission || 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {formatCurrency(brand.commission)}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right text-sm font-medium text-orange-400">
                    {formatCurrency(brand.totalWithdrawals)}
                  </td>
                  <td className="px-3 py-4 text-right text-sm font-medium text-cyan-400">
                    {formatCurrency(brand.playersRealBalance)}
                  </td>
                </tr>
              ))}
              {sortedReports.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-text-secondary">
                    No brand data available yet.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Totals Row */}
            {sortedReports.length > 0 && (
              <tfoot>
                <tr className="bg-white/5 border-t-2 border-cyan-500/30">
                  <td className="px-4 py-4 font-bold text-cyan-400" colSpan={2}>
                    TOTALS
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-white">
                    {reports.reduce((s, b) => s + (b.totalPlayers || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-emerald-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.totalDeposits || 0), 0))}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-yellow-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.totalBonuses || 0), 0))}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-white">
                    {reports.reduce((s, b) => s + (b.totalBets || 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-blue-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.totalWagered || 0), 0))}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-green-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.ggr || 0), 0))}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-text-secondary">—</td>
                  <td className="px-3 py-4 text-right font-bold text-yellow-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.commission || 0), 0))}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-orange-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.totalWithdrawals || 0), 0))}
                  </td>
                  <td className="px-3 py-4 text-right font-bold text-cyan-400">
                    {formatCurrency(reports.reduce((s, b) => s + (b.playersRealBalance || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
