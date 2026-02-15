'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Activity,
  ArrowUp,
  ArrowDown,
  CreditCard,
  Gamepad2
} from 'lucide-react';
import config from '@/config/api';

interface DashboardStats {
  totalRevenue: number;
  totalUsers: number;
  activeUsers: number;
  totalGGR: number;
  providerFees: number;
  netProfit: number;
  totalDeposits: number;
  totalWithdrawals: number;
  activeSessions: number;
}

const API_URL = config.apiUrl;

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalGGR: 0,
    providerFees: 0,
    netProfit: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    activeSessions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchDashboardStats();
    }
  }, [token]);

  const fetchDashboardStats = async () => {
    try {
      const authToken = token || localStorage.getItem('auth_token');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_URL}/api/admin/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Map API response with safe defaults to prevent toLocaleString errors
      setStats({
        totalRevenue: data.totalRevenue ?? data.totalGGR ?? 0,
        totalUsers: data.totalUsers ?? 0,
        activeUsers: data.activeUsers ?? 0,
        totalGGR: data.totalGGR ?? data.ggr ?? 0,
        providerFees: data.providerFees ?? data.providerFee ?? 0,
        netProfit: data.netProfit ?? 0,
        totalDeposits: data.totalDeposits ?? 0,
        totalWithdrawals: data.totalWithdrawals ?? 0,
        activeSessions: data.activeSessions ?? 0,
      });
      setLoading(false);
      setError(null);
    } catch (error: any) {
      // 'Failed to fetch dashboard stats:', error);
      setError(error.message || 'Failed to load dashboard stats');
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    trendValue, 
    color = 'blue' 
  }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: 'up' | 'down';
    trendValue?: string;
    color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  }) => {
    const colorClasses = {
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      green: 'from-green-500/20 to-green-600/20 border-green-500/30',
      yellow: 'from-[#1475e1]/20 to-[#1475e1]/30 border-[#1475e1]/30',
      purple: 'from-[#1475e1]/20 to-[#1475e1]/30 border-[#1475e1]/30',
      red: 'from-red-500/20 to-red-600/20 border-red-500/30'
    };

    return (
      <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-white">{value}</h3>
          </div>
          <div className={`p-3 bg-${color}-500/20 rounded-lg`}>
            <Icon className={`w-6 h-6 text-${color}-400`} />
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-sm">
            {trend === 'up' ? (
              <ArrowUp className="w-4 h-4 text-green-400" />
            ) : (
              <ArrowDown className="w-4 h-4 text-red-400" />
            )}
            <span className={trend === 'up' ? 'text-green-400' : 'text-red-400'}>
              {trendValue}%
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#1475e1] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchDashboardStats}
            className="px-4 py-2 bg-[#1475e1] text-[#0f212e] rounded-lg hover:bg-[#1475e1]/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
        <p className="text-gray-400">Welcome back! Here's what's happening with your casino.</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          icon={Activity}
          color="purple"
        />
        <StatCard
          title="Active Sessions"
          value={stats.activeSessions}
          icon={Gamepad2}
          color="yellow"
        />
      </div>

      {/* Finance Stats */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Gross Gaming Revenue (GGR)</p>
                <h3 className="text-2xl font-bold text-green-400">
                  ${stats.totalGGR.toLocaleString()}
                </h3>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Total player losses - player wins
            </div>
          </div>

          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <CreditCard className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Provider Fees</p>
                <h3 className="text-2xl font-bold text-red-400">
                  ${stats.providerFees.toLocaleString()}
                </h3>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Per-provider fees on external games
            </div>
          </div>

          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-[#1475e1]" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Net Profit (House)</p>
                <h3 className="text-2xl font-bold text-[#1475e1]">
                  ${stats.netProfit.toLocaleString()}
                </h3>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              GGR - Provider Fees = Your profit
            </div>
          </div>
        </div>
      </div>

      {/* Deposits & Withdrawals */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Transaction Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Deposits</p>
                <h3 className="text-2xl font-bold text-white">
                  ${stats.totalDeposits.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <ArrowDown className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="h-2 bg-[#0f212e] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>

          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Withdrawals</p>
                <h3 className="text-2xl font-bold text-white">
                  ${stats.totalWithdrawals.toLocaleString()}
                </h3>
              </div>
              <div className="p-3 bg-red-500/20 rounded-lg">
                <ArrowUp className="w-6 h-6 text-red-400" />
              </div>
            </div>
            <div className="h-2 bg-[#0f212e] rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
