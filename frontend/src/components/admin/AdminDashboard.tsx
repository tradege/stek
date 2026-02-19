'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import config from '@/config/api';

interface RealStats {
  totalRealUsers: number;
  activeRealUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netDeposits: number;
  totalBets: number;
  totalWagered: number;
  houseProfit: number;
  houseWallet: number;
  botVolume: number;
  botBets: number;
  activeBots: number;
}

interface GameConfig {
  houseEdge: number;
  instantBust: number;
  botsEnabled: boolean;
  maxBotBet: number;
  minBotBet: number;
  maxBotsPerRound: number;
}

const API_URL = config.apiUrl;

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<RealStats | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/real-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      // 'Failed to fetch stats:', err);
    }
  };

  // Fetch game config
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/game/config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        setConfig(result.data || result);
      }
    } catch (err) {
      // 'Failed to fetch config:', err);
    }
  };

  // Update game config
  const updateConfig = async (updates: Partial<GameConfig>) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/game/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const result = await response.json();
        setConfig(result.data || result);
      }
    } catch (err) {
      // 'Failed to update config:', err);
      setError('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (token) {
      setLoading(true);
      Promise.all([fetchStats(), fetchConfig()]).finally(() => setLoading(false));
      
      // Refresh stats every 30 seconds
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-main">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00ff88]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#00ff88]">🎮 God Mode Dashboard</h1>
          <p className="text-text-secondary mt-2">Real-time casino analytics and game controls</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Real Profit Card */}
          <div className="bg-gradient-to-br from-bg-card to-bg-main rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-text-secondary text-sm">Real Profit</span>
              <span className="text-[#00ff88] text-xs px-2 py-1 bg-[#00ff88]/10 rounded">LIVE</span>
            </div>
            <div className={`text-3xl font-bold ${(stats?.houseProfit || 0) >= 0 ? 'text-[#00ff88]' : 'text-red-500'}`}>
              ${(stats?.houseProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-text-tertiary text-xs mt-2">House wallet from real users</p>
          </div>

          {/* Total Wagered Card */}
          <div className="bg-gradient-to-br from-bg-card to-bg-main rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-text-secondary text-sm">Total Wagered</span>
              <span className="text-blue-400 text-xs px-2 py-1 bg-blue-400/10 rounded">REAL</span>
            </div>
            <div className="text-3xl font-bold text-white">
              ${(stats?.totalWagered || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-text-tertiary text-xs mt-2">{stats?.totalBets || 0} total bets</p>
          </div>

          {/* Bot Volume Card */}
          <div className="bg-gradient-to-br from-bg-card to-bg-main rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-text-secondary text-sm">Bot Volume</span>
              <span className="text-text-tertiary text-xs px-2 py-1 bg-gray-500/10 rounded">SIMULATED</span>
            </div>
            <div className="text-3xl font-bold text-text-secondary">
              ${(stats?.botVolume || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-text-tertiary text-xs mt-2">{stats?.activeBots || 0} active bots</p>
          </div>

          {/* Real Users Card */}
          <div className="bg-gradient-to-br from-bg-card to-bg-main rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-text-secondary text-sm">Real Users</span>
              <span className="text-accent-primary text-xs px-2 py-1 bg-purple-400/10 rounded">USERS</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {stats?.totalRealUsers || 0}
            </div>
            <p className="text-text-tertiary text-xs mt-2">{stats?.activeRealUsers || 0} active (24h)</p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-bg-card to-bg-main rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold mb-4 text-white">💰 Financial Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-text-secondary">Total Deposits</span>
                <span className="text-[#00ff88] font-semibold">
                  ${(stats?.totalDeposits || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-text-secondary">Total Withdrawals</span>
                <span className="text-red-400 font-semibold">
                  ${(stats?.totalWithdrawals || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-text-secondary">Net Deposits</span>
                <span className={`font-semibold ${(stats?.netDeposits || 0) >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>
                  ${(stats?.netDeposits || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Game Controls */}
          <div className="bg-gradient-to-br from-bg-card to-bg-main rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold mb-4 text-white">🎮 Game Controls</h3>
            
            {config && (
              <div className="space-y-6">
                {/* House Edge Slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-text-secondary text-sm">House Edge</label>
                    <span className="text-[#00ff88] font-semibold">{config.houseEdge.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={config.houseEdge}
                    onChange={(e) => updateConfig({ houseEdge: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00ff88]"
                    disabled={saving}
                  />
                  <div className="flex justify-between text-xs text-text-tertiary mt-1">
                    <span>1%</span>
                    <span>10%</span>
                  </div>
                </div>

                {/* Instant Bust Slider */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-text-secondary text-sm">Instant Bust Chance</label>
                    <span className="text-orange-400 font-semibold">{config.instantBust.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={config.instantBust}
                    onChange={(e) => updateConfig({ instantBust: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-400"
                    disabled={saving}
                  />
                  <div className="flex justify-between text-xs text-text-tertiary mt-1">
                    <span>0%</span>
                    <span>5%</span>
                  </div>
                </div>

                {/* Bots Toggle */}
                <div className="flex justify-between items-center py-3 border-t border-white/10">
                  <div>
                    <span className="text-text-secondary text-sm">Ghost Bots</span>
                    <p className="text-text-tertiary text-xs">Simulated players in Live Bets</p>
                  </div>
                  <button
                    onClick={() => updateConfig({ botsEnabled: !config.botsEnabled })}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.botsEnabled ? 'bg-[#00ff88]' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.botsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Max Bots Per Round */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-text-secondary text-sm">Max Bots Per Round</label>
                    <span className="text-blue-400 font-semibold">{config.maxBotsPerRound}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={config.maxBotsPerRound}
                    onChange={(e) => updateConfig({ maxBotsPerRound: parseInt(e.target.value) })}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
                    disabled={saving || !config.botsEnabled}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-bg-card rounded-xl p-4 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></div>
              <span className="text-text-secondary text-sm">System Online</span>
            </div>
            <div className="text-text-tertiary text-sm">|</div>
            <span className="text-text-secondary text-sm">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => { fetchStats(); fetchConfig(); }}
            className="px-4 py-2 bg-[#00ff88]/10 text-[#00ff88] rounded-lg hover:bg-[#00ff88]/20 transition-colors text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
