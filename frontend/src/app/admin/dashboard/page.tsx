'use client';

import { useEffect, useState } from 'react';
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

export default function AdminDashboard() {
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

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // TODO: Implement actual API call
      // const response = await fetch('/api/admin/dashboard/stats');
      // const data = await response.json();
      // setStats(data);
      
      // Mock data for now
      setTimeout(() => {
        setStats({
          totalRevenue: 125430.50,
          totalUsers: 1247,
          activeUsers: 89,
          totalGGR: 45230.75,
          providerFees: 3618.46, // 8% of GGR
          netProfit: 41612.29,
          totalDeposits: 234500,
          totalWithdrawals: 109069.50,
          activeSessions: 12
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
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
      yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
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
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
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
          trend="up"
          trendValue="12.5"
          color="green"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          trend="up"
          trendValue="8.2"
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
                <p className="text-gray-400 text-sm">Provider Fees (8%)</p>
                <h3 className="text-2xl font-bold text-red-400">
                  ${stats.providerFees.toLocaleString()}
                </h3>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              8% of GGR paid to game providers
            </div>
          </div>

          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Net Profit (House)</p>
                <h3 className="text-2xl font-bold text-yellow-400">
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
