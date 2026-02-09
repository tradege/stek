'use client';

import { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import config from '@/config/api';

// Rank definitions with icons and colors
const RANKS = [
  { name: 'Iron', icon: '🔩', color: '#6B7280', tier1Rate: '5%', tier2Rate: '2%', tier3Rate: '1%', minVolume: 0 },
  { name: 'Bronze', icon: '🥉', color: '#CD7F32', tier1Rate: '7%', tier2Rate: '3%', tier3Rate: '1.5%', minVolume: 1000 },
  { name: 'Silver', icon: '🥈', color: '#C0C0C0', tier1Rate: '8%', tier2Rate: '4%', tier3Rate: '2%', minVolume: 5000 },
  { name: 'Gold', icon: '🥇', color: '#FFD700', tier1Rate: '10%', tier2Rate: '5%', tier3Rate: '2.5%', minVolume: 25000 },
  { name: 'Diamond', icon: '💎', color: '#00F0FF', tier1Rate: '12%', tier2Rate: '5%', tier3Rate: '2.5%', minVolume: 100000 },
];

interface AffiliateStats {
  referralCode: string;
  referralLink: string;
  currentRank: {
    name: string;
    icon: string;
    color: string;
    tier1Rate: string;
    tier2Rate: string;
    tier3Rate: string;
  };
  nextRank: {
    name: string;
    icon: string;
    volumeRequired: number;
    volumeRemaining: number;
  } | null;
  rankProgress: {
    current: number;
    target: number;
    percentage: number;
  };
  availableCommission: number;
  totalEarned: number;
  networkStats: {
    tier1: number;
    tier2: number;
    tier3: number;
    total: number;
  };
  totalNetworkVolume: number;
}

interface NetworkTier {
  tier: number;
  name: string;
  users: number;
  earnings: number;
  volume: number;
  members: Array<{
    username: string;
    joinedAt: string;
    volume?: number;
  }>;
}

interface CommissionHistory {
  history: Array<{ date: string; amount: number }>;
  total: number;
}

interface LeaderboardEntry {
  username: string;
  totalEarned: number;
  referrals: number;
}

export default function AffiliatesPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [network, setNetwork] = useState<{ tiers: NetworkTier[]; totalUsers: number; totalEarnings: number } | null>(null);
  const [history, setHistory] = useState<CommissionHistory | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'leaderboard'>('overview');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

const API_URL = config.apiUrl;

  const fetchAffiliateData = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, networkRes, historyRes, leaderboardRes] = await Promise.all([
        fetch(`${API_URL}/affiliates/stats`, { headers }),
        fetch(`${API_URL}/affiliates/network`, { headers }),
        fetch(`${API_URL}/affiliates/history`, { headers }),
        fetch(`${API_URL}/affiliates/leaderboard`, { headers }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (networkRes.ok) {
        const networkData = await networkRes.json();
        setNetwork(networkData);
      }
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json();
        setLeaderboard(leaderboardData.leaderboard || []);
      }
    } catch (error) {
      // 'Failed to fetch affiliate data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    if (authLoading) return;
    
    if (token) {
      fetchAffiliateData();
    } else {
      setLoading(false);
    }
  }, [token, authLoading, fetchAffiliateData]);

  const handleCopyLink = () => {
    const link = stats?.referralLink || `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${user?.id || ''}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimCommission = async () => {
    if (!stats?.availableCommission || stats.availableCommission <= 0) return;

    try {
      setClaiming(true);
      const res = await fetch(`${API_URL}/affiliates/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setToast({ message: data.message, type: 'success' });
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        fetchAffiliateData();
      } else {
        const error = await res.json();
        setToast({ message: error.message || 'Failed to claim', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Network error', type: 'error' });
    } finally {
      setClaiming(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <MainLayout>
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#00F0FF] mx-auto mb-4"></div>
          <p className="text-[#94A3B8]">Loading your affiliate empire...</p>
        </div>
      </div>
      </MainLayout>
    );
  }

  // Not authenticated
  if (!token) {
    return (
      <MainLayout>
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center p-4">
        <div className="bg-[#131B2C] rounded-2xl p-8 border border-[#1E293B] text-center max-w-md w-full">
          <div className="text-7xl mb-6">🔐</div>
          <h1 className="text-3xl font-bold text-white mb-4">Login Required</h1>
          <p className="text-[#94A3B8] mb-8 text-lg">
            Sign in to access the Affiliates program and start building your empire!
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-[#00F0FF] text-[#0A0E17] rounded-xl font-bold text-lg hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-8 py-4 bg-[#1E293B] text-white rounded-xl font-bold text-lg hover:bg-[#2D3B4F] transition-all border border-[#334155]"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
      </MainLayout>
    );
  }

  const currentRank = stats?.currentRank || RANKS[0];
  const nextRank = stats?.nextRank;

  return (
    <MainLayout>
    <div className="min-h-screen bg-[#0A0E17] text-white">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ['#00F0FF', '#FFD700', '#FF6B6B', '#4ADE80', '#A855F7'][Math.floor(Math.random() * 5)],
                width: '10px',
                height: '10px',
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${
          toast.type === 'success' 
            ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
            : 'bg-gradient-to-r from-red-500 to-rose-500'
        }`}>
          <span className="text-2xl">{toast.type === 'success' ? '🎉' : '❌'}</span>
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#00F0FF] to-[#A855F7] bg-clip-text text-transparent mb-2">
            Affiliate Dashboard
          </h1>
          <p className="text-[#94A3B8] text-lg">Build your empire. Earn unlimited commissions.</p>
        </div>

        {/* Section A: The Rank Card */}
        <div className="bg-gradient-to-br from-[#131B2C] to-[#0F1520] rounded-2xl p-8 border border-[#1E293B] relative overflow-hidden">
          {/* Background Glow */}
          <div 
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: currentRank.color }}
          />
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Rank Badge */}
              <div className="text-center">
                <div 
                  className="text-9xl mb-4 animate-pulse"
                  style={{ 
                    filter: `drop-shadow(0 0 30px ${currentRank.color})`,
                  }}
                >
                  {currentRank.icon}
                </div>
                <h2 
                  className="text-4xl font-bold uppercase tracking-wider"
                  style={{ color: currentRank.color }}
                >
                  {currentRank.name}
                </h2>
                <p className="text-[#94A3B8] mt-2">Current Rank</p>
              </div>

              {/* Commission Rates */}
              <div className="flex-1 grid grid-cols-3 gap-4 w-full">
                <div className="bg-[#0A0E17]/50 rounded-xl p-4 text-center border border-[#1E293B]">
                  <div className="text-3xl font-bold text-[#00F0FF]">{currentRank.tier1Rate}</div>
                  <div className="text-[#94A3B8] text-sm mt-1">Tier 1</div>
                  <div className="text-xs text-[#64748B]">Direct Referrals</div>
                </div>
                <div className="bg-[#0A0E17]/50 rounded-xl p-4 text-center border border-[#1E293B]">
                  <div className="text-3xl font-bold text-[#A855F7]">{currentRank.tier2Rate}</div>
                  <div className="text-[#94A3B8] text-sm mt-1">Tier 2</div>
                  <div className="text-xs text-[#64748B]">Sub-Referrals</div>
                </div>
                <div className="bg-[#0A0E17]/50 rounded-xl p-4 text-center border border-[#1E293B]">
                  <div className="text-3xl font-bold text-[#F97316]">{currentRank.tier3Rate}</div>
                  <div className="text-[#94A3B8] text-sm mt-1">Tier 3</div>
                  <div className="text-xs text-[#64748B]">Deep Network</div>
                </div>
              </div>
            </div>

            {/* Progress Bar to Next Rank */}
            {nextRank && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[#94A3B8]">
                    Progress to <span className="text-white font-semibold">{nextRank.icon} {nextRank.name}</span>
                  </span>
                  <span className="text-[#00F0FF] font-bold">{stats?.rankProgress?.percentage?.toFixed(1) || 0}%</span>
                </div>
                <div className="h-4 bg-[#0A0E17] rounded-full overflow-hidden border border-[#1E293B]">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out relative"
                    style={{
                      width: `${stats?.rankProgress?.percentage || 0}%`,
                      background: `linear-gradient(90deg, ${currentRank.color}, #00F0FF)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                  </div>
                </div>
                <p className="text-center mt-4 text-[#94A3B8]">
                  🎯 <span className="text-white">Unlock {nextRank.name} Tier!</span> Generate{' '}
                  <span className="text-[#00F0FF] font-bold">${nextRank.volumeRemaining?.toLocaleString() || 0}</span> more network volume.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section B: The Money Card */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Commission Wallet */}
          <div className="bg-gradient-to-br from-[#131B2C] to-[#0F1520] rounded-2xl p-6 border border-[#1E293B] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-green-500/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Commission Wallet</h3>
                  <p className="text-[#94A3B8] text-sm">Available to claim</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-5xl font-bold text-green-400 mb-2">
                  ${stats?.availableCommission?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </div>
                <div className="flex items-center gap-2 text-[#94A3B8]">
                  <span>Total Earned:</span>
                  <span className="text-white font-semibold">${stats?.totalEarned?.toLocaleString() || '0.00'}</span>
                </div>
              </div>

              <button
                onClick={handleClaimCommission}
                disabled={claiming || !stats?.availableCommission || stats.availableCommission <= 0}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                  stats?.availableCommission && stats.availableCommission > 0
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)]'
                    : 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                }`}
              >
                {claiming ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                    CLAIMING...
                  </>
                ) : (
                  <>
                    <span className="text-2xl">💸</span>
                    CLAIM TO WALLET
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referral Link */}
          <div className="bg-gradient-to-br from-[#131B2C] to-[#0F1520] rounded-2xl p-6 border border-[#1E293B] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#00F0FF]/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#00F0FF]/20 flex items-center justify-center">
                  <span className="text-2xl">🔗</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Your Referral Link</h3>
                  <p className="text-[#94A3B8] text-sm">Share to earn commissions</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="bg-[#0A0E17] rounded-xl p-4 border border-[#1E293B]">
                  <code className="text-[#00F0FF] text-sm break-all">
                    {stats?.referralLink || `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${user?.id || ''}`}
                  </code>
                </div>
              </div>

              <button
                onClick={handleCopyLink}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-gradient-to-r from-[#00F0FF] to-[#00D4E8] text-[#0A0E17] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)]'
                }`}
              >
                {copied ? (
                  <>
                    <span className="text-2xl">✓</span>
                    COPIED!
                  </>
                ) : (
                  <>
                    <span className="text-2xl">📋</span>
                    COPY LINK
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Section C: The Empire - Tabs */}
        <div className="bg-gradient-to-br from-[#131B2C] to-[#0F1520] rounded-2xl border border-[#1E293B] overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b border-[#1E293B]">
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'network', label: '👥 Network', icon: '👥' },
              { id: 'leaderboard', label: '🏆 Leaderboard', icon: '🏆' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 py-5 px-6 font-bold text-lg transition-all ${
                  activeTab === tab.id
                    ? 'text-[#00F0FF] border-b-2 border-[#00F0FF] bg-[#00F0FF]/5'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Network Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0A0E17] rounded-xl p-5 text-center border border-[#1E293B]">
                    <div className="text-3xl font-bold text-[#00F0FF]">{stats?.networkStats?.tier1 || 0}</div>
                    <div className="text-[#94A3B8] text-sm mt-1">Tier 1 Referrals</div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-xl p-5 text-center border border-[#1E293B]">
                    <div className="text-3xl font-bold text-[#A855F7]">{stats?.networkStats?.tier2 || 0}</div>
                    <div className="text-[#94A3B8] text-sm mt-1">Tier 2 Referrals</div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-xl p-5 text-center border border-[#1E293B]">
                    <div className="text-3xl font-bold text-[#F97316]">{stats?.networkStats?.tier3 || 0}</div>
                    <div className="text-[#94A3B8] text-sm mt-1">Tier 3 Referrals</div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-xl p-5 text-center border border-[#1E293B]">
                    <div className="text-3xl font-bold text-green-400">${(stats?.totalNetworkVolume || 0).toLocaleString()}</div>
                    <div className="text-[#94A3B8] text-sm mt-1">Network Volume</div>
                  </div>
                </div>

                {/* Commission History Chart */}
                <div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>📈</span> Commission History (30 Days)
                  </h3>
                  <div className="h-48 bg-[#0A0E17] rounded-xl p-4 flex items-end gap-1 border border-[#1E293B]">
                    {(history?.history || Array(30).fill({ amount: 0 })).slice(-30).map((day, i) => {
                      const maxAmount = Math.max(...(history?.history?.map(h => h.amount) || [1]), 1);
                      const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-t transition-all duration-300 hover:opacity-80 group relative"
                          style={{ 
                            height: `${Math.max(height, 2)}%`,
                            background: `linear-gradient(to top, #00F0FF, #00F0FF80)`,
                          }}
                          title={`${day.date || `Day ${i + 1}`}: $${day.amount?.toFixed(2) || '0.00'}`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1E293B] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            ${day.amount?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-[#64748B]">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-[#0A0E17] rounded-xl p-5 border border-[#1E293B]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8]">Last 30 Days Earnings</span>
                      <span className="text-2xl font-bold text-yellow-400">${history?.total?.toLocaleString() || '0.00'}</span>
                    </div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-xl p-5 border border-[#1E293B]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8]">Total Network Size</span>
                      <span className="text-2xl font-bold text-[#00F0FF]">{stats?.networkStats?.total || 0} Users</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Network Tab */}
            {activeTab === 'network' && (
              <div className="space-y-6">
                {(network?.tiers || [
                  { tier: 1, name: 'Tier 1 - Direct Referrals', users: 0, earnings: 0, volume: 0, members: [] },
                  { tier: 2, name: 'Tier 2 - Sub-Referrals', users: 0, earnings: 0, volume: 0, members: [] },
                  { tier: 3, name: 'Tier 3 - Deep Network', users: 0, earnings: 0, volume: 0, members: [] },
                ]).map((tier) => (
                  <div key={tier.tier} className="bg-[#0A0E17] rounded-xl border border-[#1E293B] overflow-hidden">
                    <div className="p-5 flex items-center justify-between border-b border-[#1E293B]">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                          tier.tier === 1 ? 'bg-[#00F0FF]/20 text-[#00F0FF]' :
                          tier.tier === 2 ? 'bg-[#A855F7]/20 text-[#A855F7]' :
                          'bg-[#F97316]/20 text-[#F97316]'
                        }`}>
                          {tier.tier}
                        </div>
                        <div>
                          <div className="font-bold text-lg">{tier.name}</div>
                          <div className="text-[#94A3B8] text-sm">{tier.users} Users</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold text-xl">${tier.earnings?.toLocaleString() || 0}</div>
                        <div className="text-[#94A3B8] text-sm">Earned</div>
                      </div>
                    </div>

                    {tier.members && tier.members.length > 0 ? (
                      <div className="p-4 max-h-48 overflow-y-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-[#64748B] text-xs uppercase">
                              <th className="text-left pb-2">User</th>
                              <th className="text-left pb-2">Joined</th>
                              <th className="text-right pb-2">Volume</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B]">
                            {tier.members.slice(0, 10).map((member, i) => (
                              <tr key={i} className="text-sm">
                                <td className="py-2 text-white">{member.username}</td>
                                <td className="py-2 text-[#94A3B8]">
                                  {new Date(member.joinedAt).toLocaleDateString()}
                                </td>
                                <td className="py-2 text-right text-[#00F0FF]">
                                  ${member.volume?.toLocaleString() || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {tier.members.length > 10 && (
                          <div className="text-center text-[#94A3B8] text-sm py-2 border-t border-[#1E293B] mt-2">
                            +{tier.members.length - 10} more members
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-[#94A3B8]">
                        <div className="text-4xl mb-2">👥</div>
                        <p>No referrals in this tier yet.</p>
                        <p className="text-sm">Share your link to grow your network!</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div>
                <div className="bg-[#0A0E17] rounded-xl border border-[#1E293B] overflow-hidden">
                  <div className="p-5 border-b border-[#1E293B]">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <span>🏆</span> Top Affiliates
                    </h3>
                  </div>
                  
                  {leaderboard.length > 0 ? (
                    <div className="divide-y divide-[#1E293B]">
                      {leaderboard.map((entry, index) => (
                        <div key={index} className={`p-4 flex items-center gap-4 ${
                          index < 3 ? 'bg-gradient-to-r from-[#1E293B]/50 to-transparent' : ''
                        }`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            index === 1 ? 'bg-gray-400/20 text-gray-400' :
                            index === 2 ? 'bg-orange-600/20 text-orange-600' :
                            'bg-[#1E293B] text-[#94A3B8]'
                          }`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-white">{entry.username}</div>
                            <div className="text-[#94A3B8] text-sm">{entry.referrals} referrals</div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 font-bold">${entry.totalEarned?.toLocaleString() || 0}</div>
                            <div className="text-[#64748B] text-xs">Total Earned</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-[#94A3B8]">
                      <div className="text-4xl mb-2">🏆</div>
                      <p>No leaderboard data yet.</p>
                      <p className="text-sm">Be the first to climb the ranks!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-[#00F0FF]/20 via-[#A855F7]/20 to-[#F97316]/20 rounded-2xl p-8 border border-[#00F0FF]/30 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3">🚀 Grow Your Empire</h2>
            <p className="text-[#94A3B8] mb-6 text-lg max-w-2xl mx-auto">
              Earn up to <span className="text-[#00F0FF] font-bold">12%</span> on Tier 1,{' '}
              <span className="text-[#A855F7] font-bold">5%</span> on Tier 2, and{' '}
              <span className="text-[#F97316] font-bold">2.5%</span> on Tier 3 referrals!
              Unlimited earning potential.
            </p>
            <button
              onClick={handleCopyLink}
              className="px-10 py-4 bg-gradient-to-r from-[#00F0FF] to-[#A855F7] text-[#0A0E17] rounded-xl font-bold text-lg hover:shadow-[0_0_40px_rgba(0,240,255,0.5)] transition-all"
            >
              📋 COPY REFERRAL LINK
            </button>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
    </MainLayout>
  );
}
