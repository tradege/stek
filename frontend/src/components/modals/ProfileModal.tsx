'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserStats {
  totalBets: number;
  totalWagered?: string;
  totalWager?: number;
  totalWon?: string;
  totalWin?: number;
  winRate?: string | number;
  favoriteGame?: string;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, token, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'security'>('overview');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', email: '', password: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && token) {
      fetchStats();
      if (user) {
        setEditForm({
          displayName: user.username || '',
          email: user.email || '',
          password: '',
        });
      }
    }
  }, [isOpen, token, user]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/users/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  const handleEditSubmit = async () => {
    setEditLoading(true);
    setEditMsg(null);
    try {
      const body: any = {};
      if (editForm.displayName !== user?.username) body.displayName = editForm.displayName;
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditMsg({ type: 'success', text: 'Profile updated successfully!' });
        refreshUser();
      } else {
        const data = await res.json();
        setEditMsg({ type: 'error', text: data.message || 'Failed to update profile' });
      }
    } catch {
      setEditMsg({ type: 'error', text: 'Network error' });
    } finally {
      setEditLoading(false);
    }
  };

  const formatCurrency = (val: number | string | undefined) => {
    const n = Number(val) || 0;
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-bg-card rounded-xl border border-white/10 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-bg-card z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-2xl">👤</span>
            Profile
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(['overview', 'edit', 'security'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setEditMsg(null); }}
              className={`flex-1 py-4 text-center font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'text-accent-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab === 'edit' ? 'Edit Profile' : tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'overview' && (
            <>
              {/* User Info */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-5 text-center">
                <div className="w-20 h-20 rounded-full bg-accent-primary/20 border-2 border-accent-primary flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl font-bold text-accent-primary">
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{user?.username}</h3>
                <p className="text-text-secondary text-sm">{user?.email}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="px-3 py-1 bg-accent-primary/10 text-accent-primary text-xs font-semibold rounded-full border border-accent-primary/20">
                    VIP Lv.{(user as any)?.vipLevel || 0}
                  </span>
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
                    Active
                  </span>
                </div>
              </div>

              {/* Quick Stats */}
              {stats && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-text-secondary text-xs mb-1">Total Bets</div>
                    <div className="text-white font-bold text-lg">{stats.totalBets?.toLocaleString() || '0'}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-text-secondary text-xs mb-1">Total Wagered</div>
                    <div className="text-white font-bold text-lg">{formatCurrency(stats.totalWagered || stats.totalWager)}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-text-secondary text-xs mb-1">Total Won</div>
                    <div className="text-green-400 font-bold text-lg">{formatCurrency(stats.totalWon || stats.totalWin)}</div>
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-text-secondary text-xs mb-1">Win Rate</div>
                    <div className="text-accent-primary font-bold text-lg">{Number(stats.winRate || 0).toFixed(1)}%</div>
                  </div>
                </div>
              )}

              {/* Account Info */}
              <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h3 className="text-sm font-semibold text-white">Account Details</h3>
                </div>
                <table className="w-full text-left">
                  <tbody>
                    {[
                      { label: 'Username', value: user?.username || '-' },
                      { label: 'Email', value: user?.email || '-' },
                      { label: 'Joined', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' },
                      { label: 'Favorite Game', value: stats?.favoriteGame || '-' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-text-secondary text-sm">{row.label}</td>
                        <td className="py-3 px-4 text-right text-white text-sm font-medium">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'edit' && (
            <div className="space-y-4">
              {editMsg && (
                <div className={`p-3 rounded-lg text-sm ${editMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                  {editMsg.text}
                </div>
              )}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Display Name</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  disabled
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-text-secondary border border-white/10 cursor-not-allowed"
                />
                <p className="text-xs text-text-secondary mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">New Password</label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
              </div>
              <button
                onClick={handleEditSubmit}
                disabled={editLoading}
                className="w-full py-4 bg-accent-primary text-black font-bold rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <h3 className="text-white font-semibold">Two-Factor Authentication</h3>
                    <p className="text-text-secondary text-sm">Add an extra layer of security</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-bg-main rounded-lg">
                  <span className="text-text-secondary text-sm">Status</span>
                  <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-semibold rounded-full">
                    Not Enabled
                  </span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <h3 className="text-white font-semibold">Active Sessions</h3>
                    <p className="text-text-secondary text-sm">Manage your logged-in devices</p>
                  </div>
                </div>
                <div className="p-3 bg-bg-main rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">Current Session</p>
                    <p className="text-text-secondary text-xs">This device</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full">Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
