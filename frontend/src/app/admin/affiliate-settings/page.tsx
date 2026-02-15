'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, Percent, Save, RefreshCw, CheckCircle, AlertTriangle,
  TrendingUp, Shield, Crown, Award, Star, Gem
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

// Tier display configuration
const TIER_DISPLAY = {
  bronze:   { label: 'Bronze',   icon: '🥉', color: '#CD7F32', bgColor: 'from-[#CD7F32]/20 to-[#CD7F32]/5' },
  silver:   { label: 'Silver',   icon: '🥈', color: '#C0C0C0', bgColor: 'from-[#C0C0C0]/20 to-[#C0C0C0]/5' },
  gold:     { label: 'Gold',     icon: '🥇', color: '#FFD700', bgColor: 'from-[#FFD700]/20 to-[#FFD700]/5' },
  platinum: { label: 'Platinum', icon: '💎', color: '#E5E4E2', bgColor: 'from-[#E5E4E2]/20 to-[#E5E4E2]/5' },
  diamond:  { label: 'Diamond',  icon: '👑', color: '#00F0FF', bgColor: 'from-[#00F0FF]/20 to-[#00F0FF]/5' },
  iron:     { label: 'Iron',     icon: '🏆', color: '#FF4500', bgColor: 'from-[#FF4500]/20 to-[#FF4500]/5' },
};

interface TierConfig {
  minPlayers: number;
  tier1Rate: number;
  tier2Rate: number;
  tier3Rate: number;
}

interface AffiliateConfig {
  model: string;
  tiers: Record<string, TierConfig>;
}

const DEFAULT_CONFIG: AffiliateConfig = {
  model: 'REVENUE_SHARE',
  tiers: {
    bronze:   { minPlayers: 5,   tier1Rate: 0.05, tier2Rate: 0.02, tier3Rate: 0.01 },
    silver:   { minPlayers: 7,   tier1Rate: 0.07, tier2Rate: 0.03, tier3Rate: 0.015 },
    gold:     { minPlayers: 10,  tier1Rate: 0.10, tier2Rate: 0.04, tier3Rate: 0.02 },
    platinum: { minPlayers: 15,  tier1Rate: 0.12, tier2Rate: 0.05, tier3Rate: 0.025 },
    diamond:  { minPlayers: 20,  tier1Rate: 0.15, tier2Rate: 0.06, tier3Rate: 0.03 },
    iron:     { minPlayers: 25,  tier1Rate: 0.20, tier2Rate: 0.08, tier3Rate: 0.04 },
  },
};

