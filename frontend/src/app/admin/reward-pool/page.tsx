'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  Trophy, Settings, Save, RefreshCw, CheckCircle, AlertTriangle,
  DollarSign, Users, Calendar, TrendingUp, Award, Clock,
  Play, Zap, Target, BarChart3, Gift, Crown
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface RewardSettings {
  weeklyBonusEnabled: boolean;
  monthlyBonusEnabled: boolean;
  poolContributionRate: number;
  weeklyPoolPercent: number;
  monthlyPoolPercent: number;
  firstPlacePercent: number;
  secondPlacePercent: number;
  thirdPlacePercent: number;
  weeklyPoolCap: number;
  monthlyPoolCap: number;
  minWageringForBonus: number;
  weeklyCooldownHours: number;
  monthlyCooldownHours: number;
  topPlayersCount: number;
}

interface PoolStatus {
  totalAccumulated: number;
  totalDistributed: number;
  currentBalance: number;
  lastWeeklyDistribution: string | null;
  lastMonthlyDistribution: string | null;
}

interface TopPlayer {
  rank: number;
  userId: string;
  email: string;
  username: string;
  vipLevel: number;
  vipTier: string;
  totalWagered: number;
  totalBets: number;
  projectedReward: number;
  splitPercent: number;
}

interface TopPlayersData {
  weekly: TopPlayer[];
  monthly: TopPlayer[];
  weeklyBudget: number;
  monthlyBudget: number;
  poolBalance: number;
}

interface DistributionRecord {
  id: string;
  userId: string;
  email: string;
  username: string;
  type: string;
  amount: number;
  source: string;
  description: string;
  metadata: any;
  createdAt: string;
}

