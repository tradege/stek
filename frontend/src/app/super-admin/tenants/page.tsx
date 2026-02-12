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
} from 'lucide-react';
import config from '@/config/api';
import Link from 'next/link';

const API_URL = config.apiUrl;

const ALL_GAMES = [
  'crash', 'plinko', 'mines', 'dice', 'limbo',
  'penalty', 'olympus', 'card-rush',
];

interface Tenant {
  id: string;
  brandName: string;
  domain: string;
  active: boolean;
  locale: string;
  ggrFee: number;
  ownerEmail: string;
  allowedGames: string[];
  stats: {
    totalPlayers: number;
    totalBets: number;
    ggr: number;
    ggrFee: number;
    commission: number;
  };
  createdAt: string;
}

export default function TenantsPage() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit modal state
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({
    brandName: '',
    domain: '',
    ownerEmail: '',
    ggrFee: 0,
    locale: 'en',
    allowedGames: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const toggleTenant = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
    setEditForm({
      brandName: tenant.brandName,
      domain: tenant.domain,
      ownerEmail: tenant.ownerEmail || '',
      ggrFee: tenant.ggrFee || tenant.stats.ggrFee || 12,
      locale: tenant.locale || 'en',
      allowedGames: tenant.allowedGames || [...ALL_GAMES],
    });
    setSaveSuccess(false);
  };

  const closeEditModal = () => {
    setEditTenant(null);
    setSaveSuccess(false);
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setSaveSuccess(true);
        fetchTenants();
        setTimeout(() => closeEditModal(), 1200);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    const v = Number(val) || 0;
    if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  const filteredTenants = tenants.filter(
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
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{tenant.brandName}</h3>
                  <p className="text-xs text-text-secondary">{tenant.domain}</p>
                </div>
              </div>
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
              <span>Locale: <strong className="text-white">{tenant.locale || 'en'}</strong></span>
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
          <div className="bg-[#1a2c38] border border-white/10 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Edit className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Edit Brand</h2>
                  <p className="text-xs text-text-secondary">{editTenant.brandName}</p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Brand Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Brand Name</label>
                <input
                  type="text"
                  value={editForm.brandName}
                  onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Domain */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Domain</label>
                <input
                  type="text"
                  value={editForm.domain}
                  onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Owner Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Owner Email</label>
                <input
                  type="email"
                  value={editForm.ownerEmail}
                  onChange={(e) => setEditForm({ ...editForm, ownerEmail: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>

              {/* GGR Fee + Locale Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">GGR Fee (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
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

              {/* Allowed Games */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Allowed Games</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_GAMES.map((game) => (
                    <button
                      key={game}
                      onClick={() => toggleGame(game)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        editForm.allowedGames.includes(game)
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
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

              {/* Tenant Info (read-only) */}
              <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-text-secondary">
                  <span className="text-gray-400">ID:</span>{' '}
                  <span className="text-white font-mono">{editTenant.id}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  <span className="text-gray-400">Created:</span>{' '}
                  <span className="text-white">
                    {new Date(editTenant.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </p>
                <p className="text-xs text-text-secondary">
                  <span className="text-gray-400">Players:</span>{' '}
                  <span className="text-white">{editTenant.stats.totalPlayers}</span>
                  <span className="mx-2 text-gray-600">|</span>
                  <span className="text-gray-400">Total Bets:</span>{' '}
                  <span className="text-white">{editTenant.stats.totalBets}</span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
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
                  <>
                    <Check className="w-4 h-4" />
                    Saved!
                  </>
                ) : saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
