"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import config from '@/config/api';

interface UserStats {
  totalBets: number;
  totalWagered: number;
  totalPayout: number;
  profit: number;
  deposits: number;
  withdrawals: number;
}

interface User {
  id: string;
  username: string;
  email: string;
  status: "ACTIVE" | "BANNED" | "SUSPENDED" | "PENDING_APPROVAL" | "PENDING_VERIFICATION";
  role: "USER" | "ADMIN" | "VIP";
  createdAt: string;
  lastLoginAt: string | null;
  isBot: boolean;
  vipLevel: number;
  wallets: { balance: string; bonusBalance?: string; currency: string }[];
  stats: UserStats;
}

interface UserDetail {
  id: string; username: string; email: string; status: string; role: string;
  displayName: string | null; country: string | null; language: string; timezone: string;
  twoFactorEnabled: boolean; lastLoginAt: string | null; lastLoginIp: string | null;
  vipLevel: number; totalWagered: string; xp: number; isBot: boolean;
  createdAt: string; updatedAt: string; siteId: string | null;
  wallets: { id: string; balance: string; bonusBalance?: string; currency: string }[];
  stats: {
    totalBets: number; totalWagered: number; totalPayout: number; totalProfit: number;
    deposits: number; withdrawals: number;
  };
}

interface BetRecord {
  id: string; gameType: string; currency: string;
  betAmount: string; multiplier: string; payout: string; profit: string;
  isWin: boolean; gameData: any; createdAt: string;
}

const API_URL = config.apiUrl;

type SortField = 'username' | 'balance' | 'wagered' | 'profit' | 'deposits' | 'bets' | 'created' | 'vip';
type SortDir = 'asc' | 'desc';

