'use client';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Globe,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  Eye,
  X,
  Save,
  Check,
  Palette,
  Shield,
  Wallet,
  Key,
  UserPlus,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import config from '@/config/api';
import Link from 'next/link';

const API_URL = config.apiUrl;

const ALL_GAMES = [
  'crash', 'plinko', 'mines', 'dice', 'limbo',
  'penalty', 'olympus', 'card-rush',
];

const COLOR_PRESETS = [
  { name: 'Cyan', primary: '#00F0FF', secondary: '#0891B2' },
  { name: 'Gold', primary: '#FFD700', secondary: '#B8860B' },
  { name: 'Purple', primary: '#A855F7', secondary: '#7C3AED' },
  { name: 'Green', primary: '#22C55E', secondary: '#16A34A' },
  { name: 'Red', primary: '#EF4444', secondary: '#DC2626' },
  { name: 'Blue', primary: '#3B82F6', secondary: '#2563EB' },
  { name: 'Pink', primary: '#EC4899', secondary: '#DB2777' },
  { name: 'Orange', primary: '#F97316', secondary: '#EA580C' },
];

interface Tenant {
  id: string;
  brandName: string;
  domain: string;
  active: boolean;
  isPlatform?: boolean;
  locale: string;
  ggrFee: number;
  ownerEmail: string;
  allowedGames: string[];
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  cardColor: string;
  accentColor: string;
  dangerColor: string;
  adminUserId: string | null;
  stats: {
    totalPlayers: number;
    totalBets: number;
    ggr: number;
    ggrFee: number;
    commission: number;
  };
  createdAt: string;
}

interface AdminInfo {
  hasAdmin: boolean;
  admin: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: string;
    status: string;
    balance: number;
    createdAt: string;
  } | null;
}

type EditTab = 'general' | 'admin' | 'theme' | 'games';

