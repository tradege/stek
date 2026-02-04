'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
  members: Array<{
    username: string;
    joinedAt: string;
    referrals?: number;
    referredBy?: string;
  }>;
}

interface CommissionHistory {
  history: Array<{ date: string; amount: number }>;
  total: number;
}

export default function AffiliatesPage() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [network, setNetwork] = useState<{ tiers: NetworkTier[]; totalUsers: number; totalEarnings: number } | null>(null);
  const [history, setHistory] = useState<CommissionHistory | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'network'>('overview');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000';

  useEffect(() => {
    if (token) {
      fetchAffiliateData();
    }
  }, [token]);

  const fetchAffiliateData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, networkRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/affiliates/stats`, { headers }),
        fetch(`${API_URL}/affiliates/network`, { headers }),
        fetch(`${API_URL}/affiliates/history`, { headers }),
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
    } catch (error) {
      console.error('Failed to fetch affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (stats?.referralLink) {
      navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E17] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00F0FF]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white p-4 md:p-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Section A: Hero - Rank & Progress */}
        <div className="bg-[#131B2C] rounded-xl p-8 border border-[#1E293B]">
          <div className="text-center mb-8">
            <div 
              className="text-8xl mb-4"
              style={{ textShadow: `0 0 30px ${stats?.currentRank.color}` }}
            >
              {stats?.currentRank.icon}
            </div>
            <h1 
              className="text-4xl font-bold mb-2"
              style={{ color: stats?.currentRank.color }}
            >
              {stats?.currentRank.name.toUpperCase()}
            </h1>
            <p className="text-[#94A3B8]">Your Current Affiliate Rank</p>
          </div>

          {/* Commission Rates */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
              <div className="text-[#00F0FF] text-2xl font-bold">{stats?.currentRank.tier1Rate}</div>
              <div className="text-[#94A3B8] text-sm">Tier 1 Rate</div>
            </div>
            <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
              <div className="text-[#00F0FF] text-2xl font-bold">{stats?.currentRank.tier2Rate}</div>
              <div className="text-[#94A3B8] text-sm">Tier 2 Rate</div>
            </div>
            <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
              <div className="text-[#00F0FF] text-2xl font-bold">{stats?.currentRank.tier3Rate}</div>
              <div className="text-[#94A3B8] text-sm">Tier 3 Rate</div>
            </div>
          </div>

          {/* Progress Bar */}
          {stats?.nextRank && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#94A3B8]">Progress to {stats.nextRank.icon} {stats.nextRank.name}</span>
                <span className="text-[#00F0FF]">{stats.rankProgress.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-[#0A0E17] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.rankProgress.percentage}%`,
                    background: `linear-gradient(90deg, ${stats.currentRank.color}, #00F0FF)`,
                    boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
                  }}
                />
              </div>
              <p className="text-center mt-4 text-[#94A3B8]">
                🎯 <span className="text-white">Unlock {stats.nextRank.name} Tier!</span> Wager{' '}
                <span className="text-[#00F0FF] font-bold">${stats.nextRank.volumeRemaining.toLocaleString()}</span> more.
              </p>
            </div>
          )}
        </div>

        {/* Section B: Tools */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Referral Link */}
          <div className="bg-[#131B2C] rounded-xl p-6 border border-[#1E293B]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🔗 Your Referral Link
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={stats?.referralLink || ''}
                readOnly
                className="flex-1 bg-[#0A0E17] border border-[#1E293B] rounded-lg px-4 py-3 text-[#94A3B8] text-sm"
              />
              <button
                onClick={handleCopyLink}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-[#00F0FF] text-[#0A0E17] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                }`}
              >
                {copied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
            <p className="text-[#94A3B8] text-sm mt-3">
              Share this link to earn commissions on every bet your referrals make!
            </p>
          </div>

          {/* Commission Wallet */}
          <div className="bg-[#131B2C] rounded-xl p-6 border border-[#1E293B]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              💰 Commission Wallet
            </h2>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[#94A3B8] text-sm">Available to Claim</div>
                <div className="text-3xl font-bold text-[#00F0FF]">
                  ${stats?.availableCommission.toLocaleString() || '0.00'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[#94A3B8] text-sm">Total Earned</div>
                <div className="text-xl font-bold text-white">
                  ${stats?.totalEarned.toLocaleString() || '0.00'}
                </div>
              </div>
            </div>
            <button
              onClick={handleClaimCommission}
              disabled={claiming || !stats?.availableCommission || stats.availableCommission <= 0}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                stats?.availableCommission && stats.availableCommission > 0
                  ? 'bg-green-500 hover:bg-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                  : 'bg-[#1E293B] text-[#94A3B8] cursor-not-allowed'
              }`}
            >
              {claiming ? 'CLAIMING...' : '💸 CLAIM TO WALLET'}
            </button>
          </div>
        </div>

        {/* Section C: The Empire */}
        <div className="bg-[#131B2C] rounded-xl border border-[#1E293B] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#1E293B]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-4 px-6 font-bold transition-all ${
                activeTab === 'overview'
                  ? 'text-[#00F0FF] border-b-2 border-[#00F0FF] bg-[#0A0E17]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('network')}
              className={`flex-1 py-4 px-6 font-bold transition-all ${
                activeTab === 'network'
                  ? 'text-[#00F0FF] border-b-2 border-[#00F0FF] bg-[#0A0E17]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              👥 My Network
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-white">{stats?.networkStats.total || 0}</div>
                    <div className="text-[#94A3B8] text-sm">Total Referrals</div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-[#00F0FF]">${stats?.totalNetworkVolume.toLocaleString() || 0}</div>
                    <div className="text-[#94A3B8] text-sm">Network Volume</div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">${stats?.totalEarned.toLocaleString() || 0}</div>
                    <div className="text-[#94A3B8] text-sm">Total Earned</div>
                  </div>
                  <div className="bg-[#0A0E17] rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-400">${history?.total.toLocaleString() || 0}</div>
                    <div className="text-[#94A3B8] text-sm">Last 30 Days</div>
                  </div>
                </div>

                {/* Commission Chart */}
                <div>
                  <h3 className="text-lg font-bold mb-4">Commission History (30 Days)</h3>
                  <div className="h-48 bg-[#0A0E17] rounded-lg p-4 flex items-end gap-1">
                    {history?.history.slice(-30).map((day, i) => {
                      const maxAmount = Math.max(...(history?.history.map(h => h.amount) || [1]));
                      const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-[#00F0FF] to-[#00F0FF]/50 rounded-t transition-all hover:from-[#00F0FF] hover:to-[#00F0FF]"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${day.date}: $${day.amount}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className="space-y-6">
                {network?.tiers.map((tier) => (
                  <div key={tier.tier} className="bg-[#0A0E17] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          tier.tier === 1 ? 'bg-[#00F0FF]/20 text-[#00F0FF]' :
                          tier.tier === 2 ? 'bg-purple-500/20 text-purple-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {tier.tier}
                        </div>
                        <div>
                          <div className="font-bold">{tier.name}</div>
                          <div className="text-[#94A3B8] text-sm">{tier.users} Users</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">${tier.earnings.toLocaleString()}</div>
                        <div className="text-[#94A3B8] text-sm">Earned</div>
                      </div>
                    </div>

                    {tier.members.length > 0 && (
                      <div className="border-t border-[#1E293B] pt-4 mt-4">
                        <div className="grid gap-2 max-h-40 overflow-y-auto">
                          {tier.members.slice(0, 10).map((member, i) => (
                            <div key={i} className="flex items-center justify-between text-sm py-1">
                              <span className="text-white">{member.username}</span>
                              <span className="text-[#94A3B8]">
                                {new Date(member.joinedAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                          {tier.members.length > 10 && (
                            <div className="text-center text-[#94A3B8] text-sm py-2">
                              +{tier.members.length - 10} more members
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {tier.users === 0 && (
                      <div className="text-center text-[#94A3B8] py-4">
                        No referrals in this tier yet. Share your link to grow your network!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-gradient-to-r from-[#00F0FF]/20 to-purple-500/20 rounded-xl p-6 border border-[#00F0FF]/30 text-center">
          <h2 className="text-2xl font-bold mb-2">🚀 Grow Your Empire</h2>
          <p className="text-[#94A3B8] mb-4">
            Earn up to <span className="text-[#00F0FF] font-bold">12%</span> on Tier 1,{' '}
            <span className="text-purple-400 font-bold">5%</span> on Tier 2, and{' '}
            <span className="text-orange-400 font-bold">2.5%</span> on Tier 3 referrals!
          </p>
          <button
            onClick={handleCopyLink}
            className="px-8 py-3 bg-[#00F0FF] text-[#0A0E17] rounded-lg font-bold hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all"
          >
            📋 COPY REFERRAL LINK
          </button>
        </div>
      </div>
    </div>
  );
}
