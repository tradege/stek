'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';

interface UserStats {
  totalBets: number;
  totalWagered: string;
  totalWon: string;
  totalLost: string;
  winRate: string;
  favoriteGame: string;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'activity'>('overview');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/profile');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (user) {
      // Fetch user stats
      const fetchStats = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000'}/users/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setStats(data);
          }
        } catch (e) {
          // Use fallback stats
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
  const currentVipLevel = user?.vipLevel || 0;
  const vipName = vipLevels[Math.min(currentVipLevel, vipLevels.length - 1)] || 'Bronze';

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6" data-testid="profile-page">
        {/* Profile Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-cyan">
                <span className="text-4xl font-bold text-white">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-accent-primary text-black text-xs font-bold px-2 py-1 rounded-lg">
                {vipName}
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">{user?.username || 'Player'}</h1>
              <p className="text-text-secondary mt-1">{user?.email || ''}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="px-3 py-1 bg-accent-primary/10 text-accent-primary rounded-lg text-sm font-medium border border-accent-primary/20">
                  VIP Level {currentVipLevel}
                </span>
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
              <button
                onClick={() => router.push('/vip')}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-400 hover:to-orange-400 transition-all text-sm"
              >
                👑 VIP Program
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-bg-card border border-white/10 rounded-xl p-1">
          {(['overview', 'security', 'activity'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all capitalize ${
                activeTab === tab
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'overview' ? '📊 Overview' : tab === 'security' ? '🔒 Security' : '📋 Activity'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Stats Cards */}
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Bets</p>
              <p className="text-2xl font-bold text-white">{stats?.totalBets?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Wagered</p>
              <p className="text-2xl font-bold text-accent-primary">${stats?.totalWagered || '0.00'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Won</p>
              <p className="text-2xl font-bold text-green-400">${stats?.totalWon || '0.00'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Total Lost</p>
              <p className="text-2xl font-bold text-red-400">${stats?.totalLost || '0.00'}</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Win Rate</p>
              <p className="text-2xl font-bold text-white">{stats?.winRate || '0'}%</p>
            </div>
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <p className="text-text-secondary text-sm mb-1">Favorite Game</p>
              <p className="text-2xl font-bold text-white">{stats?.favoriteGame || 'N/A'}</p>
            </div>

            {/* VIP Progress */}
            <div className="col-span-full bg-bg-card border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">VIP Progress</h3>
                <span className="text-accent-primary font-semibold">Level {currentVipLevel}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min((currentVipLevel / 6) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-text-secondary">
                <span>Bronze</span>
                <span>Silver</span>
                <span>Gold</span>
                <span>Platinum</span>
                <span>Diamond</span>
                <span>Master</span>
              </div>
            </div>
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
                { action: 'Login', time: 'Just now', icon: '🔐' },
                { action: 'Placed bet on Crash', time: '2 hours ago', icon: '🎮' },
                { action: 'Won 2.5x on Crash', time: '2 hours ago', icon: '🏆' },
                { action: 'Deposit 100 USDT', time: '1 day ago', icon: '💰' },
                { action: 'Account created', time: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A', icon: '✨' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
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
  );
}
