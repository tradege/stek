'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import config from '@/config/api';
import AuthGuard from '@/components/ui/AuthGuard';

const API_URL = config.apiUrl;

interface UserStats {
  totalBets: number;
  totalWagered?: string;
  totalWager?: number;
  totalWon?: string;
  totalWin?: number;
  totalLost?: string;
  winRate?: string | number;
  favoriteGame?: string;
}

interface Session {
  id: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  createdAt: string;
  expiresAt: string;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const { branding } = useBranding();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'security' | 'sessions'>('overview');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Edit profile state
  const [editForm, setEditForm] = useState({
    displayName: '',
    email: '',
    password: '',
    language: 'en',
    country: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 2FA state
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [twoFAMsg, setTwoFAMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(false);

  // Change password state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const getToken = () => localStorage.getItem('auth_token');

  useEffect(() => {
    if (user) {
      setEditForm({
        displayName: user.displayName || user.username || '',
        email: user.email || '',
        password: '',
        language: 'en',
        country: '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        try {
          const token = getToken();
          const res = await fetch(`${API_URL}/users/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) setStats(await res.json());
        } catch {
          setStats({ totalBets: 0 });
        }
      };
      fetchStats();
    }
  }, [user]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/auth/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSessions(await res.json());
    } catch { /* ignore */ } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') fetchSessions();
  }, [activeTab, fetchSessions]);

  // Edit profile handler
  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditMsg(null);
    try {
      const token = getToken();
      const body: any = {};
      if (editForm.displayName !== (user?.displayName || user?.username)) body.displayName = editForm.displayName;
      if (editForm.email !== user?.email) {
        body.email = editForm.email;
        body.password = editForm.password;
      }
      if (editForm.country) body.country = editForm.country;
      if (editForm.language) body.language = editForm.language;

      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setEditMsg({ type: 'success', text: data.message || 'Profile updated!' });
        refreshUser();
      } else {
        setEditMsg({ type: 'error', text: data.message || 'Update failed' });
      }
    } catch {
      setEditMsg({ type: 'error', text: 'Network error' });
    } finally {
      setEditLoading(false);
    }
  };

  // Change password handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setPwLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: 'success', text: data.message || 'Password changed!' });
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPwMsg({ type: 'error', text: data.message || 'Failed' });
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Network error' });
    } finally {
      setPwLoading(false);
    }
  };

  // 2FA handlers
  const handleEnable2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMsg(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/auth/2fa/enable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.qrCodeUrl);
        setTwoFASecret(data.secret);
        setTwoFAStep('setup');
      } else {
        setTwoFAMsg({ type: 'error', text: data.message || 'Failed' });
      }
    } catch {
      setTwoFAMsg({ type: 'error', text: 'Network error' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMsg(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAMsg({ type: 'success', text: '2FA enabled successfully!' });
        setTwoFAStep('idle');
        setTotpCode('');
        refreshUser();
      } else {
        setTwoFAMsg({ type: 'error', text: data.message || 'Invalid code' });
      }
    } catch {
      setTwoFAMsg({ type: 'error', text: 'Network error' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const code = prompt('Enter your current 2FA code to disable:');
    if (!code) return;
    setTwoFALoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/auth/2fa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFAMsg({ type: 'success', text: '2FA disabled.' });
        refreshUser();
      } else {
        setTwoFAMsg({ type: 'error', text: data.message || 'Failed' });
      }
    } catch {
      setTwoFAMsg({ type: 'error', text: 'Network error' });
    } finally {
      setTwoFALoading(false);
    }
  };

  // Revoke session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const token = getToken();
      await fetch(`${API_URL}/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSessions();
    } catch { /* ignore */ }
  };

  const handleRevokeAll = async () => {
    try {
      const token = getToken();
      await fetch(`${API_URL}/auth/sessions/revoke-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchSessions();
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
        </div>
      </MainLayout>
    );
  }

  const vipLevels = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Iron'];
  const vipGradients = ['from-amber-700 to-amber-900', 'from-gray-400 to-gray-600', 'from-yellow-400 to-yellow-600', 'from-primary to-primary', 'from-purple-400 to-purple-600', 'from-red-400 to-red-600'];
  const currentVipLevel = user?.vipLevel || 0;
  const vipName = vipLevels[Math.min(currentVipLevel, vipLevels.length - 1)] || 'Bronze';
  const balances = Array.isArray(user?.balance) ? user.balance : [];
  const totalWon = parseFloat(stats?.totalWon || String(stats?.totalWin || '0'));
  const totalLost = parseFloat(stats?.totalLost || '0');
  const pnl = totalWon - totalLost;

  return (
    <AuthGuard>
      <MainLayout>
        <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6" data-testid="profile-page">
          {/* Profile Header */}
          <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
              <div className="relative">
                <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${vipGradients[Math.min(currentVipLevel, vipGradients.length - 1)]} flex items-center justify-center shadow-lg`}>
                  <span className="text-4xl font-bold text-white">
                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className={`absolute -bottom-2 -right-2 bg-gradient-to-r ${vipGradients[Math.min(currentVipLevel, vipGradients.length - 1)]} text-white text-xs font-bold px-2 py-1 rounded-lg`}>
                  {vipName}
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white">{user?.displayName || user?.username || 'Player'}</h1>
                <p className="text-text-secondary mt-1">{user?.email || ''}</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <span className="px-3 py-1 bg-accent-primary/10 text-accent-primary rounded-lg text-sm font-medium border border-accent-primary/20">
                    VIP Level {currentVipLevel}
                  </span>
                  <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium border border-green-500/20">
                    {user?.status === 'ACTIVE' ? 'Active' : user?.status || 'Active'}
                  </span>
                  {(user as any)?.twoFactorEnabled && (
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium border border-blue-500/20">
                      2FA Enabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Balances */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              Wallet
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {balances.length > 0 ? balances.map((bal: any, i: number) => (
                <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-text-secondary text-xs uppercase">{bal.currency || 'USD'}</p>
                  <p className="text-xl font-bold text-white font-mono mt-1">
                    ${parseFloat(bal.available || bal.amount || '0').toFixed(2)}
                  </p>
                </div>
              )) : (
                <div className="col-span-full bg-white/5 rounded-xl p-4 border border-white/5">
                  <p className="text-text-secondary text-sm">No balances available</p>
                </div>
              )}
              <div className={`bg-white/5 rounded-xl p-4 border ${pnl >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
                <p className="text-text-secondary text-xs uppercase">Net P&L</p>
                <p className={`text-xl font-bold font-mono mt-1 ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-bg-card border border-white/10 rounded-xl p-1 overflow-x-auto">
            {(['overview', 'edit', 'security', 'sessions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'edit' ? 'Edit Profile' : tab === 'security' ? 'Security & 2FA' : 'Sessions'}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <p className="text-text-secondary text-sm mb-1">Total Bets</p>
                <p className="text-2xl font-bold text-white font-mono">{stats?.totalBets?.toLocaleString() || '0'}</p>
              </div>
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <p className="text-text-secondary text-sm mb-1">Total Wagered</p>
                <p className="text-2xl font-bold text-accent-primary font-mono">${stats?.totalWagered || stats?.totalWager || '0.00'}</p>
              </div>
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <p className="text-text-secondary text-sm mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-white">{stats?.winRate || '0'}%</p>
              </div>
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <p className="text-text-secondary text-sm mb-1">Total Won</p>
                <p className="text-2xl font-bold text-green-400 font-mono">${stats?.totalWon || stats?.totalWin || '0.00'}</p>
              </div>
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <p className="text-text-secondary text-sm mb-1">Total Lost</p>
                <p className="text-2xl font-bold text-red-400 font-mono">${stats?.totalLost || '0.00'}</p>
              </div>
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <p className="text-text-secondary text-sm mb-1">Favorite Game</p>
                <p className="text-2xl font-bold text-white">{stats?.favoriteGame || 'N/A'}</p>
              </div>
            </div>
          )}

          {/* Edit Profile Tab */}
          {activeTab === 'edit' && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">Edit Profile</h3>
              {editMsg && (
                <div className={`mb-4 p-4 rounded-xl text-sm ${editMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
                  {editMsg.text}
                </div>
              )}
              <form onSubmit={handleEditProfile} className="space-y-5 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Display Name</label>
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                  />
                  {editForm.email !== user?.email && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-text-secondary mb-2">Current Password (required for email change)</label>
                      <input
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                        placeholder="Enter current password"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Country</label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
                    placeholder="Your country"
                  />
                </div>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-6 py-3 bg-gradient-to-r from-accent-primary to-accent-primary/80 text-white font-bold rounded-xl hover:from-accent-primary/90 hover:to-accent-primary/70 transition-all disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* Security & 2FA Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password */}
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>
                {pwMsg && (
                  <div className={`mb-4 p-4 rounded-xl text-sm ${pwMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
                    {pwMsg.text}
                  </div>
                )}
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  <input
                    type="password"
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 transition-all"
                    placeholder="Current Password"
                    required
                  />
                  <input
                    type="password"
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 transition-all"
                    placeholder="New Password (min 8 chars)"
                    required
                    minLength={8}
                  />
                  <input
                    type="password"
                    value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-accent-primary/50 transition-all"
                    placeholder="Confirm New Password"
                    required
                  />
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="px-6 py-3 bg-accent-primary/10 text-accent-primary rounded-xl font-medium hover:bg-accent-primary/20 transition-all border border-accent-primary/20 disabled:opacity-50"
                  >
                    {pwLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>

              {/* Two-Factor Authentication */}
              <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Two-Factor Authentication (2FA)</h3>
                {twoFAMsg && (
                  <div className={`mb-4 p-4 rounded-xl text-sm ${twoFAMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
                    {twoFAMsg.text}
                  </div>
                )}

                {twoFAStep === 'idle' && (
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="text-white font-medium">Google Authenticator / TOTP</p>
                      <p className="text-text-secondary text-sm">
                        {(user as any)?.twoFactorEnabled ? 'Currently enabled' : 'Add an extra layer of security'}
                      </p>
                    </div>
                    {(user as any)?.twoFactorEnabled ? (
                      <button
                        onClick={handleDisable2FA}
                        disabled={twoFALoading}
                        className="px-4 py-2 bg-danger/10 text-danger rounded-lg text-sm font-medium hover:bg-danger/20 transition-all border border-danger/20"
                      >
                        Disable 2FA
                      </button>
                    ) : (
                      <button
                        onClick={handleEnable2FA}
                        disabled={twoFALoading}
                        className="px-4 py-2 bg-accent-primary/10 text-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/20 transition-all border border-accent-primary/20"
                      >
                        Enable 2FA
                      </button>
                    )}
                  </div>
                )}

                {twoFAStep === 'setup' && (
                  <div className="space-y-4">
                    <p className="text-text-secondary text-sm">
                      Scan this QR code with Google Authenticator or any TOTP app:
                    </p>
                    <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto">
                      {qrCode && <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />}
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-text-secondary text-xs mb-1">Manual entry key:</p>
                      <p className="text-white font-mono text-sm break-all">{twoFASecret}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Enter the 6-digit code from your app:</label>
                      <input
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-accent-primary/50 transition-all"
                        placeholder="000000"
                        maxLength={6}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleVerify2FA}
                        disabled={twoFALoading || totpCode.length !== 6}
                        className="px-6 py-3 bg-gradient-to-r from-accent-primary to-accent-primary/80 text-white font-bold rounded-xl disabled:opacity-50 transition-all"
                      >
                        {twoFALoading ? 'Verifying...' : 'Verify & Enable'}
                      </button>
                      <button
                        onClick={() => { setTwoFAStep('idle'); setTotpCode(''); }}
                        className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Active Sessions</h3>
                <button
                  onClick={handleRevokeAll}
                  className="px-4 py-2 bg-danger/10 text-danger rounded-lg text-sm font-medium hover:bg-danger/20 transition-all border border-danger/20"
                >
                  Revoke All Others
                </button>
              </div>
              {sessionsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-primary"></div>
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((session, i) => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                          <svg className="w-5 h-5 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{session.device}</p>
                          <p className="text-text-secondary text-xs">IP: {session.ipAddress}</p>
                          <p className="text-text-secondary text-xs">
                            Created: {new Date(session.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {i === 0 && (
                          <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs border border-green-500/20">
                            Current
                          </span>
                        )}
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          className="px-3 py-1.5 bg-danger/10 text-danger rounded-lg text-xs font-medium hover:bg-danger/20 transition-all border border-danger/20"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-center py-8">No active sessions found.</p>
              )}
            </div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  );
}