export default function TenantsPage() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit modal state
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editTab, setEditTab] = useState<EditTab>('general');
  const [editForm, setEditForm] = useState({
    brandName: '',
    domain: '',
    ownerEmail: '',
    ggrFee: 0,
    locale: 'en',
    allowedGames: [] as string[],
    primaryColor: '#00F0FF',
    secondaryColor: '#0891B2',
    backgroundColor: '#0F1923',
    cardColor: '#1A2C38',
    accentColor: '#FFD700',
    dangerColor: '#EF4444',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Admin management state
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({ email: '', password: '', username: '' });
  const [resetPassword, setResetPassword] = useState('');
  const [creditsAmount, setCreditsAmount] = useState('');
  const [creditsNote, setCreditsNote] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (token) fetchTenants();
  }, [token]);

  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTenants(await res.json());
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminInfo = async (tenantId: string) => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin info:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  const toggleTenant = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) fetchTenants();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const deleteTenant = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchTenants();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditTenant(tenant);
    setEditTab('general');
    setEditForm({
      brandName: tenant.brandName,
      domain: tenant.domain,
      ownerEmail: tenant.ownerEmail || '',
      ggrFee: tenant.ggrFee || tenant.stats.ggrFee || 12,
      locale: tenant.locale || 'en',
      allowedGames: tenant.allowedGames || [...ALL_GAMES],
      primaryColor: tenant.primaryColor || '#00F0FF',
      secondaryColor: tenant.secondaryColor || '#0891B2',
      backgroundColor: tenant.backgroundColor || '#0F1923',
      cardColor: tenant.cardColor || '#1A2C38',
      accentColor: tenant.accentColor || '#FFD700',
      dangerColor: tenant.dangerColor || '#EF4444',
    });
    setSaveSuccess(false);
    setAdminInfo(null);
    setActionMessage(null);
    setNewAdminForm({ email: '', password: '', username: '' });
    setResetPassword('');
    setCreditsAmount('');
    setCreditsNote('');
    fetchAdminInfo(tenant.id);
  };

  const closeEditModal = () => {
    setEditTenant(null);
    setSaveSuccess(false);
    setActionMessage(null);
  };

  const toggleGame = (game: string) => {
    setEditForm((prev) => ({
      ...prev,
      allowedGames: prev.allowedGames.includes(game)
        ? prev.allowedGames.filter((g) => g !== game)
        : [...prev.allowedGames, game],
    }));
  };

  const saveEdit = async () => {
    if (!editTenant) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${editTenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setSaveSuccess(true);
        fetchTenants();
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const createAdmin = async () => {
    if (!editTenant || !newAdminForm.email || !newAdminForm.password || !newAdminForm.username) return;
    setActionMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${editTenant.id}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newAdminForm),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Admin account created successfully!' });
        fetchAdminInfo(editTenant.id);
        setNewAdminForm({ email: '', password: '', username: '' });
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Failed to create admin' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error' });
    }
  };

  const handleResetPassword = async () => {
    if (!editTenant || !resetPassword) return;
    setActionMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${editTenant.id}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Password reset successfully!' });
        setResetPassword('');
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Failed to reset password' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error' });
    }
  };

  const handleAddCredits = async () => {
    if (!editTenant || !creditsAmount) return;
    setActionMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${editTenant.id}/admin/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(creditsAmount), note: creditsNote || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Added $${creditsAmount}! New balance: $${data.newBalance?.toFixed(2)}` });
        setCreditsAmount('');
        setCreditsNote('');
        fetchAdminInfo(editTenant.id);
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Failed to add credits' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error' });
    }
  };

  const handleWithdrawCredits = async () => {
    if (!editTenant || !creditsAmount) return;
    setActionMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${editTenant.id}/admin/withdraw-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(creditsAmount), note: creditsNote || 'Root withdrawal' }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Withdrawn $${creditsAmount}! New balance: $${data.newBalance?.toFixed(2)}` });
        setCreditsAmount('');
        setCreditsNote('');
        fetchAdminInfo(editTenant.id);
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Failed to withdraw credits' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error' });
    }
  };

  const applyColorPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setEditForm((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
    }));
  };

  const formatCurrency = (val: number | null | undefined) => {
    const v = Number(val) || 0;
    if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  const filteredTenants = tenants.filter((t) => t.id !== "1").filter(
    (t) =>
      t.brandName.toLowerCase().includes(search.toLowerCase()) ||
      t.domain.toLowerCase().includes(search.toLowerCase()) ||
      t.ownerEmail?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  const TABS: { id: EditTab; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Edit },
    { id: 'admin', label: 'Admin', icon: Shield },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'games', label: 'Games', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Brands / Tenants</h1>
          <p className="text-text-secondary mt-1">{tenants.length} brands registered</p>
        </div>
        <Link
          href="/super-admin/tenants/create"
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Brand
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by brand name, domain, or email..."
          className="w-full pl-12 pr-4 py-3 bg-bg-card border border-white/10 rounded-xl text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredTenants.map((tenant) => (
          <div
            key={tenant.id}
            className={`bg-bg-card border rounded-xl p-5 transition-all hover:border-cyan-500/30 ${
              tenant.active ? 'border-white/10' : 'border-red-500/20 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (tenant.primaryColor || '#00F0FF') + '33' }}
                >
                  <Globe className="w-5 h-5" style={{ color: tenant.primaryColor || '#00F0FF' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{tenant.brandName}</h3>
                  <p className="text-xs text-text-secondary">{tenant.domain}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tenant.primaryColor && (
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: tenant.primaryColor }}
                    title={`Primary: ${tenant.primaryColor}`}
                  />
                )}
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    tenant.active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {tenant.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <Users className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-white">{tenant.stats.totalPlayers}</p>
                <p className="text-[10px] text-text-secondary">Players</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className={`text-sm font-bold ${(tenant.stats?.ggr || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(tenant.stats?.ggr)}
                </p>
                <p className="text-[10px] text-text-secondary">GGR</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <Building2 className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-yellow-400">{formatCurrency(tenant.stats?.commission)}</p>
                <p className="text-[10px] text-text-secondary">Commission</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-text-secondary mb-4">
              <span>Fee: <strong className="text-yellow-400">{tenant.stats.ggrFee}%</strong></span>
              <span>Games: <strong className="text-white">{tenant.allowedGames?.length || 0}</strong></span>
              <span>Admin: <strong className={tenant.adminUserId ? 'text-green-400' : 'text-red-400'}>{tenant.adminUserId ? 'Yes' : 'No'}</strong></span>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => openEditModal(tenant)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => toggleTenant(tenant.id, tenant.active)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  tenant.active
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                }`}
              >
                {tenant.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                {tenant.active ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => deleteTenant(tenant.id, tenant.brandName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTenants.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-text-secondary mx-auto mb-4" />
          <p className="text-text-secondary">
            {search ? 'No brands match your search.' : 'No brands created yet.'}
          </p>
          <Link
            href="/super-admin/tenants/create"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Brand
          </Link>
        </div>
      )}

      {/* ==================== EDIT TENANT MODAL ==================== */}
      {editTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: (editForm.primaryColor || '#00F0FF') + '33' }}
                >
                  <Edit className="w-4 h-4" style={{ color: editForm.primaryColor || '#00F0FF' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Edit Brand</h2>
                  <p className="text-xs text-text-secondary">{editTenant.brandName}</p>
                </div>
              </div>
              <button onClick={closeEditModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setEditTab(tab.id); setActionMessage(null); }}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                    editTab === tab.id
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-text-secondary hover:text-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Action Message */}
            {actionMessage && (
              <div className={`mx-5 mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
                actionMessage.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {actionMessage.text}
              </div>
            )}

            {/* Modal Body - Scrollable */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">

              {/* ===== GENERAL TAB ===== */}
              {editTab === 'general' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Brand Name</label>
                    <input
                      type="text"
                      value={editForm.brandName}
                      onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Domain</label>
                    <input
                      type="text"
                      value={editForm.domain}
                      onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Owner Email</label>
                    <input
                      type="email"
                      value={editForm.ownerEmail}
                      onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">GGR Fee (%)</label>
                      <input
                        type="number"
                        min={0} max={50} step={0.5}
                        value={editForm.ggrFee}
                        onChange={(e) => setEditForm({ ...editForm, ggrFee: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Locale</label>
                      <select
                        value={editForm.locale}
                        onChange={(e) => setEditForm({ ...editForm, locale: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      >
                        <option value="en">English</option>
                        <option value="he">Hebrew</option>
                        <option value="es">Spanish</option>
                        <option value="pt">Portuguese</option>
                        <option value="ru">Russian</option>
                        <option value="tr">Turkish</option>
                        <option value="ar">Arabic</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                      </select>
                    </div>
                  </div>
                  {/* Tenant Info */}
                  <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs text-text-secondary">
                      <span className="text-text-secondary">ID:</span>{' '}
                      <span className="text-white font-mono text-[11px]">{editTenant.id}</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      <span className="text-text-secondary">Created:</span>{' '}
                      <span className="text-white">{new Date(editTenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      <span className="text-text-secondary">Players:</span>{' '}
                      <span className="text-white">{editTenant.stats.totalPlayers}</span>
                      <span className="mx-2 text-gray-600">|</span>
                      <span className="text-text-secondary">Total Bets:</span>{' '}
                      <span className="text-white">{editTenant.stats.totalBets}</span>
                    </p>
                  </div>
                </>
              )}

              {/* ===== ADMIN TAB ===== */}
              {editTab === 'admin' && (
                <>
                  {adminLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                    </div>
                  ) : adminInfo?.hasAdmin ? (
                    <>
                      {/* Admin Info Card */}
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{adminInfo.admin?.displayName}</h3>
                            <p className="text-xs text-text-secondary">{adminInfo.admin?.email}</p>
                          </div>
                          <span className="ml-auto px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 font-medium">
                            {adminInfo.admin?.role}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white/5 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-text-secondary">Username</p>
                            <p className="text-sm font-medium text-white">{adminInfo.admin?.username}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-text-secondary">Status</p>
                            <p className="text-sm font-medium text-green-400">{adminInfo.admin?.status}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-text-secondary">Balance</p>
                            <p className="text-sm font-bold text-cyan-400">${adminInfo.admin?.balance?.toFixed(2) || '0.00'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reset Password */}
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <Key className="w-4 h-4 text-yellow-400" />
                          Reset Password
                        </h4>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="Enter new password..."
                            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                          />
                          <button
                            onClick={handleResetPassword}
                            disabled={!resetPassword}
                            className="px-4 py-2.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Manage Credits */}
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-green-400" />
                          Manage Credits
                        </h4>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                              <input
                                type="number"
                                value={creditsAmount}
                                onChange={(e) => setCreditsAmount(e.target.value)}
                                placeholder="Amount..."
                                min={0}
                                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                              />
                            </div>
                            <button
                              onClick={handleAddCredits}
                              disabled={!creditsAmount || parseFloat(creditsAmount) <= 0}
                              className="px-4 py-2.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Deposit
                            </button>
                            <button
                              onClick={handleWithdrawCredits}
                              disabled={!creditsAmount || parseFloat(creditsAmount) <= 0}
                              className="px-4 py-2.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Withdraw
                            </button>
                          </div>
                          <input
                            type="text"
                            value={creditsNote}
                            onChange={(e) => setCreditsNote(e.target.value)}
                            placeholder="Note (optional)..."
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* No Admin - Create Form */
                    <div className="bg-white/5 rounded-xl p-5 border border-yellow-500/20">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">No Admin Account</h3>
                          <p className="text-xs text-text-secondary">Create an admin account for this brand</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
                          <input
                            type="email"
                            value={newAdminForm.email}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                            placeholder="admin@brand.com"
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
                          <input
                            type="text"
                            value={newAdminForm.username}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                            placeholder="brandadmin"
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
                          <input
                            type="text"
                            value={newAdminForm.password}
                            onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                            placeholder="Strong password..."
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                          />
                        </div>
                        <button
                          onClick={createAdmin}
                          disabled={!newAdminForm.email || !newAdminForm.password || !newAdminForm.username}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <UserPlus className="w-4 h-4" />
                          Create Admin Account
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ===== THEME TAB ===== */}
              {editTab === 'theme' && (
                <>
                  {/* Color Presets */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Quick Presets</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyColorPreset(preset)}
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/30 transition-colors"
                        >
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primary }} />
                          <span className="text-xs text-gray-300">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Live Preview</label>
                    <div
                      className="rounded-xl p-4 border border-white/10"
                      style={{ backgroundColor: editForm.backgroundColor }}
                    >
                      <div
                        className="rounded-lg p-4 mb-3"
                        style={{ backgroundColor: editForm.cardColor }}
                      >
                        <h3 className="text-white font-bold mb-2" style={{ color: editForm.primaryColor }}>
                          {editForm.brandName || 'Brand Name'}
                        </h3>
                        <p className="text-sm text-text-secondary mb-3">This is how your brand will look</p>
                        <div className="flex gap-2">
                          <button
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: editForm.primaryColor }}
                          >
                            Primary Button
                          </button>
                          <button
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: editForm.secondaryColor }}
                          >
                            Secondary
                          </button>
                          <button
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: editForm.accentColor }}
                          >
                            Accent
                          </button>
                          <button
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                            style={{ backgroundColor: editForm.dangerColor }}
                          >
                            Danger
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Color Pickers */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'primaryColor', label: 'Primary Color' },
                      { key: 'secondaryColor', label: 'Secondary Color' },
                      { key: 'backgroundColor', label: 'Background' },
                      { key: 'cardColor', label: 'Card Color' },
                      { key: 'accentColor', label: 'Accent Color' },
                      { key: 'dangerColor', label: 'Danger Color' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={(editForm as any)[key]}
                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent"
                          />
                          <input
                            type="text"
                            value={(editForm as any)[key]}
                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono focus:border-cyan-500 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ===== GAMES TAB ===== */}
              {editTab === 'games' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Allowed Games</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_GAMES.map((game) => (
                        <button
                          key={game}
                          onClick={() => toggleGame(game)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                            editForm.allowedGames.includes(game)
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                              : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              editForm.allowedGames.includes(game)
                                ? 'bg-cyan-500 border-cyan-500'
                                : 'border-gray-500'
                            }`}
                          >
                            {editForm.allowedGames.includes(game) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          {game.charAt(0).toUpperCase() + game.slice(1).replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-text-secondary mt-2">
                      {editForm.allowedGames.length} / {ALL_GAMES.length} games enabled
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 shrink-0">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm text-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saveSuccess ? (
                  <><Check className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
