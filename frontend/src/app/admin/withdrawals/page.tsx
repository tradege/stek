"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import config from '@/config/api';

interface Withdrawal {
  id: string;
  userId: string;
  username: string;
  email: string;
  amount: string;
  currency: string;
  status: string;
  walletAddress: string;
  network: string;
  userIp: string;
  vipLevel: number;
  riskScore: { score: number; level: string };
  externalRef: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

const API_URL = config.apiUrl;

export default function AdminWithdrawalsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "ADMIN") { router.push("/"); return; }
    fetchWithdrawals();
  }, [user, router]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/admin/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      setWithdrawals(await res.json());
    } catch (err: any) { console.error(err); }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this withdrawal? This will execute the transfer.")) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/withdrawals/${id}/approve`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: "CONFIRMED" } : w));
      } else { alert("Failed to approve"); }
    } catch (e: any) { alert(e.message); }
    setProcessingId(null);
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim() && !confirm("Reject without a reason?")) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: "CANCELLED" } : w));
        setRejectingId(null); setRejectReason("");
      } else { alert("Failed to reject"); }
    } catch (e: any) { alert(e.message); }
    setProcessingId(null);
  };

  const filtered = withdrawals.filter(w => filterStatus === "ALL" || w.status === filterStatus);

  const pendingCount = withdrawals.filter(w => w.status === "PENDING").length;
  const totalPending = withdrawals.filter(w => w.status === "PENDING").reduce((s, w) => s + parseFloat(w.amount), 0);
  const totalApproved = withdrawals.filter(w => w.status === "CONFIRMED").reduce((s, w) => s + parseFloat(w.amount), 0);

  const riskBadge = (r: { score: number; level: string }) => {
    const cls = r.level === "HIGH" ? "bg-red-500/20 text-red-400" :
                r.level === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-green-500/20 text-green-400";
    return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{r.level} ({r.score})</span>;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-yellow-500/20 text-yellow-400 animate-pulse",
      CONFIRMED: "bg-green-500/20 text-green-400",
      CANCELLED: "bg-red-500/20 text-red-400",
      FAILED: "bg-red-500/20 text-red-400",
    };
    return <span className={`px-2 py-0.5 text-xs rounded-full ${map[s] || "bg-white/10 text-text-secondary"}`}>{s}</span>;
  };

  const fmt = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawal Requests</h1>
          <p className="text-text-secondary">Review and process withdrawal requests</p>
        </div>
        <button onClick={fetchWithdrawals} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center"><span className="text-2xl">💰</span></div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-400">{pendingCount} Pending Withdrawal{pendingCount > 1 ? 's' : ''}</h3>
            <p className="text-sm text-text-secondary">Total pending: <span className="text-white font-medium">${totalPending.toFixed(2)}</span></p>
          </div>
          <button onClick={() => setFilterStatus("PENDING")} className="btn-primary px-4 py-2 bg-yellow-500 hover:bg-yellow-600">Review Now</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Total Requests</div>
          <div className="text-2xl font-bold">{withdrawals.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Pending Amount</div>
          <div className="text-2xl font-bold text-yellow-400">${totalPending.toFixed(2)}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Total Approved</div>
          <div className="text-2xl font-bold text-success-primary">${totalApproved.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["ALL", "PENDING", "CONFIRMED", "CANCELLED", "FAILED"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s
                ? s === "PENDING" ? "bg-yellow-500 text-black" : "bg-accent-primary text-text-inverse"
                : "bg-card-hover text-text-secondary hover:text-text-accent-primary"
            }`}>
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            {s === "PENDING" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {/* Reject Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setRejectingId(null)}>
          <div className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Reject Withdrawal</h3>
            <p className="text-sm text-text-secondary">The withdrawal amount will be refunded to the user's balance.</p>
            <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-accent-primary focus:outline-none" />
            <div className="flex gap-3">
              <button onClick={() => handleReject(rejectingId)} disabled={processingId === rejectingId}
                className="flex-1 py-2 rounded-lg bg-danger-primary text-white font-medium hover:bg-danger-primary/80 disabled:opacity-50">
                {processingId === rejectingId ? "Processing..." : "Reject & Refund"}
              </button>
              <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                className="flex-1 py-2 rounded-lg bg-card-hover text-text-secondary hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">User</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Crypto Address</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Risk</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Time</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filtered.map(w => (
                <tr key={w.id} className={`hover:bg-card-hover transition-colors ${
                  w.status === "PENDING" ? "bg-yellow-500/5" : ""
                } ${w.riskScore.level === "HIGH" ? "border-l-2 border-l-red-500" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{w.username}</div>
                    <div className="text-xs text-text-secondary">{w.email}</div>
                    <div className="text-xs text-text-secondary">IP: {w.userIp}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-lg font-bold text-white">${parseFloat(w.amount).toFixed(2)}</div>
                    <div className="text-xs text-text-secondary">{w.currency}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-mono max-w-[200px] truncate" title={w.walletAddress}>{w.walletAddress}</div>
                    <div className="text-xs text-text-secondary">{w.network}</div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(w.status)}</td>
                  <td className="px-4 py-3">{riskBadge(w.riskScore)}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{fmt(w.createdAt)}</td>
                  <td className="px-4 py-3">
                    {w.status === "PENDING" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleApprove(w.id)} disabled={processingId === w.id}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-success-primary text-white hover:bg-success-primary/80 disabled:opacity-50">
                          {processingId === w.id ? "..." : "✓ Approve"}
                        </button>
                        <button onClick={() => setRejectingId(w.id)} disabled={processingId === w.id}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-danger-muted text-danger-primary hover:bg-danger-primary hover:text-white disabled:opacity-50">
                          ✕ Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-right text-sm text-text-secondary">
                        {w.confirmedAt ? fmt(w.confirmedAt) : "—"}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-text-secondary">
            {filterStatus === "PENDING" ? "No pending withdrawals" : "No withdrawal requests found"}
          </div>
        )}
      </div>
    </div>
  );
}
