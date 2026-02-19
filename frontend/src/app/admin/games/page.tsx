'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Gamepad2, Settings, TrendingUp, Shield, 
  ToggleLeft, ToggleRight, Save, RefreshCw,
  Dice1, Target, Bomb, Rocket, AlertTriangle,
  Zap, Flame, Spade, Crown, Hash, Goal, Swords
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface GameConfig {
  houseEdge: number;
  instantBust: number;
  botsEnabled: boolean;
  maxBotBet: number;
  minBotBet: number;
  maxBotsPerRound: number;
}

interface GameStatData {
  gameType: string;
  totalBets: number;
  totalWagered: number;
  totalPayout: number;
  ggr: number;
}

const GAME_META: Record<string, { name: string; icon: string; color: string; description: string; algo: string }> = {
  CRASH: { name: 'Crash', icon: '🚀', color: 'text-red-400', description: 'Multiplier game with real-time graph', algo: 'ICDF Exponential' },
  MINES: { name: 'Mines', icon: '💣', color: 'text-yellow-400', description: '5x5 grid mine sweeper with progressive multipliers', algo: 'Fisher-Yates Shuffle' },
  PLINKO: { name: 'Plinko', icon: '🎯', color: 'text-blue-400', description: 'Ball drop game with configurable rows and risk', algo: 'Galton Board Simulation' },
  DICE: { name: 'Dice', icon: '🎲', color: 'text-green-400', description: 'Classic dice roll with over/under prediction', algo: 'HMAC-SHA256 Roll' },
  LIMBO: { name: 'Limbo', icon: '⚡', color: 'text-pink-400', description: 'Instant multiplier game with target prediction', algo: 'ICDF Exponential' },
  KENO: { name: 'Keno', icon: '#️⃣', color: 'text-indigo-400', description: 'Number selection lottery game', algo: 'Fisher-Yates Selection' },
  CARD_RUSH: { name: 'Card Rush', icon: '🃏', color: 'text-orange-400', description: 'Fast-paced card matching game', algo: 'HMAC-SHA256 Deck' },
  NOVA_RUSH: { name: 'Nova Rush', icon: '🌟', color: 'text-amber-400', description: 'Space-themed crash variant', algo: 'ICDF Exponential' },
  DRAGON_BLAZE: { name: 'Dragon Blaze', icon: '🐉', color: 'text-red-500', description: 'Dragon-themed crash variant', algo: 'ICDF Exponential' },
  PENALTY_SHOOTOUT: { name: 'Penalty Shootout', icon: '⚽', color: 'text-emerald-400', description: 'Football penalty kick game', algo: 'HMAC-SHA256 Direction' },
  OLYMPUS: { name: 'Gates of Olympus', icon: '⚡', color: 'text-purple-400', description: 'Slot-style game with cascading wins', algo: 'RNG Slot Engine' },
  BLACKJACK: { name: 'Blackjack', icon: '🂡', color: 'text-emerald-400', description: 'Classic 21 card game', algo: 'Fisher-Yates Deck Shuffle' },
};