export default function RewardPoolPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'leaderboard' | 'history'>('overview');
  const [settings, setSettings] = useState<RewardSettings>({
    weeklyBonusEnabled: true,
    monthlyBonusEnabled: true,
    poolContributionRate: 0.05,
    weeklyPoolPercent: 0.60,
    monthlyPoolPercent: 0.40,
    firstPlacePercent: 0.50,
    secondPlacePercent: 0.30,
    thirdPlacePercent: 0.20,
    weeklyPoolCap: 500,
    monthlyPoolCap: 2000,
    minWageringForBonus: 10,
    weeklyCooldownHours: 144,
    monthlyCooldownHours: 648,
    topPlayersCount: 3,
  });
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayersData | null>(null);
  const [history, setHistory] = useState<DistributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distributing, setDistributing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      router.push('/');
    } else {
      fetchAll();
    }
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchPoolStatus(), fetchTopPlayers(), fetchHistory()]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rewards/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) {
          setSettings(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchPoolStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rewards/pool-status`);
      if (res.ok) {
        const data = await res.json();
        setPoolStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch pool status:', err);
    }
  };

  const fetchTopPlayers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rewards/top-players`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.error) setTopPlayers(data);
      }
    } catch (err) {
      console.error('Failed to fetch top players:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/rewards/distribution-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/rewards/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: 'success', text: 'Reward pool settings saved successfully!' });
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
        }
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error while saving settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleDistribute = async (type: 'weekly' | 'monthly') => {
    if (!confirm(`Are you sure you want to trigger ${type} distribution now?`)) return;
    setDistributing(type);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/rewards/distribute-${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.distributed > 0) {
          setMessage({ type: 'success', text: `${type === 'weekly' ? 'Weekly' : 'Monthly'} distribution complete: $${data.distributed.toFixed(2)} to ${data.recipients} player(s)` });
        } else {
          const reason = data.details?.[0]?.error || 'No eligible players or cooldown active';
          setMessage({ type: 'error', text: `Distribution skipped: ${reason}` });
        }
        await fetchAll();
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to trigger ${type} distribution` });
    } finally {
      setDistributing(null);
    }
  };

  const ToggleSwitch = ({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-gray-300 text-sm">{label}</span>
      <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          enabled ? 'bg-green-500' : 'bg-gray-600'
        }`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Award className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm text-gray-400">#{rank}</span>;
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'history', label: 'History', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Reward Pool</h1>
          <p className="text-text-secondary">Manage reward pool settings, distributions, and leaderboards</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchAll}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {activeTab === 'settings' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-accent-primary hover:bg-[#1265c1] rounded-lg text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-main p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-accent-primary text-white'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================ */}
      {/* OVERVIEW TAB */}
      {/* ============================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Pool Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-bg-card border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Current Balance</p>
                  <p className="text-2xl font-bold text-green-400">${poolStatus?.currentBalance?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Total Accumulated</p>
                  <p className="text-2xl font-bold text-blue-400">${poolStatus?.totalAccumulated?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Total Distributed</p>
                  <p className="text-2xl font-bold text-purple-400">${poolStatus?.totalDistributed?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary">Top Players Count</p>
                  <p className="text-2xl font-bold text-yellow-400">{settings.topPlayersCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly */}
            <div className="bg-bg-card border border-white/10 rounded-xl p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent-primary" />
                Weekly Distribution
              </h3>
              <div className="space-y-3">
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Status</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    settings.weeklyBonusEnabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {settings.weeklyBonusEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Pool Share</span>
                  <span className="text-white text-sm font-mono">{(settings.weeklyPoolPercent * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Budget</span>
                  <span className="text-white text-sm font-mono">${topPlayers?.weeklyBudget?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Cap</span>
                  <span className="text-white text-sm font-mono">${settings.weeklyPoolCap.toFixed(0)}</span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Last Distribution</span>
                  <span className="text-white text-sm">{formatDate(poolStatus?.lastWeeklyDistribution || null)}</span>
                </div>
                <button
                  onClick={() => handleDistribute('weekly')}
                  disabled={distributing !== null || !settings.weeklyBonusEnabled}
                  className="w-full mt-2 px-4 py-2.5 bg-accent-primary/20 hover:bg-accent-primary/30 border border-accent-primary/30 rounded-lg text-accent-primary font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {distributing === 'weekly' ? 'Distributing...' : 'Trigger Weekly Distribution'}
                </button>
              </div>
            </div>

            {/* Monthly */}
            <div className="bg-bg-card border border-white/10 rounded-xl p-5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Monthly Distribution
              </h3>
              <div className="space-y-3">
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Status</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    settings.monthlyBonusEnabled
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {settings.monthlyBonusEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Pool Share</span>
                  <span className="text-white text-sm font-mono">{(settings.monthlyPoolPercent * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Budget</span>
                  <span className="text-white text-sm font-mono">${topPlayers?.monthlyBudget?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Cap</span>
                  <span className="text-white text-sm font-mono">${settings.monthlyPoolCap.toFixed(0)}</span>
                </div>
                <div className="bg-bg-main rounded-lg p-3 flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Last Distribution</span>
                  <span className="text-white text-sm">{formatDate(poolStatus?.lastMonthlyDistribution || null)}</span>
                </div>
                <button
                  onClick={() => handleDistribute('monthly')}
                  disabled={distributing !== null || !settings.monthlyBonusEnabled}
                  className="w-full mt-2 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {distributing === 'monthly' ? 'Distributing...' : 'Trigger Monthly Distribution'}
                </button>
              </div>
            </div>
          </div>

          {/* Revenue Flow Diagram */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-primary" />
              Revenue Flow
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
              <div className="bg-bg-main rounded-lg p-4 text-center">
                <div className="text-xs text-text-secondary mb-1">House Edge</div>
                <div className="text-white font-bold text-lg">4%</div>
                <div className="text-xs text-text-tertiary">of each bet</div>
              </div>
              <div className="text-center text-text-secondary hidden md:block">→</div>
              <div className="bg-bg-main rounded-lg p-4 text-center">
                <div className="text-xs text-text-secondary mb-1">Pool Contribution</div>
                <div className="text-accent-primary font-bold text-lg">{(settings.poolContributionRate * 100).toFixed(0)}%</div>
                <div className="text-xs text-text-tertiary">of house edge</div>
              </div>
              <div className="text-center text-text-secondary hidden md:block">→</div>
              <div className="bg-bg-main rounded-lg p-4 text-center">
                <div className="text-xs text-text-secondary mb-1">Per Bet Rate</div>
                <div className="text-green-400 font-bold text-lg">{(0.04 * settings.poolContributionRate * 100).toFixed(2)}%</div>
                <div className="text-xs text-text-tertiary">of wager amount</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* SETTINGS TAB */}
      {/* ============================================ */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Master Toggles */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-primary" />
              Master Controls
            </h3>
            <ToggleSwitch
              enabled={settings.weeklyBonusEnabled}
              onChange={() => setSettings({ ...settings, weeklyBonusEnabled: !settings.weeklyBonusEnabled })}
              label="Weekly Bonus Distribution"
            />
            <ToggleSwitch
              enabled={settings.monthlyBonusEnabled}
              onChange={() => setSettings({ ...settings, monthlyBonusEnabled: !settings.monthlyBonusEnabled })}
              label="Monthly Bonus Distribution"
            />
          </div>

          {/* Pool Configuration */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent-primary" />
              Pool Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Pool Contribution Rate (% of house edge)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.poolContributionRate}
                  onChange={(e) => setSettings({ ...settings, poolContributionRate: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">0.05 = 5% of house edge goes to pool</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Min Wagering for Bonus ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.minWageringForBonus}
                  onChange={(e) => setSettings({ ...settings, minWageringForBonus: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">Minimum wagered amount to qualify</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Top Players Count</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="10"
                  value={settings.topPlayersCount}
                  onChange={(e) => setSettings({ ...settings, topPlayersCount: parseInt(e.target.value) || 3 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">Number of top players to reward</p>
              </div>
            </div>
          </div>

          {/* Distribution Split */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-accent-primary" />
              Distribution Split (Weekly vs Monthly)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Weekly Pool % (of total pool)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.weeklyPoolPercent}
                  onChange={(e) => setSettings({ ...settings, weeklyPoolPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">0.60 = 60% of pool for weekly</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Monthly Pool % (of total pool)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.monthlyPoolPercent}
                  onChange={(e) => setSettings({ ...settings, monthlyPoolPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">0.40 = 40% of pool for monthly</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Weekly Pool Cap ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.weeklyPoolCap}
                  onChange={(e) => setSettings({ ...settings, weeklyPoolCap: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">Maximum weekly distribution amount</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Monthly Pool Cap ($)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.monthlyPoolCap}
                  onChange={(e) => setSettings({ ...settings, monthlyPoolCap: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">Maximum monthly distribution amount</p>
              </div>
            </div>
          </div>

          {/* Place Splits */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent-primary" />
              Prize Split (Top Players)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  1st Place %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.firstPlacePercent}
                  onChange={(e) => setSettings({ ...settings, firstPlacePercent: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">0.50 = 50% of budget</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block flex items-center gap-2">
                  <Award className="w-4 h-4 text-gray-300" />
                  2nd Place %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.secondPlacePercent}
                  onChange={(e) => setSettings({ ...settings, secondPlacePercent: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">0.30 = 30% of budget</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  3rd Place %
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.thirdPlacePercent}
                  onChange={(e) => setSettings({ ...settings, thirdPlacePercent: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">0.20 = 20% of budget</p>
              </div>
            </div>
            <div className="mt-3 bg-bg-main rounded-lg p-3">
              <p className="text-xs text-text-secondary">
                Total: {((settings.firstPlacePercent + settings.secondPlacePercent + settings.thirdPlacePercent) * 100).toFixed(0)}%
                {Math.abs(settings.firstPlacePercent + settings.secondPlacePercent + settings.thirdPlacePercent - 1) > 0.001 && (
                  <span className="text-yellow-400 ml-2">(Should equal 100%)</span>
                )}
              </p>
            </div>
          </div>

          {/* Cooldown Settings */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-primary" />
              Cooldown Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Weekly Cooldown (hours)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.weeklyCooldownHours}
                  onChange={(e) => setSettings({ ...settings, weeklyCooldownHours: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">144h = 6 days between weekly distributions</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Monthly Cooldown (hours)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.monthlyCooldownHours}
                  onChange={(e) => setSettings({ ...settings, monthlyCooldownHours: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-tertiary mt-1">648h = 27 days between monthly distributions</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* LEADERBOARD TAB */}
      {/* ============================================ */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {/* Weekly Leaderboard */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-primary" />
              Weekly Top Players
            </h3>
            <p className="text-xs text-text-secondary mb-4">Budget: ${topPlayers?.weeklyBudget?.toFixed(2) || '0.00'} (last 7 days)</p>
            {topPlayers?.weekly && topPlayers.weekly.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Rank</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Player</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">VIP</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Wagered</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Bets</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Split</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Projected Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayers.weekly.map((p) => (
                      <tr key={p.userId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3">{getRankIcon(p.rank)}</td>
                        <td className="py-3 px-3">
                          <div className="text-white text-sm font-medium">{p.username || 'Unknown'}</div>
                          <div className="text-text-tertiary text-xs">{p.email}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-accent-primary/20 text-accent-primary font-medium">
                            {p.vipTier}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-white text-sm font-mono">${p.totalWagered.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-text-secondary text-sm">{p.totalBets}</td>
                        <td className="py-3 px-3 text-right text-text-secondary text-sm">{(p.splitPercent * 100).toFixed(0)}%</td>
                        <td className="py-3 px-3 text-right text-green-400 text-sm font-bold">${p.projectedReward.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-text-secondary text-sm">No eligible players for weekly distribution</p>
              </div>
            )}
          </div>

          {/* Monthly Leaderboard */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Monthly Top Players
            </h3>
            <p className="text-xs text-text-secondary mb-4">Budget: ${topPlayers?.monthlyBudget?.toFixed(2) || '0.00'} (last 30 days)</p>
            {topPlayers?.monthly && topPlayers.monthly.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Rank</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Player</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">VIP</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Wagered</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Bets</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Split</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Projected Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayers.monthly.map((p) => (
                      <tr key={p.userId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3">{getRankIcon(p.rank)}</td>
                        <td className="py-3 px-3">
                          <div className="text-white text-sm font-medium">{p.username || 'Unknown'}</div>
                          <div className="text-text-tertiary text-xs">{p.email}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 font-medium">
                            {p.vipTier}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-white text-sm font-mono">${p.totalWagered.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-text-secondary text-sm">{p.totalBets}</td>
                        <td className="py-3 px-3 text-right text-text-secondary text-sm">{(p.splitPercent * 100).toFixed(0)}%</td>
                        <td className="py-3 px-3 text-right text-purple-400 text-sm font-bold">${p.projectedReward.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-text-secondary text-sm">No eligible players for monthly distribution</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* HISTORY TAB */}
      {/* ============================================ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-primary" />
              Distribution History
            </h3>
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Date</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Type</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Player</th>
                      <th className="text-right text-xs text-text-secondary font-medium py-2 px-3">Amount</th>
                      <th className="text-left text-xs text-text-secondary font-medium py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => (
                      <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 text-text-secondary text-sm whitespace-nowrap">
                          {formatDate(record.createdAt)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            record.type === 'WEEKLY_BONUS'
                              ? 'bg-accent-primary/20 text-accent-primary'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {record.type === 'WEEKLY_BONUS' ? 'Weekly' : 'Monthly'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-white text-sm font-medium">{record.username || 'Unknown'}</div>
                          <div className="text-text-tertiary text-xs">{record.email}</div>
                        </td>
                        <td className="py-3 px-3 text-right text-green-400 text-sm font-bold">${record.amount.toFixed(2)}</td>
                        <td className="py-3 px-3 text-text-secondary text-xs max-w-xs truncate">{record.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-text-secondary text-sm">No distribution history yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
