'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBets: number;
  houseProfit: number;
}

interface RecentUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  ipAddress: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000';

export default function AdminDashboardPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    fetchDashboardData();
  }, [user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsResponse = await fetch(`${API_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      // Fetch recent users
      const usersResponse = await fetch(`${API_URL}/admin/users/recent`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      } else {
        // Mock data
        setStats({
          totalUsers: 156,
          activeUsers: 42,
          totalDeposits: 125000,
          totalWithdrawals: 85000,
          totalBets: 450000,
          houseProfit: 22500,
        });
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setRecentUsers(usersData);
      } else {
        // Mock data
        setRecentUsers([
          { id: '1', username: 'player123', email: 'player123@email.com', createdAt: new Date().toISOString(), ipAddress: '192.168.1.100' },
          { id: '2', username: 'gambler99', email: 'gambler99@email.com', createdAt: new Date(Date.now() - 3600000).toISOString(), ipAddress: '10.0.0.50' },
          { id: '3', username: 'lucky_star', email: 'lucky@email.com', createdAt: new Date(Date.now() - 7200000).toISOString(), ipAddress: '172.16.0.25' },
          { id: '4', username: 'crypto_whale', email: 'whale@email.com', createdAt: new Date(Date.now() - 86400000).toISOString(), ipAddress: '192.168.2.1' },
          { id: '5', username: 'newbie2024', email: 'newbie@email.com', createdAt: new Date(Date.now() - 172800000).toISOString(), ipAddress: '10.10.10.10' },
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-text-secondary">Welcome back, {user?.username}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
          </div>
        ) : (
          <>
            {/* Latest Registrations Widget */}
            <div className="bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 rounded-xl p-6 border border-accent-primary/30 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Latest Registrations</h2>
                    <p className="text-text-secondary text-sm">Last 5 users who joined</p>
                  </div>
                </div>
                <Link 
                  href="/admin/users"
                  className="px-4 py-2 bg-accent-primary text-black rounded-lg hover:bg-accent-primary/90 transition-colors text-sm font-medium"
                >
                  View All Users
                </Link>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-text-secondary text-sm font-medium">User</th>
                      <th className="px-4 py-3 text-left text-text-secondary text-sm font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-text-secondary text-sm font-medium">IP Address</th>
                      <th className="px-4 py-3 text-left text-text-secondary text-sm font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((u) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
                              <span className="text-accent-primary text-sm font-bold">{u.username[0].toUpperCase()}</span>
                            </div>
                            <span className="text-white font-medium">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-white/10 rounded text-text-secondary text-sm font-mono">
                            {u.ipAddress || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-bg-card rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Total Users</p>
                    <p className="text-2xl font-bold text-white">{stats?.totalUsers.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-bg-card rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Active Now</p>
                    <p className="text-2xl font-bold text-green-400">{stats?.activeUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-bg-card rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent-primary/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Total Deposits</p>
                    <p className="text-2xl font-bold text-accent-primary">${stats?.totalDeposits.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-bg-card rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Total Withdrawals</p>
                    <p className="text-2xl font-bold text-orange-400">${stats?.totalWithdrawals.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-bg-card rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">Total Bets</p>
                    <p className="text-2xl font-bold text-purple-400">${stats?.totalBets.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-bg-card rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary text-sm">House Profit</p>
                    <p className="text-2xl font-bold text-yellow-400">${stats?.houseProfit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link href="/admin/users" className="bg-bg-card rounded-xl p-6 border border-white/10 hover:border-accent-primary/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent-primary/20 flex items-center justify-center group-hover:bg-accent-primary/30 transition-colors">
                    <svg className="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">User Management</h3>
                    <p className="text-text-secondary text-sm">View and manage users</p>
                  </div>
                </div>
              </Link>

              <Link href="/admin/transactions" className="bg-bg-card rounded-xl p-6 border border-white/10 hover:border-accent-primary/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Transactions</h3>
                    <p className="text-text-secondary text-sm">View all transactions</p>
                  </div>
                </div>
              </Link>

              <div className="bg-bg-card rounded-xl p-6 border border-white/10 hover:border-accent-primary/50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Settings</h3>
                    <p className="text-text-secondary text-sm">Configure platform</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