export default function AffiliateSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AffiliateConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/affiliate/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.tiers) {
          setConfig(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch affiliate config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = (tierName: string, field: keyof TierConfig, value: string) => {
    const numValue = parseFloat(value) || 0;
    setConfig(prev => ({
      ...prev,
      tiers: {
        ...prev.tiers,
        [tierName]: {
          ...prev.tiers[tierName],
          [field]: field === 'minPlayers' ? Math.floor(numValue) : numValue / 100, // Convert % to decimal
        },
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveStatus('idle');
      setError('');

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/affiliate/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to save');
        setSaveStatus('error');
      }
    } catch (err) {
      setError('Network error');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#00F0FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-[#00F0FF]" />
            Affiliate Commission Settings
          </h1>
          <p className="text-[#94A3B8] mt-1">
            Revenue Share (Loss-Based) Model — Commission is calculated from player losses only
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            saveStatus === 'success'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : saveStatus === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-gradient-to-r from-[#00F0FF] to-[#A855F7] text-[#0A0E17] hover:shadow-[0_0_30px_rgba(0,240,255,0.3)]'
          }`}
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : saveStatus === 'error' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {saving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Model Info Banner */}
      <div className="bg-gradient-to-r from-[#00F0FF]/10 to-[#A855F7]/10 border border-[#00F0FF]/20 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#00F0FF]/20 rounded-xl">
            <TrendingUp className="w-6 h-6 text-[#00F0FF]" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Revenue Share (Loss-Based)</h3>
            <p className="text-[#94A3B8] mt-1">
              Affiliates earn a percentage of their referred players' <span className="text-[#00F0FF] font-semibold">net losses</span> (Bet - Payout).
              If a player wins, the loss is carried over as <span className="text-yellow-400 font-semibold">negative carryover</span> and deducted from future commissions.
              Ranks are determined by the <span className="text-[#A855F7] font-semibold">number of active referred players</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.entries(config.tiers).map(([tierName, tierConfig]) => {
          const display = TIER_DISPLAY[tierName as keyof typeof TIER_DISPLAY] || {
            label: tierName, icon: '📊', color: '#94A3B8', bgColor: 'from-gray-500/20 to-gray-500/5'
          };

          return (
            <div
              key={tierName}
              className={`bg-gradient-to-br ${display.bgColor} border border-[#1E293B] rounded-xl p-5 hover:border-[${display.color}]/30 transition-all`}
            >
              {/* Tier Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{display.icon}</span>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: display.color }}>
                    {display.label}
                  </h3>
                  <p className="text-[#64748B] text-sm">Tier Configuration</p>
                </div>
              </div>

              {/* Min Players */}
              <div className="mb-4">
                <label className="text-[#94A3B8] text-sm font-medium flex items-center gap-2 mb-1.5">
                  <Users className="w-4 h-4" />
                  Min. Players Required
                </label>
                <input
                  type="number"
                  min="0"
                  value={tierConfig.minPlayers}
                  onChange={(e) => handleTierChange(tierName, 'minPlayers', e.target.value)}
                  className="w-full bg-[#0A0E17] border border-[#1E293B] rounded-lg px-4 py-2.5 text-white focus:border-[#00F0FF] focus:outline-none transition-colors"
                />
              </div>

              {/* Commission Rates */}
              <div className="space-y-3">
                <div>
                  <label className="text-[#94A3B8] text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Percent className="w-3 h-3" />
                    Tier 1 Rate (Direct Referral)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={(tierConfig.tier1Rate * 100).toFixed(1)}
                      onChange={(e) => handleTierChange(tierName, 'tier1Rate', e.target.value)}
                      className="w-full bg-[#0A0E17] border border-[#1E293B] rounded-lg px-4 py-2 text-white focus:border-[#00F0FF] focus:outline-none pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[#94A3B8] text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Percent className="w-3 h-3" />
                    Tier 2 Rate (Sub-Referral)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={(tierConfig.tier2Rate * 100).toFixed(1)}
                      onChange={(e) => handleTierChange(tierName, 'tier2Rate', e.target.value)}
                      className="w-full bg-[#0A0E17] border border-[#1E293B] rounded-lg px-4 py-2 text-white focus:border-[#00F0FF] focus:outline-none pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[#94A3B8] text-xs font-medium flex items-center gap-1.5 mb-1">
                    <Percent className="w-3 h-3" />
                    Tier 3 Rate (3rd Level)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={(tierConfig.tier3Rate * 100).toFixed(1)}
                      onChange={(e) => handleTierChange(tierName, 'tier3Rate', e.target.value)}
                      className="w-full bg-[#0A0E17] border border-[#1E293B] rounded-lg px-4 py-2 text-white focus:border-[#00F0FF] focus:outline-none pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div className="bg-[#0A0E17] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#1E293B]">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#A855F7]" />
            Commission Rate Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E293B]">
                <th className="text-left text-[#94A3B8] font-medium px-5 py-3 text-sm">Rank</th>
                <th className="text-center text-[#94A3B8] font-medium px-5 py-3 text-sm">Min Players</th>
                <th className="text-center text-[#00F0FF] font-medium px-5 py-3 text-sm">Tier 1</th>
                <th className="text-center text-[#A855F7] font-medium px-5 py-3 text-sm">Tier 2</th>
                <th className="text-center text-[#F97316] font-medium px-5 py-3 text-sm">Tier 3</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.tiers).map(([tierName, tierConfig]) => {
                const display = TIER_DISPLAY[tierName as keyof typeof TIER_DISPLAY];
                return (
                  <tr key={tierName} className="border-b border-[#1E293B]/50 hover:bg-[#131B2C]/50">
                    <td className="px-5 py-3 flex items-center gap-2">
                      <span className="text-xl">{display?.icon}</span>
                      <span className="font-semibold" style={{ color: display?.color }}>{display?.label || tierName}</span>
                    </td>
                    <td className="text-center text-white px-5 py-3">{tierConfig.minPlayers}</td>
                    <td className="text-center text-[#00F0FF] font-bold px-5 py-3">{(tierConfig.tier1Rate * 100).toFixed(1)}%</td>
                    <td className="text-center text-[#A855F7] font-bold px-5 py-3">{(tierConfig.tier2Rate * 100).toFixed(1)}%</td>
                    <td className="text-center text-[#F97316] font-bold px-5 py-3">{(tierConfig.tier3Rate * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
