"use client";
import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RewardInfo {
  type: string;
  amount: number;
  source?: string;
  createdAt: string;
  status: string;
}

interface VipRewardsData {
  vipLevel: number;
  tierName: string;
  bonusBalance: number;
  claimableRakeback: number;
  totalWagered: number;
  nextLevelProgress: number;
  weeklyBonus: { eligible: boolean; nextDate: string; estimatedAmount: number };
  monthlyBonus: { eligible: boolean; nextDate: string; estimatedAmount: number };
  recentRewards: RewardInfo[];
}

const VIP_TIERS = [
  { name: "Bronze", color: "from-amber-700 to-amber-900", icon: "🥉", minWager: 0 },
  { name: "Silver", color: "from-gray-400 to-gray-600", icon: "🥈", minWager: 1000 },
  { name: "Gold", color: "from-yellow-400 to-yellow-600", icon: "🥇", minWager: 5000 },
  { name: "Platinum", color: "from-cyan-400 to-cyan-600", icon: "💎", minWager: 25000 },
  { name: "Diamond", color: "from-blue-400 to-blue-600", icon: "👑", minWager: 100000 },
];

const PromotionsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [activeSection, setActiveSection] = useState<"rewards" | "vip" | "history">("rewards");
  const [loading, setLoading] = useState(true);
  const [vipData, setVipData] = useState<VipRewardsData | null>(null);
  const [rewardHistory, setRewardHistory] = useState<RewardInfo[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const handleClaimRakeback = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/vip/claim-rakeback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh VIP data to update the claimable amount
        fetchVipData();
      } else {
        setClaimMessage({ type: 'error', text: data.message || 'Failed to claim rakeback' });
      }
    } catch (err) {
      setClaimMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setClaiming(false);
    }
  };


  useEffect(() => {
    if (isOpen && token) {
      fetchVipData();
    }
  }, [isOpen]);

  const fetchVipData = async () => {
    setLoading(true);
    try {
      const [vipRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/vip/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/rewards/my-history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (vipRes.ok) {
        const data = await vipRes.json();
        setVipData(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setRewardHistory(Array.isArray(data) ? data : data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch VIP data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case "WEEKLY_BONUS": return "Weekly Bonus";
      case "MONTHLY_BONUS": return "Monthly Bonus";
      case "RAKEBACK": return "Rakeback";
      case "LEVEL_UP": return "Level Up Bonus";
      case "DEPOSIT_BONUS": return "Deposit Bonus";
      default: return type?.replace(/_/g, " ") || "Bonus";
    }
  };

  const getRewardTypeColor = (type: string) => {
    switch (type) {
      case "WEEKLY_BONUS": return "text-blue-400 bg-blue-500/20";
      case "MONTHLY_BONUS": return "text-purple-400 bg-purple-500/20";
      case "RAKEBACK": return "text-green-400 bg-green-500/20";
      case "LEVEL_UP": return "text-yellow-400 bg-yellow-500/20";
      default: return "text-gray-400 bg-gray-500/20";
    }
  };

  if (!isOpen) return null;

  const currentTier = VIP_TIERS[Math.min(vipData?.vipLevel || 0, VIP_TIERS.length - 1)];
  const nextTier = VIP_TIERS[Math.min((vipData?.vipLevel || 0) + 1, VIP_TIERS.length - 1)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 bg-bg-card rounded-xl border border-white/10 shadow-2xl animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-bg-card z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            Promotions & Rewards
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-white/10 bg-bg-card">
          {(["rewards", "vip", "history"] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeSection === section
                  ? "text-accent-primary border-b-2 border-accent-primary"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              {section === "rewards" ? "🎁 Active Rewards" : section === "vip" ? "⭐ VIP Status" : "📋 History"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-primary"></div>
            </div>
          ) : (
            <>
              {/* ACTIVE REWARDS TAB */}
              {activeSection === "rewards" && (
                <div className="space-y-4">
                  {/* Bonus Balance Card */}
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-5 border border-yellow-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-yellow-400 text-sm font-medium mb-1">Your Bonus Balance</div>
                        <div className="text-3xl font-bold text-white">
                          ${(vipData?.bonusBalance || 0).toFixed(2)}
                        </div>
                        <div className="text-yellow-500/60 text-xs mt-1">
                          Non-withdrawable · Used for gameplay only
                        </div>
                      </div>
                      <div className="text-5xl">{currentTier.icon}</div>
                    </div>
                  </div>

                  {/* Claimable Rakeback */}
                  {(vipData?.claimableRakeback || 0) > 0 && (
                    <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-5 border border-green-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-green-400 text-sm font-medium mb-1">Claimable Rakeback</div>
                          <div className="text-2xl font-bold text-white">
                            ${(vipData?.claimableRakeback || 0).toFixed(2)}
                          </div>
                          <div className="text-green-500/60 text-xs mt-1">
                            Earned from your gameplay
                          </div>
                        </div>
                        <button 
                          onClick={handleClaimRakeback}
                          disabled={claiming}
                          className="px-4 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {claiming ? 'Claiming...' : 'Claim'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Weekly Bonus Card */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-blue-500/30 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">📅</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">Weekly Bonus</h3>
                        <p className="text-blue-400 text-sm font-semibold">
                          Distributed every Sunday from the Reward Pool
                        </p>
                      </div>
                    </div>
                    <p className="text-text-secondary text-sm mb-3">
                      Every week, a portion of the reward pool is distributed to active players based on their wagering activity. The more you play, the bigger your share!
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-bg-main rounded-lg p-3 text-center">
                        <div className="text-text-secondary text-xs mb-1">Your Weekly Wager</div>
                        <div className="text-white font-bold">${(vipData?.totalWagered || 0).toFixed(0)}</div>
                      </div>
                      <div className="bg-bg-main rounded-lg p-3 text-center">
                        <div className="text-text-secondary text-xs mb-1">VIP Level Multiplier</div>
                        <div className="text-white font-bold">{currentTier.name} ({(vipData?.vipLevel || 0) + 1}x)</div>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Bonus Card */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-purple-500/30 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">🗓️</span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">Monthly Bonus</h3>
                        <p className="text-purple-400 text-sm font-semibold">
                          Big monthly distribution for loyal players
                        </p>
                      </div>
                    </div>
                    <p className="text-text-secondary text-sm mb-3">
                      At the end of each month, a larger portion of the accumulated reward pool is distributed. Top players receive the biggest bonuses!
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-bg-main rounded-lg p-3 text-center">
                        <div className="text-text-secondary text-xs mb-1">Distribution</div>
                        <div className="text-white font-bold">1st of Month</div>
                      </div>
                      <div className="bg-bg-main rounded-lg p-3 text-center">
                        <div className="text-text-secondary text-xs mb-1">Eligibility</div>
                        <div className="text-white font-bold">Active Players</div>
                      </div>
                    </div>
                  </div>

                  {/* Reward Pool Info */}
                  <div className="bg-gradient-to-r from-accent-primary/10 to-accent-primary/5 rounded-xl p-4 border border-accent-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">💰</span>
                      <h4 className="text-sm font-semibold text-white">How the Reward Pool Works</h4>
                    </div>
                    <p className="text-text-secondary text-xs leading-relaxed">
                      A small percentage of every bet contributes to the community Reward Pool. This pool grows with every game played and is distributed to active players through weekly and monthly bonuses. Bonuses are credited to your Bonus Balance and can be used for gameplay but cannot be withdrawn directly.
                    </p>
                  </div>
                </div>
              )}

              {/* VIP STATUS TAB */}
              {activeSection === "vip" && (
                <div className="space-y-4">
                  {/* Current VIP Level */}
                  <div className={`bg-gradient-to-r ${currentTier.color} rounded-xl p-6 text-center`}>
                    <div className="text-5xl mb-2">{currentTier.icon}</div>
                    <h3 className="text-2xl font-bold text-white">{currentTier.name}</h3>
                    <p className="text-white/70 text-sm">VIP Level {vipData?.vipLevel || 0}</p>
                  </div>

                  {/* Progress to Next Level */}
                  {(vipData?.vipLevel || 0) < VIP_TIERS.length - 1 && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-text-secondary">Progress to {nextTier.name}</span>
                        <span className="text-white font-bold">{(vipData?.nextLevelProgress || 0).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-bg-main rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent-primary to-accent-primary/70 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(vipData?.nextLevelProgress || 0, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-text-secondary mt-2">
                        <span>Wagered: ${(vipData?.totalWagered || 0).toFixed(0)}</span>
                        <span>Need: ${nextTier.minWager.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* VIP Benefits Table */}
                  <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                      <h3 className="text-white font-semibold">VIP Benefits</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-text-secondary text-xs border-b border-white/5">
                          <th className="text-left p-3">Tier</th>
                          <th className="text-right p-3">Rakeback</th>
                          <th className="text-right p-3">Weekly Bonus</th>
                          <th className="text-right p-3">Monthly Bonus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {VIP_TIERS.map((tier, i) => (
                          <tr
                            key={i}
                            className={`border-t border-white/5 ${
                              i === (vipData?.vipLevel || 0) ? "bg-accent-primary/10" : ""
                            }`}
                          >
                            <td className="p-3 flex items-center gap-2">
                              <span>{tier.icon}</span>
                              <span className="text-white font-medium">{tier.name}</span>
                              {i === (vipData?.vipLevel || 0) && (
                                <span className="text-[10px] bg-accent-primary text-black px-1.5 py-0.5 rounded-full font-bold">YOU</span>
                              )}
                            </td>
                            <td className="p-3 text-right text-green-400">{(0.5 + i * 0.5).toFixed(1)}%</td>
                            <td className="p-3 text-right text-blue-400">{i >= 1 ? "✅" : "❌"}</td>
                            <td className="p-3 text-right text-purple-400">{i >= 1 ? "✅" : "❌"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HISTORY TAB */}
              {activeSection === "history" && (
                <div className="space-y-4">
                  {rewardHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📋</div>
                      <h3 className="text-xl font-bold text-white mb-2">No Rewards Yet</h3>
                      <p className="text-text-secondary text-sm">
                        Start playing to earn rewards! Every bet contributes to your bonuses.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rewardHistory.map((reward, i) => (
                        <div key={i} className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${getRewardTypeColor(reward.type)}`}>
                              {getRewardTypeLabel(reward.type)}
                            </span>
                            <div>
                              <div className="text-white text-sm font-medium">
                                {reward.source || "Reward Pool"}
                              </div>
                              <div className="text-text-secondary text-xs">
                                {new Date(reward.createdAt).toLocaleDateString()} {new Date(reward.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 font-bold">+${Number(reward.amount).toFixed(2)}</div>
                            <div className={`text-xs ${reward.status === "CREDITED" ? "text-green-500" : "text-yellow-500"}`}>
                              {reward.status || "CREDITED"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-bg-card">
          <p className="text-center text-text-secondary text-xs">
            Bonus balance is non-withdrawable and used exclusively for gameplay. Rewards are distributed automatically based on your activity.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PromotionsModal;
