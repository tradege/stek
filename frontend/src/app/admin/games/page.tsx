'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Gamepad2, Settings, TrendingUp, Shield, 
  ToggleLeft, ToggleRight, Save, RefreshCw,
  Dice1, Target, Bomb, Rocket, AlertTriangle
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

interface GameStats {
  name: string;
  icon: React.ReactNode;
  status: 'active' | 'maintenance' | 'disabled';
  totalBets: number;
  totalWagered: number;
  houseProfit: number;
  houseEdge: number;
  description: string;
}

export default function AdminGames() {
  const { user } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [editConfig, setEditConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'crash' | 'settings'>('overview');

  const games: GameStats[] = [
    {
      name: 'Crash',
      icon: <Rocket className="w-6 h-6 text-red-400" />,
      status: 'active',
      totalBets: 0,
      totalWagered: 0,
      houseProfit: 0,
      houseEdge: 4,
      description: 'Multiplier game with real-time graph. Players bet and cash out before crash.',
    },
    {
      name: 'Plinko',
      icon: <Target className="w-6 h-6 text-blue-400" />,
      status: 'active',
      totalBets: 0,
      totalWagered: 0,
      houseProfit: 0,
      houseEdge: 4,
      description: 'Ball drop game with configurable rows and risk levels.',
    },
    {
      name: 'Dice',
      icon: <Dice1 className="w-6 h-6 text-green-400" />,
      status: 'active',
      totalBets: 0,
      totalWagered: 0,
      houseProfit: 0,
      houseEdge: 4,
      description: 'Classic dice roll game with over/under prediction.',
    },
    {
      name: 'Mines',
      icon: <Bomb className="w-6 h-6 text-yellow-400" />,
      status: 'active',
      totalBets: 0,
      totalWagered: 0,
      houseProfit: 0,
      houseEdge: 4,
      description: '5x5 grid mine sweeper with progressive multipliers.',
    },
  ];

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
        setConfig(data.data);
        setEditConfig(data.data);
      }
    } catch (err) {
      // 'Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGameStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Update game stats from real data if available
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
        setConfig(data.data);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>;
      case 'maintenance':
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Maintenance</span>;
      case 'disabled':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">Disabled</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-[#1475e1] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Control Center</h1>
          <p className="text-gray-400">Manage games, RTP, house edge, and bot settings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchConfig}
            className="px-4 py-2 bg-[#2f4553] rounded-lg text-gray-300 hover:bg-[#3d5a6e] transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1923] p-1 rounded-lg w-fit">
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
                ? 'bg-[#1475e1] text-white'
                : 'text-gray-400 hover:text-white'
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => (
            <div key={game.name} className="bg-[#1a2c38] border border-[#2f4553] rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0f1923] rounded-lg">{game.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{game.name}</h3>
                    <p className="text-xs text-gray-400">{game.description}</p>
                  </div>
                </div>
                {getStatusBadge(game.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-[#0f1923] rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">House Edge</div>
                  <div className="text-lg font-bold text-[#00F0FF]">{game.houseEdge}%</div>
                </div>
                <div className="bg-[#0f1923] rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <div className="text-lg font-bold text-green-400">Online</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Shield className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400">Provably Fair Verified</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crash Settings Tab */}
      {activeTab === 'crash' && editConfig && (
        <div className="space-y-4">
          {/* House Edge */}
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1475e1]" />
              House Edge Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">House Edge (%)</label>
                <input
                  type="number"
                  value={editConfig.houseEdge}
                  onChange={(e) => setEditConfig({ ...editConfig, houseEdge: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#1475e1] focus:outline-none"
                  min="0"
                  max="20"
                  step="0.5"
                />
                <p className="text-xs text-gray-500 mt-1">Default: 4%. Range: 0-20%</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Instant Bust Rate (%)</label>
                <input
                  type="number"
                  value={editConfig.instantBust}
                  onChange={(e) => setEditConfig({ ...editConfig, instantBust: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#1475e1] focus:outline-none"
                  min="0"
                  max="20"
                  step="0.5"
                />
                <p className="text-xs text-gray-500 mt-1">Chance of 1.00x crash. Default: 4%</p>
              </div>
            </div>
          </div>

          {/* Bot Configuration */}
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-[#1475e1]" />
              Bot Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Bots Enabled</label>
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
                <label className="text-sm text-gray-400 mb-2 block">Min Bot Bet ($)</label>
                <input
                  type="number"
                  value={editConfig.minBotBet}
                  onChange={(e) => setEditConfig({ ...editConfig, minBotBet: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#1475e1] focus:outline-none"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Max Bot Bet ($)</label>
                <input
                  type="number"
                  value={editConfig.maxBotBet}
                  onChange={(e) => setEditConfig({ ...editConfig, maxBotBet: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#1475e1] focus:outline-none"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-sm text-gray-400 mb-2 block">Max Bots Per Round</label>
              <input
                type="number"
                value={editConfig.maxBotsPerRound}
                onChange={(e) => setEditConfig({ ...editConfig, maxBotsPerRound: parseInt(e.target.value) || 0 })}
                className="w-full md:w-1/3 bg-[#0f1923] border border-[#2f4553] rounded-lg px-3 py-2 text-white font-mono focus:border-[#1475e1] focus:outline-none"
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
              className="px-6 py-3 bg-[#1475e1] hover:bg-[#1265c1] rounded-lg text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
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
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">Global Game Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0f1923] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Default Currency</div>
                <div className="text-white font-bold">USDT (Tether)</div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Minimum Bet</div>
                <div className="text-white font-bold">$0.01</div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Maximum Bet</div>
                <div className="text-white font-bold">$10,000</div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Provably Fair</div>
                <div className="text-green-400 font-bold flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Enabled (All Games)
                </div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Rate Limiting</div>
                <div className="text-white font-bold">500ms between bets</div>
              </div>
              <div className="bg-[#0f1923] rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Atomic Transactions</div>
                <div className="text-green-400 font-bold flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Row Locking Enabled
                </div>
              </div>
            </div>
          </div>

          {/* Active Games Summary */}
          <div className="bg-[#1a2c38] border border-[#2f4553] rounded-xl p-5">
            <h3 className="text-lg font-bold text-white mb-4">Active In-House Games</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-[#2f4553]">
                    <th className="text-left py-3 px-2">Game</th>
                    <th className="text-center py-3 px-2">Status</th>
                    <th className="text-center py-3 px-2">House Edge</th>
                    <th className="text-center py-3 px-2">Provably Fair</th>
                    <th className="text-center py-3 px-2">Algorithm</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Crash', edge: '4%', algo: 'ICDF Exponential', status: 'active' },
                    { name: 'Plinko', edge: '4%', algo: 'Galton Board Simulation', status: 'active' },
                    { name: 'Dice', edge: '4%', algo: 'HMAC-SHA256 Roll', status: 'active' },
                    { name: 'Mines', edge: '4%', algo: 'Fisher-Yates Shuffle', status: 'active' },
                  ].map((game) => (
                    <tr key={game.name} className="border-b border-[#2f4553]/50 hover:bg-[#0f1923]/50">
                      <td className="py-3 px-2 text-white font-medium">{game.name}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          {game.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-[#00F0FF] font-mono">{game.edge}</td>
                      <td className="py-3 px-2 text-center text-green-400">Verified</td>
                      <td className="py-3 px-2 text-center text-gray-300 font-mono text-xs">{game.algo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