export default function AdminGames() {
  const { user } = useAuth();
  const router = useRouter();
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [editConfig, setEditConfig] = useState<GameConfig | null>(null);
  const [gameStats, setGameStats] = useState<GameStatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'crash' | 'settings'>('overview');

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    fetchConfig();
    fetchGameStats();
  }, [user]);

  const getToken = () => localStorage.getItem('auth_token');

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/game/config`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGameConfig(data.data);
        setEditConfig(data.data);
      }
    } catch (err) {
      // Failed to fetch config
    } finally {
      setLoading(false);
    }
  };

  const fetchGameStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/finance/stats`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.perGameStats) {
          setGameStats(data.perGameStats);
        }
      }
    } catch {}
  };

  const saveConfig = async () => {
    if (!editConfig) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/game/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(editConfig),
      });
      if (res.ok) {
        const data = await res.json();
        setGameConfig(data.data);
        setEditConfig(data.data);
        setMessage({ type: 'success', text: 'Configuration saved! Changes take effect on next round.' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  // Merge game stats with game meta
  const allGameTypes = Object.keys(GAME_META);
  const statsMap = new Map(gameStats.map(g => [g.gameType, g]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Control Center</h1>
          <p className="text-text-secondary">Manage all {allGameTypes.length} games, RTP, house edge, and bot settings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchConfig(); fetchGameStats(); }}
            className="px-4 py-2 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-white/10 rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-1">Total Games</div>
          <div className="text-2xl font-bold text-white">{allGameTypes.length}</div>
          <div className="text-xs text-green-400 mt-1">{gameStats.filter(g => g.totalBets > 0).length} with activity</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-1">Total Bets</div>
          <div className="text-2xl font-bold text-cyan-400">{gameStats.reduce((s, g) => s + g.totalBets, 0).toLocaleString()}</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-1">Total Wagered</div>
          <div className="text-2xl font-bold text-blue-400">{fmt(gameStats.reduce((s, g) => s + g.totalWagered, 0))}</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-1">Total GGR</div>
          <div className="text-2xl font-bold text-green-400">{fmt(gameStats.reduce((s, g) => s + g.ggr, 0))}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-main p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Games Overview', icon: Gamepad2 },
          { id: 'crash', label: 'Crash Settings', icon: Rocket },
          { id: 'settings', label: 'Global Settings', icon: Settings },
        ].map((tab) => (
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

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Games Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Games Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allGameTypes.map((gt) => {
              const meta = GAME_META[gt];
              const stats = statsMap.get(gt);
              const hasActivity = stats && stats.totalBets > 0;
              return (
                <div key={gt} className="bg-bg-card border border-white/10 rounded-xl p-5 hover:border-accent-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{meta.icon}</div>
                      <div>
                        <h3 className={`text-lg font-bold ${meta.color}`}>{meta.name}</h3>
                        <p className="text-xs text-text-tertiary">{meta.description}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-bg-main rounded-lg p-2">
                      <div className="text-[10px] text-text-tertiary">Bets</div>
                      <div className="text-sm font-bold text-white">{stats?.totalBets?.toLocaleString() || '0'}</div>
                    </div>
                    <div className="bg-bg-main rounded-lg p-2">
                      <div className="text-[10px] text-text-tertiary">Wagered</div>
                      <div className="text-sm font-bold text-cyan-400">{fmt(stats?.totalWagered || 0)}</div>
                    </div>
                    <div className="bg-bg-main rounded-lg p-2">
                      <div className="text-[10px] text-text-tertiary">Payouts</div>
                      <div className="text-sm font-bold text-orange-400">{fmt(stats?.totalPayout || 0)}</div>
                    </div>
                    <div className="bg-bg-main rounded-lg p-2">
                      <div className="text-[10px] text-text-tertiary">GGR</div>
                      <div className={`text-sm font-bold ${(stats?.ggr || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(stats?.ggr || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] text-green-400">Provably Fair</span>
                    </div>
                    <span className="text-[10px] text-text-tertiary font-mono">{meta.algo}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Stats Table */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">Per-Game Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary text-xs border-b border-white/10">
                    <th className="text-left py-3 px-2">Game</th>
                    <th className="text-right py-3 px-2">Bets</th>
                    <th className="text-right py-3 px-2">Wagered</th>
                    <th className="text-right py-3 px-2">Payouts</th>
                    <th className="text-right py-3 px-2">GGR</th>
                    <th className="text-right py-3 px-2">RTP</th>
                    <th className="text-center py-3 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allGameTypes.map((gt) => {
                    const meta = GAME_META[gt];
                    const stats = statsMap.get(gt);
                    const rtp = stats && stats.totalWagered > 0
                      ? ((stats.totalPayout / stats.totalWagered) * 100).toFixed(2)
                      : '-';
                    return (
                      <tr key={gt} className="border-b border-white/10/50 hover:bg-bg-main/50">
                        <td className="py-3 px-2">
                          <span className="mr-2">{meta.icon}</span>
                          <span className={`font-medium ${meta.color}`}>{meta.name}</span>
                        </td>
                        <td className="py-3 px-2 text-right text-white font-mono">{(stats?.totalBets || 0).toLocaleString()}</td>
                        <td className="py-3 px-2 text-right text-cyan-400 font-mono">{fmt(stats?.totalWagered || 0)}</td>
                        <td className="py-3 px-2 text-right text-orange-400 font-mono">{fmt(stats?.totalPayout || 0)}</td>
                        <td className={`py-3 px-2 text-right font-mono font-bold ${(stats?.ggr || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(stats?.ggr || 0)}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300 font-mono">{rtp}%</td>
                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Crash Settings Tab */}
      {activeTab === 'crash' && editConfig && (
        <div className="space-y-4">
          {/* House Edge */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-primary" />
              House Edge Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">House Edge (%)</label>
                <input
                  type="number"
                  value={editConfig.houseEdge}
                  onChange={(e) => setEditConfig({ ...editConfig, houseEdge: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-bg-main border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                  min="0"
                  max="20"
                  step="0.5"
                />
                <p className="text-xs text-text-tertiary mt-1">Default: 4%. Range: 0-20%</p>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Instant Bust Rate (%)</label>
                <input
                  type="number"
                  value={editConfig.instantBust}
                  onChange={(e) => setEditConfig({ ...editConfig, instantBust: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-bg-main border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                  min="0"
                  max="20"
                  step="0.5"
                />
                <p className="text-xs text-text-tertiary mt-1">Chance of 1.00x crash. Default: 4%</p>
              </div>
            </div>
          </div>

          {/* Bot Configuration */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-accent-primary" />
              Bot Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Bots Enabled</label>
                <button
                  onClick={() => setEditConfig({ ...editConfig, botsEnabled: !editConfig.botsEnabled })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    editConfig.botsEnabled
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {editConfig.botsEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  {editConfig.botsEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Min Bot Bet ($)</label>
                <input
                  type="number"
                  value={editConfig.minBotBet}
                  onChange={(e) => setEditConfig({ ...editConfig, minBotBet: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-bg-main border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Max Bot Bet ($)</label>
                <input
                  type="number"
                  value={editConfig.maxBotBet}
                  onChange={(e) => setEditConfig({ ...editConfig, maxBotBet: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-bg-main border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-sm text-text-secondary mb-2 block">Max Bots Per Round</label>
              <input
                type="number"
                value={editConfig.maxBotsPerRound}
                onChange={(e) => setEditConfig({ ...editConfig, maxBotsPerRound: parseInt(e.target.value) || 0 })}
                className="w-full md:w-1/3 bg-bg-main border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-accent-primary focus:outline-none"
                min="0"
                max="50"
              />
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium text-sm">Configuration Warning</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                Changes to house edge and instant bust rate will take effect on the next round. 
                Modifying these values affects the mathematical fairness of the game. 
                Ensure all changes comply with your gaming license requirements.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-6 py-3 bg-accent-primary hover:bg-[#1265c1] rounded-lg text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Global Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">Global Game Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-bg-main rounded-lg p-4">
                <div className="text-sm text-text-secondary mb-1">Default Currency</div>
                <div className="text-white font-bold">USDT (Tether)</div>
              </div>
              <div className="bg-bg-main rounded-lg p-4">
                <div className="text-sm text-text-secondary mb-1">Minimum Bet</div>
                <div className="text-white font-bold">$0.01</div>
              </div>
              <div className="bg-bg-main rounded-lg p-4">
                <div className="text-sm text-text-secondary mb-1">Maximum Bet</div>
                <div className="text-white font-bold">$10,000</div>
              </div>
              <div className="bg-bg-main rounded-lg p-4">
                <div className="text-sm text-text-secondary mb-1">Provably Fair</div>
                <div className="text-green-400 font-bold flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Enabled (All Games)
                </div>
              </div>
              <div className="bg-bg-main rounded-lg p-4">
                <div className="text-sm text-text-secondary mb-1">Rate Limiting</div>
                <div className="text-white font-bold">500ms between bets</div>
              </div>
              <div className="bg-bg-main rounded-lg p-4">
                <div className="text-sm text-text-secondary mb-1">Atomic Transactions</div>
                <div className="text-green-400 font-bold flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Row Locking Enabled
                </div>
              </div>
            </div>
          </div>

          {/* Active Games Summary Table */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">All In-House Games</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary text-xs border-b border-white/10">
                    <th className="text-left py-3 px-2">Game</th>
                    <th className="text-center py-3 px-2">Status</th>
                    <th className="text-center py-3 px-2">Provably Fair</th>
                    <th className="text-center py-3 px-2">Algorithm</th>
                  </tr>
                </thead>
                <tbody>
                  {allGameTypes.map((gt) => {
                    const meta = GAME_META[gt];
                    return (
                      <tr key={gt} className="border-b border-white/10/50 hover:bg-bg-main/50">
                        <td className="py-3 px-2">
                          <span className="mr-2">{meta.icon}</span>
                          <span className={`font-medium ${meta.color}`}>{meta.name}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                        </td>
                        <td className="py-3 px-2 text-center text-green-400">Verified</td>
                        <td className="py-3 px-2 text-center text-gray-300 font-mono text-xs">{meta.algo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
