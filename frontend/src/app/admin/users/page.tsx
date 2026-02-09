"use client";
import React, { useState, useEffect } from "react";
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

const API_URL = config.apiUrl;

export default function AdminUsersPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      router.push("/");
      return;
    }
    fetchUsers();
  }, [user, router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error("Failed to fetch users");
      
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, action: "BAN" | "UNBAN") => {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this user?`)) return;
    
    setProcessingId(userId);
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/${action.toLowerCase()}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) throw new Error(`Failed to ${action.toLowerCase()} user`);
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, status: action === "BAN" ? "BANNED" : "ACTIVE" }
          : u
      ));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveUser = async (userId: string) => {
    if (!confirm("Are you sure you want to approve this user? They will be able to log in immediately.")) return;
    
    setProcessingId(userId);
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) throw new Error("Failed to approve user");
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, status: "ACTIVE" }
          : u
      ));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendVerification = async (userId: string) => {
    if (!confirm("Send verification email to this user?")) return;
    
    setProcessingId(userId);
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}/send-verification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) throw new Error("Failed to send verification email");
      
      const data = await response.json();
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, status: "PENDING_VERIFICATION" }
          : u
      ));
      
      alert(`Verification email sent! ${data.otp ? `(Dev OTP: ${data.otp})` : ''}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "ALL" || u.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Count pending approvals
  const pendingCount = users.filter(u => u.status === "PENDING_APPROVAL").length;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2 py-1 text-xs rounded-full bg-success-muted text-success-primary">Active</span>;
      case "BANNED":
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-muted text-danger-primary">Banned</span>;
      case "SUSPENDED":
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-muted text-warning-primary">Suspended</span>;
      case "PENDING_APPROVAL":
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-[#1475e1] animate-pulse">⏳ Pending Approval</span>;
      case "PENDING_VERIFICATION":
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">📧 Awaiting Verification</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-card-hover text-text-secondary">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-text-secondary">Manage all registered users</p>
        </div>
        <button
          onClick={fetchUsers}
          className="btn-secondary px-4 py-2 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Pending Approval Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-2xl">⏳</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-400">{pendingCount} User{pendingCount > 1 ? 's' : ''} Awaiting Approval</h3>
            <p className="text-sm text-text-secondary">New registrations require your approval before they can log in.</p>
          </div>
          <button
            onClick={() => setFilterStatus("PENDING_APPROVAL")}
            className="btn-primary px-4 py-2 bg-yellow-500 hover:bg-yellow-600"
          >
            View Pending
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Total Users</div>
          <div className="text-2xl font-bold">{users.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Active</div>
          <div className="text-2xl font-bold text-success-primary">
            {users.filter(u => u.status === "ACTIVE").length}
          </div>
        </div>
        <div className="card p-4 border-yellow-500/30">
          <div className="text-text-secondary text-sm">Pending Approval</div>
          <div className="text-2xl font-bold text-yellow-400">
            {users.filter(u => u.status === "PENDING_APPROVAL").length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Banned</div>
          <div className="text-2xl font-bold text-danger-primary">
            {users.filter(u => u.status === "BANNED").length}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">VIP Users</div>
          <div className="text-2xl font-bold text-accent-secondary">
            {users.filter(u => u.role === "VIP").length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-full pl-10"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {["ALL", "PENDING_APPROVAL", "ACTIVE", "BANNED", "SUSPENDED"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status
                    ? status === "PENDING_APPROVAL" 
                      ? "bg-yellow-500 text-black"
                      : "bg-accent-primary text-text-inverse"
                    : "bg-card-hover text-text-secondary hover:text-text-primary"
                }`}
              >
                {status === "PENDING_APPROVAL" ? "⏳ Pending" : status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Balance</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Joined</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filteredUsers.map((u) => (
                <tr 
                  key={u.id} 
                  className={`hover:bg-card-hover transition-colors ${
                    u.status === "PENDING_APPROVAL" ? "bg-yellow-500/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-sm text-text-secondary">{u.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(u.status)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      u.role === "ADMIN" ? "bg-accent-primary/20 text-accent-primary" :
                      u.role === "VIP" ? "bg-accent-secondary/20 text-accent-secondary" :
                      "bg-card-hover text-text-secondary"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.wallets?.[0] ? `$${parseFloat(u.wallets[0].balance).toFixed(2)}` : "$0.00"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Pending Approval Actions */}
                      {u.status === "PENDING_APPROVAL" && (
                        <>
                          <button
                            onClick={() => handleApproveUser(u.id)}
                            disabled={processingId === u.id}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-success-primary text-white hover:bg-success-primary/80 disabled:opacity-50 flex items-center gap-1"
                            title="Approve user immediately"
                          >
                            {processingId === u.id ? (
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleSendVerification(u.id)}
                            disabled={processingId === u.id}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                            title="Send verification email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Verify
                          </button>
                        </>
                      )}
                      
                      {/* Ban/Unban Actions (not for admins or pending users) */}
                      {u.role !== "ADMIN" && u.status !== "PENDING_APPROVAL" && (
                        u.status === "BANNED" ? (
                          <button
                            onClick={() => handleBanUser(u.id, "UNBAN")}
                            disabled={processingId === u.id}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-success-muted text-success-primary hover:bg-success-primary hover:text-white disabled:opacity-50 flex items-center gap-1"
                          >
                            {processingId === u.id ? (
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Unban
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBanUser(u.id, "BAN")}
                            disabled={processingId === u.id}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-danger-muted text-danger-primary hover:bg-danger-primary hover:text-white disabled:opacity-50 flex items-center gap-1"
                          >
                            {processingId === u.id ? (
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                Ban
                              </>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-text-secondary">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p>No users found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