// ============================================
// USER DETAIL MODAL COMPONENT
// ============================================
function UserDetailModal({ userId, token, onClose, onBalanceChange }: {
  userId: string; token: string; onClose: () => void; onBalanceChange: () => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "balance" | "bets" | "rewards">("info");
  const [rewards, setRewards] = useState<any[]>([]);
  const [bonusStats, setBonusStats] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    fetchDetail();
    fetchBets();
    fetchRewards();
  }, [userId]);

  
  const fetchRewards = async () => {
    try {
      const [rewardsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users/${userId}/rewards`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/users/${userId}/bonus-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewards(Array.isArray(data) ? data : data.history || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setBonusStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch rewards:", err);
    }
  };

  const fetchDetail = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDetail(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchBets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/bets?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBets(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleAdjustBalance = async () => {
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) return alert("Enter a valid amount");
    if (!adjustReason.trim()) return alert("Enter a reason");
    if (!confirm(`Are you sure you want to ${amount > 0 ? 'credit' : 'debit'} $${Math.abs(amount)}?`)) return;

    setAdjusting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/adjust-balance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason: adjustReason }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Balance adjusted: ${data.message}`);
        setAdjustAmount(""); setAdjustReason("");
        fetchDetail();
        onBalanceChange();
      } else {
        alert(data.message || "Failed to adjust balance");
      }
    } catch (e: any) { alert(e.message); }
    setAdjusting(false);
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "Never";

  const fmtCurrency = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(v) >= 1_000) return '$' + (v / 1_000).toFixed(2) + 'K';
    return '$' + v.toFixed(2);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (!detail) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent-primary/20 flex items-center justify-center text-2xl font-bold text-accent-primary">
              {detail.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{detail.username}</h2>
              <p className="text-sm text-text-secondary">{detail.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(["info", "balance", "bets", "rewards"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab ? "text-accent-primary border-b-2 border-primary" : "text-text-secondary hover:text-white"
              }`}>
              {tab === "info" ? "User Info" : tab === "balance" ? "Balance Manager" : tab === "bets" ? "Bet History" : "Rewards"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* INFO TAB */}
          {activeTab === "info" && (
            <div className="space-y-4">
              {/* Quick Stats - 6 cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Balance</div>
                  <div className="text-lg font-bold text-green-400">
                    ${(() => { const w = detail.wallets?.find((w: any) => w.currency === 'USDT') || detail.wallets?.[0]; return w ? parseFloat(w.balance).toFixed(2) : '0.00'; })()}
                  </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Bonus</div>
                  <div className="text-lg font-bold text-yellow-400">
                    ${(() => { const w = detail.wallets?.find((w: any) => w.currency === 'USDT') || detail.wallets?.[0]; return w && w.bonusBalance ? parseFloat(w.bonusBalance).toFixed(2) : '0.00'; })()}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Total Bets</div>
                  <div className="text-lg font-bold text-white">{detail.stats.totalBets.toLocaleString()}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">P&L (Player)</div>
                  <div className={`text-lg font-bold ${detail.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {detail.stats.totalProfit >= 0 ? '+' : ''}{fmtCurrency(detail.stats.totalProfit)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Total Wagered</div>
                  <div className="text-lg font-bold text-blue-400">{fmtCurrency(detail.stats.totalWagered)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Deposits</div>
                  <div className="text-lg font-bold text-emerald-400">{fmtCurrency(detail.stats.deposits)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Withdrawals</div>
                  <div className="text-lg font-bold text-orange-400">{fmtCurrency(detail.stats.withdrawals)}</div>
                </div>
              </div>

              {/* House Profit indicator */}
              <div className={`rounded-lg p-4 border ${detail.stats.totalProfit <= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">House Profit from this player</span>
                  <span className={`text-xl font-bold ${detail.stats.totalProfit <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtCurrency(Math.abs(detail.stats.totalProfit))}
                    <span className="text-xs ml-1">{detail.stats.totalProfit <= 0 ? '(profit)' : '(loss)'}</span>
                  </span>
                </div>
              </div>

              {/* Detail Table */}
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/5">
                  {[
                    ["Status", detail.status],
                    ["Role", detail.role],
                    ["VIP Level", `Level ${detail.vipLevel}`],
                    ["XP", detail.xp.toString()],
                    ["Country", detail.country || "N/A"],
                    ["Language", detail.language],
                    ["Timezone", detail.timezone],
                    ["2FA", detail.twoFactorEnabled ? "Enabled" : "Disabled"],
                    ["Last Login IP", detail.lastLoginIp || "N/A"],
                    ["Last Login", formatDate(detail.lastLoginAt)],
                    ["Registered", formatDate(detail.createdAt)],
                    ["Site ID", detail.siteId || "Default"],
                    ["Is Bot", detail.isBot ? "Yes" : "No"],
                  ].map(([label, value]) => (
                    <tr key={label} className="hover:bg-white/5">
                      <td className="py-2 text-text-secondary font-medium w-40">{label}</td>
                      <td className="py-2 text-white">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* BALANCE TAB */}
          {activeTab === "balance" && (
            <div className="space-y-6">
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <p className="text-sm text-text-secondary mb-1">Current Balance</p>
                <p className="text-4xl font-bold text-white">
                  ${(() => { const w = detail.wallets?.find((w: any) => w.currency === 'USDT') || detail.wallets?.[0]; return w ? parseFloat(w.balance).toFixed(2) : '0.00'; })()}
                </p>
                <p className="text-xs text-text-secondary mt-1">{(detail.wallets?.find((w: any) => w.currency === 'USDT') || detail.wallets?.[0])?.currency || "USDT"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-text-secondary">Total Deposits</p>
                  <p className="text-xl font-bold text-emerald-400">{fmtCurrency(detail.stats.deposits)}</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-text-secondary">Total Withdrawals</p>
                  <p className="text-xl font-bold text-orange-400">{fmtCurrency(detail.stats.withdrawals)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Amount (positive = credit, negative = debit)
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setAdjustAmount(prev => {
                      const v = parseFloat(prev) || 0;
                      return Math.abs(v).toString();
                    })} className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30">
                      + Credit
                    </button>
                    <button onClick={() => setAdjustAmount(prev => {
                      const v = parseFloat(prev) || 0;
                      return (-Math.abs(v)).toString();
                    })} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30">
                      - Debit
                    </button>
                    <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                      placeholder="0.00" step="0.01"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-accent-primary focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Reason</label>
                  <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                    placeholder="e.g., Bonus, Correction, Refund..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-accent-primary focus:outline-none" />
                </div>

                <button onClick={handleAdjustBalance} disabled={adjusting}
                  className="w-full py-3 rounded-lg bg-accent-primary text-black font-bold hover:bg-accent-primary/80 disabled:opacity-50 transition-colors">
                  {adjusting ? "Processing..." : "Apply Balance Adjustment"}
                </button>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 flex-wrap">
                {[10, 50, 100, 500, 1000].map(amt => (
                  <button key={amt} onClick={() => setAdjustAmount(amt.toString())}
                    className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-text-secondary hover:text-white hover:bg-white/10 transition-colors">
                    +${amt}
                  </button>
                ))}
                {[-10, -50, -100].map(amt => (
                  <button key={amt} onClick={() => setAdjustAmount(amt.toString())}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    -${Math.abs(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* BETS TAB */}
          {activeTab === "bets" && (
            <div>
              {bets.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">No bets found for this user</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-secondary border-b border-white/10">
                        <th className="py-2 text-left">Game</th>
                        <th className="py-2 text-right">Bet</th>
                        <th className="py-2 text-right">Multi</th>
                        <th className="py-2 text-right">Payout</th>
                        <th className="py-2 text-right">Profit</th>
                        <th className="py-2 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {bets.map(b => (
                        <tr key={b.id} className={`hover:bg-white/5 ${b.isWin ? '' : 'opacity-70'}`}>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              b.gameType === 'CRASH' ? 'bg-red-500/20 text-red-400' :
                              b.gameType === 'MINES' ? 'bg-yellow-500/20 text-yellow-400' :
                              b.gameType === 'PLINKO' ? 'bg-blue-500/20 text-blue-400' :
                              b.gameType === 'DICE' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-white/10 text-text-secondary'
                            }`}>{b.gameType}</span>
                          </td>
                          <td className="py-2 text-right text-white">${parseFloat(b.betAmount).toFixed(2)}</td>
                          <td className="py-2 text-right text-text-secondary">{parseFloat(b.multiplier).toFixed(2)}x</td>
                          <td className="py-2 text-right text-white">${parseFloat(b.payout).toFixed(2)}</td>
                          <td className={`py-2 text-right font-medium ${parseFloat(b.profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {parseFloat(b.profit) >= 0 ? '+' : ''}${parseFloat(b.profit).toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-text-secondary text-xs">
                            {new Date(b.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "rewards" && (
            <div className="space-y-4 p-4">
              {/* Bonus Stats Summary */}
              {bonusStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
                    <div className="text-green-400 text-xs font-medium mb-1">Bonus Balance</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.currentBonusBalance || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
                    <div className="text-blue-400 text-xs font-medium mb-1">Total Earned</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.totalRewardsReceived || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
                    <div className="text-purple-400 text-xs font-medium mb-1">Rakeback</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.claimableRakeback || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl p-4 border border-yellow-500/30">
                    <div className="text-yellow-400 text-xs font-medium mb-1">Pool Contributions</div>
                    <div className="text-white text-lg font-bold">${Number(bonusStats.totalContributed || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
              {/* Rewards History Table */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-white font-semibold">Reward History</h3>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {rewards.length === 0 ? (
                    <div className="text-center py-8 text-text-secondary">No rewards yet</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg-card">
                        <tr className="text-text-secondary text-xs">
                          <th className="text-left p-3">Type</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Source</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewards.map((r: any, i: number) => (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                r.type === 'WEEKLY_BONUS' ? 'bg-blue-500/20 text-blue-400' :
                                r.type === 'MONTHLY_BONUS' ? 'bg-purple-500/20 text-purple-400' :
                                r.type === 'RAKEBACK' ? 'bg-green-500/20 text-green-400' :
                                r.type === 'LEVEL_UP' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-text-secondary'
                              }`}>
                                {r.type?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-green-400">+${Number(r.amount || 0).toFixed(2)}</td>
                            <td className="p-3 text-text-secondary">{r.source || r.gameType || '-'}</td>
                            <td className="p-3 text-text-secondary">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() + ' ' + new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                r.status === 'CREDITED' ? 'bg-green-500/20 text-green-400' :
                                r.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-gray-500/20 text-text-secondary'
                              }`}>
                                {r.status || 'CREDITED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN USERS PAGE
// ============================================
export default function AdminUsersPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showBots, setShowBots] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, action: "" });

  // User Detail Modal
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "ADMIN") { router.push("/"); return; }
    fetchUsers();
  }, [user, router]);

  useEffect(() => { setSelectedIds(new Set()); }, [filterStatus, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      setUsers(await response.json());
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleAction = async (userId: string, action: string) => {
    if (action === "ban" && !confirm("Ban this user?")) return;
    if (action === "approve" && !confirm("Approve this user?")) return;
    setProcessingId(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/${action}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to ${action} user`);
      const statusMap: Record<string, string> = { approve: "ACTIVE", ban: "BANNED", unban: "ACTIVE" };
      if (statusMap[action]) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: statusMap[action] as any } : u));
      }
    } catch (err: any) { alert(err.message); }
    setProcessingId(null);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE user "${username}"?\n\nThis will delete ALL their data including:\n- Wallet & balance\n- All transactions\n- All bets & game history\n- All sessions\n\nThis action CANNOT be undone!`)) return;
    if (!confirm(`FINAL CONFIRMATION: Delete "${username}" permanently?`)) return;
    setProcessingId(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to delete user`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      alert(`✅ ${data.message}`);
    } catch (err: any) { alert(`❌ ${err.message}`); }
    setProcessingId(null);
  };


  const handleBulkAction = async (action: "approve" | "ban" | "unban") => {
    const selected = filteredUsers.filter(u => selectedIds.has(u.id));
    if (!selected.length) return;
    if (!confirm(`${action} ${selected.length} user(s)?`)) return;
    setBulkProcessing(true);
    setBulkProgress({ current: 0, total: selected.length, action });
    let ok = 0, fail = 0;
    for (let i = 0; i < selected.length; i++) {
      setBulkProgress(p => ({ ...p, current: i + 1 }));
      try {
        const res = await fetch(`${API_URL}/api/admin/users/${selected[i].id}/${action}`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          ok++;
          const statusMap: Record<string, string> = { approve: "ACTIVE", ban: "BANNED", unban: "ACTIVE" };
          setUsers(prev => prev.map(u => u.id === selected[i].id ? { ...u, status: statusMap[action] as any } : u));
        } else fail++;
      } catch { fail++; }
    }
    setBulkProcessing(false); setSelectedIds(new Set());
    setBulkProgress({ current: 0, total: 0, action: "" });
    if (fail > 0) alert(`Done: ${ok} succeeded, ${fail} failed`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const getBalance = (u: User) => { const w = u.wallets?.find(w => w.currency === 'USDT') || u.wallets?.[0]; return w ? parseFloat(w.balance) : 0; };
  const getBonus = (u: User) => { const w = u.wallets?.find(w => w.currency === 'USDT') || u.wallets?.[0]; return w && w.bonusBalance ? parseFloat(w.bonusBalance) : 0; };
  const getDeposits = (u: User) => { return u.stats?.deposits || 0; };
  const getRealBalance = (u: User) => { const w = u.wallets?.find(w => w.currency === "USDT") || u.wallets?.[0]; return w && (w as any).realBalance ? parseFloat((w as any).realBalance) : 0; };

  const filteredUsers = users
    .filter(u => {
      // Hide root/admin users from the regular user list
      if (u.role === 'ADMIN') return false;
      const matchSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
      const matchBot = showBots ? true : (!u.isBot || u.status === 'PENDING_APPROVAL');
      return matchSearch && matchStatus && matchBot;
    })
    .sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'username': return sortDir === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
        case 'balance': va = getBalance(a); vb = getBalance(b); break;
        case 'wagered': va = a.stats?.totalWagered || 0; vb = b.stats?.totalWagered || 0; break;
        case 'profit': va = a.stats?.profit || 0; vb = b.stats?.profit || 0; break;
        case 'deposits': va = a.stats?.deposits || 0; vb = b.stats?.deposits || 0; break;
        case 'bets': va = a.stats?.totalBets || 0; vb = b.stats?.totalBets || 0; break;
        case 'vip': va = a.vipLevel || 0; vb = b.vipLevel || 0; break;
        case 'created': va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
        default: return 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const selectableUsers = filteredUsers.filter(u => u.role !== "ADMIN");
  const isAllSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedIds.has(u.id));
  const isSomeSelected = selectableUsers.some(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? new Set() : new Set(selectableUsers.map(u => u.id)));
  };

  const selectedUsers = filteredUsers.filter(u => selectedIds.has(u.id));
  const hasPending = selectedUsers.some(u => u.status === "PENDING_APPROVAL");
  const hasBannable = selectedUsers.some(u => u.status === "ACTIVE" && u.role !== "ADMIN");
  const hasBanned = selectedUsers.some(u => u.status === "BANNED");
  const pendingCount = users.filter(u => u.status === "PENDING_APPROVAL").length;
  const realUsers = users.filter(u => !u.isBot);
  const totalRealWagered = realUsers.reduce((s, u) => s + (u.stats?.totalWagered || 0), 0);
  const totalRealProfit = realUsers.reduce((s, u) => s + (u.stats?.profit || 0), 0);
  const totalRealDeposits = realUsers.reduce((s, u) => s + (u.stats?.deposits || 0), 0);

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const fmtCurrency = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(v) >= 1_000) return '$' + (v / 1_000).toFixed(2) + 'K';
    return '$' + v.toFixed(2);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; text: string }> = {
      ACTIVE: { cls: "bg-green-500/20 text-green-400", text: "Active" },
      BANNED: { cls: "bg-red-500/20 text-red-400", text: "Banned" },
      SUSPENDED: { cls: "bg-yellow-500/20 text-yellow-400", text: "Suspended" },
      PENDING_APPROVAL: { cls: "bg-yellow-500/20 text-blue-400 animate-pulse", text: "Pending" },
      PENDING_VERIFICATION: { cls: "bg-blue-500/20 text-blue-400", text: "Verify" },
    };
    const m = map[s] || { cls: "bg-white/10 text-text-secondary", text: s };
    return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${m.cls}`}>{m.text}</span>;
  };

  const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: string }) => (
    <th
      className={`py-3 px-3 text-sm font-medium text-text-secondary cursor-pointer hover:text-white transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
      }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        )}
      </span>
    </th>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* User Detail Modal */}
      {detailUserId && (
        <UserDetailModal userId={detailUserId} token={token!} onClose={() => setDetailUserId(null)} onBalanceChange={fetchUsers} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-text-secondary">Manage all registered users and view financial data</p>
        </div>
        <button onClick={fetchUsers} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center"><span className="text-2xl">&#9203;</span></div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-400">{pendingCount} User{pendingCount > 1 ? 's' : ''} Awaiting Approval</h3>
            <p className="text-sm text-text-secondary">New registrations require your approval.</p>
          </div>
          <button onClick={() => setFilterStatus("PENDING_APPROVAL")} className="px-4 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-600">View Pending</button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-bg-card border border-white/10 rounded-lg p-4">
          <div className="text-text-secondary text-xs mb-1">Real Players</div>
          <div className="text-2xl font-bold text-white">{realUsers.filter(u => u.role !== 'ADMIN').length}</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-4">
          <div className="text-text-secondary text-xs mb-1">Active</div>
          <div className="text-2xl font-bold text-green-400">{realUsers.filter(u => u.status === "ACTIVE").length}</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-4">
          <div className="text-text-secondary text-xs mb-1">Total Wagered</div>
          <div className="text-2xl font-bold text-blue-400">{fmtCurrency(totalRealWagered)}</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-4">
          <div className="text-text-secondary text-xs mb-1">Total Deposits</div>
          <div className="text-2xl font-bold text-emerald-400">{fmtCurrency(totalRealDeposits)}</div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-4">
          <div className="text-text-secondary text-xs mb-1">House Profit</div>
          <div className={`text-2xl font-bold ${totalRealProfit <= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtCurrency(Math.abs(totalRealProfit))}
          </div>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-4">
          <div className="text-text-secondary text-xs mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-white/10 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input type="text" placeholder="Search by username or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-bg-main border border-white/10 rounded-lg px-4 py-2 pl-10 text-white focus:border-accent-primary focus:outline-none" />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {["ALL", "PENDING_APPROVAL", "ACTIVE", "BANNED"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === s ? "bg-accent-primary text-white" : "bg-bg-main text-text-secondary hover:text-white"
                }`}>
                {s === "PENDING_APPROVAL" ? "Pending" : s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
            <label className="flex items-center gap-2 ml-2 cursor-pointer">
              <input type="checkbox" checked={showBots} onChange={e => setShowBots(e.target.checked)}
                className="w-4 h-4 rounded border-white/30 bg-transparent text-purple-500 focus:ring-purple-500" />
              <span className="text-sm text-purple-400">Show Bots</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-bg-card border border-accent-primary/50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-primary/20 flex items-center justify-center">
                <span className="text-lg font-bold text-accent-primary">{selectedIds.size}</span>
              </div>
              <div>
                <p className="font-semibold text-white">{selectedIds.size} user{selectedIds.size > 1 ? 's' : ''} selected</p>
                <p className="text-xs text-text-secondary">Choose a bulk action</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {hasPending && <button onClick={() => handleBulkAction("approve")} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50">Approve Selected</button>}
              {hasBannable && <button onClick={() => handleBulkAction("ban")} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">Ban Selected</button>}
              {hasBanned && <button onClick={() => handleBulkAction("unban")} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">Unban Selected</button>}
              <button onClick={() => setSelectedIds(new Set())} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 text-text-secondary hover:text-white disabled:opacity-50">Clear</button>
            </div>
          </div>
          {bulkProcessing && (
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary">Processing {bulkProgress.action}... {bulkProgress.current}/{bulkProgress.total}</span>
                <span className="text-accent-primary font-medium">{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-bg-main rounded-full h-2 overflow-hidden">
                <div className="bg-accent-primary h-2 rounded-full transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-bg-card border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-main">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox" checked={isAllSelected}
                    ref={el => { if (el) el.indeterminate = isSomeSelected && !isAllSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-white/30 bg-transparent text-accent-primary focus:ring-accent-primary cursor-pointer" />
                </th>
                <SortHeader field="username" label="User" />
                <th className="py-3 px-3 text-left text-sm font-medium text-text-secondary">Status</th>
                <th className="py-3 px-3 text-right text-sm font-medium text-emerald-400">Deposits</th>
                <th className="py-3 px-3 text-right text-sm font-medium text-yellow-400">Bonus</th>
                <SortHeader field="balance" label="Balance" align="right" />
                <th className="py-3 px-3 text-right text-sm font-medium text-cyan-400">Real Balance</th>
                <SortHeader field="wagered" label="Wagered" align="right" />
                <SortHeader field="profit" label="P&L (House)" align="right" />
                <SortHeader field="bets" label="Bets" align="right" />
                <SortHeader field="vip" label="VIP" align="right" />
                <SortHeader field="created" label="Joined" />
                <th className="py-3 px-3 text-right text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10/50">
              {filteredUsers.map(u => {
                const sel = selectedIds.has(u.id);
                const balance = getBalance(u);
                const houseProfit = -(u.stats?.profit || 0); // Negate: player loss = house profit
                return (
                  <tr key={u.id} className={`hover:bg-bg-main/50 transition-colors ${u.isBot ? 'opacity-60' : ''} ${u.status === "PENDING_APPROVAL" ? "bg-yellow-500/5" : ""} ${sel ? "bg-accent-primary/10" : ""}`}>
                    <td className="px-3 py-3">
                      {u.role !== "ADMIN" ? (
                        <input type="checkbox" checked={sel} onChange={() => toggleSelect(u.id)}
                          className="w-4 h-4 rounded border-white/30 bg-transparent text-accent-primary focus:ring-accent-primary cursor-pointer" />
                      ) : <div className="w-4 h-4" />}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setDetailUserId(u.id)} className="text-left hover:text-accent-primary transition-colors">
                        <div className="font-medium text-white">{u.username} {u.isBot && <span className="text-purple-400 text-xs">(BOT)</span>}</div>
                        <div className="text-xs text-text-secondary">{u.email}</div>
                      </button>
                    </td>
                    <td className="px-3 py-3">{statusBadge(u.status)}</td>
                    <td className="px-3 py-3 text-right font-medium text-emerald-400">${getDeposits(u).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-medium text-yellow-400">${getBonus(u).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-medium text-white">${balance.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-medium text-cyan-400">${getRealBalance(u).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-blue-400 font-medium">{fmtCurrency(u.stats?.totalWagered || 0)}</td>
                    <td className={`px-3 py-3 text-right font-medium ${houseProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {houseProfit >= 0 ? '+' : ''}{fmtCurrency(houseProfit)}
                    </td>
                    <td className="px-3 py-3 text-right text-text-secondary">{(u.stats?.totalBets || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        u.vipLevel >= 4 ? 'bg-yellow-500/20 text-yellow-400' :
                        u.vipLevel >= 2 ? 'bg-blue-500/20 text-blue-400' :
                        'bg-white/10 text-text-secondary'
                      }`}>Lv.{u.vipLevel || 0}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">{fmt(u.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailUserId(u.id)}
                          className="px-2 py-1 text-xs font-medium rounded bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30">
                          View
                        </button>
                        {u.status === "PENDING_APPROVAL" && (
                          <button onClick={() => handleAction(u.id, "approve")} disabled={processingId === u.id}
                            className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50">
                            {processingId === u.id ? "..." : "Approve"}
                          </button>
                        )}
                        {u.role !== "ADMIN" && u.status !== "PENDING_APPROVAL" && (
                          u.status === "BANNED" ? (
                            <button onClick={() => handleAction(u.id, "unban")} disabled={processingId === u.id}
                              className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50">
                              {processingId === u.id ? "..." : "Unban"}
                            </button>
                          ) : (
                            <button onClick={() => handleAction(u.id, "ban")} disabled={processingId === u.id}
                              className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50">
                              {processingId === u.id ? "..." : "Ban"}
                            </button>
                          )
                        )}
                        {u.role !== "ADMIN" && user?.email === "marketedgepros@gmail.com" && (
                          <button onClick={() => handleDeleteUser(u.id, u.username)} disabled={processingId === u.id}
                            className="px-2 py-1 text-xs font-medium rounded bg-red-600/30 text-red-300 hover:bg-red-600/50 disabled:opacity-50 border border-red-500/30">
                            {processingId === u.id ? "..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-text-secondary">No users found matching your criteria</div>
        )}
        <div className="px-4 py-3 bg-bg-main border-t border-white/10 text-sm text-text-secondary">
          Showing {filteredUsers.length} of {users.length} users {!showBots && `(${users.filter(u => u.isBot).length} bots hidden)`}
        </div>
      </div>
    </div>
  );
}
