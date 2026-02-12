"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import config from '@/config/api';

interface User {
  id: string;
  username: string;
  email: string;
  status: "ACTIVE" | "BANNED" | "SUSPENDED" | "PENDING_APPROVAL" | "PENDING_VERIFICATION";
  role: "USER" | "ADMIN" | "VIP";
  createdAt: string;
  lastLoginAt: string | null;
  wallets: { balance: string; currency: string }[];
}

interface UserDetail {
  id: string; username: string; email: string; status: string; role: string;
  displayName: string | null; country: string | null; language: string; timezone: string;
  twoFactorEnabled: boolean; lastLoginAt: string | null; lastLoginIp: string | null;
  vipLevel: number; totalWagered: string; xp: number; isBot: boolean;
  createdAt: string; updatedAt: string; siteId: string | null;
  wallets: { id: string; balance: string; currency: string }[];
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

// ============================================
// USER DETAIL MODAL COMPONENT
// ============================================
function UserDetailModal({ userId, token, onClose, onBalanceChange }: {
  userId: string; token: string; onClose: () => void; onBalanceChange: () => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "balance" | "bets">("info");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    fetchDetail();
    fetchBets();
  }, [userId]);

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
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/bets?limit=10`, {
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

  if (loading) return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
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
          {(["info", "balance", "bets"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab ? "text-accent-primary border-b-2 border-accent-primary" : "text-text-secondary hover:text-white"
              }`}>
              {tab === "info" ? "User Info" : tab === "balance" ? "Balance Manager" : "Bet History"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* INFO TAB */}
          {activeTab === "info" && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Balance</div>
                  <div className="text-lg font-bold text-success-primary">
                    ${detail.wallets[0] ? parseFloat(detail.wallets[0].balance).toFixed(2) : "0.00"}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">Total Bets</div>
                  <div className="text-lg font-bold">{detail.stats.totalBets}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xs text-text-secondary">P&L</div>
                  <div className={`text-lg font-bold ${detail.stats.totalProfit >= 0 ? 'text-success-primary' : 'text-danger-primary'}`}>
                    ${detail.stats.totalProfit.toFixed(2)}
                  </div>
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
                    ["Total Wagered", `$${detail.stats.totalWagered.toFixed(2)}`],
                    ["Total Deposits", `$${detail.stats.deposits.toFixed(2)}`],
                    ["Total Withdrawals", `$${detail.stats.withdrawals.toFixed(2)}`],
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
                  ${detail.wallets[0] ? parseFloat(detail.wallets[0].balance).toFixed(2) : "0.00"}
                </p>
                <p className="text-xs text-text-secondary mt-1">{detail.wallets[0]?.currency || "USDT"}</p>
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
                    })} className="px-3 py-2 rounded-lg bg-success-primary/20 text-success-primary text-sm font-medium hover:bg-success-primary/30">
                      + Credit
                    </button>
                    <button onClick={() => setAdjustAmount(prev => {
                      const v = parseFloat(prev) || 0;
                      return (-Math.abs(v)).toString();
                    })} className="px-3 py-2 rounded-lg bg-danger-primary/20 text-danger-primary text-sm font-medium hover:bg-danger-primary/30">
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
                    className="px-3 py-1.5 text-xs rounded-lg bg-danger-primary/10 text-danger-primary hover:bg-danger-primary/20 transition-colors">
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
                          <td className={`py-2 text-right font-medium ${parseFloat(b.profit) >= 0 ? 'text-success-primary' : 'text-danger-primary'}`}>
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

  const filteredUsers = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
    return matchSearch && matchStatus;
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

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; text: string }> = {
      ACTIVE: { cls: "bg-success-muted text-success-primary", text: "Active" },
      BANNED: { cls: "bg-danger-muted text-danger-primary", text: "Banned" },
      SUSPENDED: { cls: "bg-warning-muted text-warning-primary", text: "Suspended" },
      PENDING_APPROVAL: { cls: "bg-yellow-500/20 text-[#1475e1] animate-pulse", text: "⏳ Pending" },
      PENDING_VERIFICATION: { cls: "bg-blue-500/20 text-blue-400", text: "📧 Verify" },
    };
    const m = map[s] || { cls: "bg-card-hover text-text-secondary", text: s };
    return <span className={`px-2 py-1 text-xs rounded-full ${m.cls}`}>{m.text}</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
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
          <p className="text-text-secondary">Manage all registered users</p>
        </div>
        <button onClick={fetchUsers} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center"><span className="text-2xl">⏳</span></div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-400">{pendingCount} User{pendingCount > 1 ? 's' : ''} Awaiting Approval</h3>
            <p className="text-sm text-text-secondary">New registrations require your approval.</p>
          </div>
          <button onClick={() => setFilterStatus("PENDING_APPROVAL")} className="btn-primary px-4 py-2 bg-yellow-500 hover:bg-yellow-600">View Pending</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Total Users", value: users.length, color: "" },
          { label: "Active", value: users.filter(u => u.status === "ACTIVE").length, color: "text-success-primary" },
          { label: "Pending", value: pendingCount, color: "text-yellow-400" },
          { label: "Banned", value: users.filter(u => u.status === "BANNED").length, color: "text-danger-primary" },
          { label: "VIP", value: users.filter(u => u.role === "VIP").length, color: "text-accent-secondary" },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-text-secondary text-sm">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input type="text" placeholder="Search by username or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="input w-full pl-10" />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["ALL", "PENDING_APPROVAL", "ACTIVE", "BANNED", "SUSPENDED"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? s === "PENDING_APPROVAL" ? "bg-yellow-500 text-black" : "bg-accent-primary text-text-inverse"
                    : "bg-card-hover text-text-secondary hover:text-text-primary"
                }`}>
                {s === "PENDING_APPROVAL" ? "⏳ Pending" : s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="card p-4 border border-accent-primary/50 bg-accent-primary/5">
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
                className="px-4 py-2 text-sm font-medium rounded-lg bg-success-primary text-white hover:bg-success-primary/80 disabled:opacity-50">Approve Selected</button>}
              {hasBannable && <button onClick={() => handleBulkAction("ban")} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-danger-primary text-white hover:bg-danger-primary/80 disabled:opacity-50">Ban Selected</button>}
              {hasBanned && <button onClick={() => handleBulkAction("unban")} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">Unban Selected</button>}
              <button onClick={() => setSelectedIds(new Set())} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-card-hover text-text-secondary hover:text-white disabled:opacity-50">Clear</button>
            </div>
          </div>
          {bulkProcessing && (
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary">Processing {bulkProgress.action}... {bulkProgress.current}/{bulkProgress.total}</span>
                <span className="text-accent-primary font-medium">{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-card-hover rounded-full h-2 overflow-hidden">
                <div className="bg-accent-primary h-2 rounded-full transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-hover">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input type="checkbox" checked={isAllSelected}
                    ref={el => { if (el) el.indeterminate = isSomeSelected && !isAllSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-white/30 bg-transparent text-accent-primary focus:ring-accent-primary cursor-pointer" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Balance</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Joined</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filteredUsers.map(u => {
                const sel = selectedIds.has(u.id);
                return (
                  <tr key={u.id} className={`hover:bg-card-hover transition-colors ${u.status === "PENDING_APPROVAL" ? "bg-yellow-500/5" : ""} ${sel ? "bg-accent-primary/10" : ""}`}>
                    <td className="px-4 py-3">
                      {u.role !== "ADMIN" ? (
                        <input type="checkbox" checked={sel} onChange={() => toggleSelect(u.id)}
                          className="w-4 h-4 rounded border-white/30 bg-transparent text-accent-primary focus:ring-accent-primary cursor-pointer" />
                      ) : <div className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.username}</div>
                      <div className="text-sm text-text-secondary">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(u.status)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        u.role === "ADMIN" ? "bg-accent-primary/20 text-accent-primary" :
                        u.role === "VIP" ? "bg-accent-secondary/20 text-accent-secondary" :
                        "bg-card-hover text-text-secondary"
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">{u.wallets?.[0] ? `$${parseFloat(u.wallets[0].balance).toFixed(2)}` : "$0.00"}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{fmt(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button - Always visible */}
                        <button onClick={() => setDetailUserId(u.id)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit
                        </button>

                        {/* Status Actions */}
                        {u.status === "PENDING_APPROVAL" && (
                          <>
                            <button onClick={() => handleAction(u.id, "approve")} disabled={processingId === u.id}
                              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-success-primary text-white hover:bg-success-primary/80 disabled:opacity-50 flex items-center gap-1">
                              {processingId === u.id ? <span className="animate-spin">⟳</span> : <>✓ Approve</>}
                            </button>
                            <button onClick={() => handleAction(u.id, "verify")} disabled={processingId === u.id}
                              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">
                              📧 Verify
                            </button>
                          </>
                        )}
                        {u.role !== "ADMIN" && u.status !== "PENDING_APPROVAL" && (
                          u.status === "BANNED" ? (
                            <button onClick={() => handleAction(u.id, "unban")} disabled={processingId === u.id}
                              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-success-muted text-success-primary hover:bg-success-primary hover:text-white disabled:opacity-50">
                              {processingId === u.id ? "..." : "Unban"}
                            </button>
                          ) : (
                            <button onClick={() => handleAction(u.id, "ban")} disabled={processingId === u.id}
                              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-danger-muted text-danger-primary hover:bg-danger-primary hover:text-white disabled:opacity-50">
                              {processingId === u.id ? "..." : "⊘ Ban"}
                            </button>
                          )
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
      </div>
    </div>
  );
}
