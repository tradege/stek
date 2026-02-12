'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Palette,
  Save,
  RotateCcw,
  Globe,
  Check,
  AlertCircle,
  Eye,
  Image,
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface BrandSettings {
  brandName: string;
  domain: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  dangerColor: string;
  logoUrl: string;
  faviconUrl: string;
  heroImageUrl: string;
  backgroundImageUrl: string;
  locale: string;
  jurisdiction: string;
}

const COLOR_FIELDS = [
  { key: 'primaryColor', label: 'Primary Color', desc: 'Main brand color — buttons, links, highlights' },
  { key: 'secondaryColor', label: 'Secondary Color', desc: 'Secondary elements — borders, subtle backgrounds' },
  { key: 'accentColor', label: 'Accent Color', desc: 'Success states — win indicators, positive actions' },
  { key: 'dangerColor', label: 'Danger Color', desc: 'Error states — loss indicators, destructive actions' },
  { key: 'backgroundColor', label: 'Background', desc: 'Main page background color' },
  { key: 'cardColor', label: 'Card Background', desc: 'Card and panel background color' },
];

export default function BrandSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [original, setOriginal] = useState<BrandSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/super-admin/brand-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load brand settings');
      const data = await res.json();
      setSettings(data);
      setOriginal(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token || !settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/brand-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
          accentColor: settings.accentColor,
          backgroundColor: settings.backgroundColor,
          cardColor: settings.cardColor,
          dangerColor: settings.dangerColor,
          logoUrl: settings.logoUrl,
          faviconUrl: settings.faviconUrl,
          heroImageUrl: settings.heroImageUrl,
          backgroundImageUrl: settings.backgroundImageUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save');
      }
      setOriginal({ ...settings });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (original) {
      setSettings({ ...original });
      setError(null);
    }
  };

  const updateField = (key: string, value: string) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const hasChanges = settings && original && JSON.stringify(settings) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <div>
            <h3 className="text-lg font-bold text-red-400">Access Denied</h3>
            <p className="text-sm text-text-secondary mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Palette className="w-7 h-7 text-cyan-400" />
            Brand Settings
          </h1>
          <p className="text-text-secondary mt-1">
            Customize the look and feel of <span className="text-cyan-400 font-semibold">{settings.brandName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
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

      {/* Success / Error Messages */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <Check className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-400">Brand settings saved successfully! Changes will take effect on the next page load.</p>
        </div>
      )}
      {error && settings && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Brand Info (read-only) */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          Brand Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-3">
            <span className="text-xs text-text-secondary block mb-1">Brand Name</span>
            <span className="text-white font-medium">{settings.brandName}</span>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <span className="text-xs text-text-secondary block mb-1">Domain</span>
            <span className="text-cyan-400 font-medium">{settings.domain}</span>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <span className="text-xs text-text-secondary block mb-1">Jurisdiction</span>
            <span className="text-white font-medium">{settings.jurisdiction || 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* Color Settings */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Palette className="w-5 h-5 text-cyan-400" />
          Color Scheme
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">{field.label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={(settings as any)[field.key] || '#000000'}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer border border-white/10 flex-shrink-0"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={(settings as any)[field.key] || ''}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-text-secondary mt-1">{field.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Preview */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-text-secondary uppercase mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Live Preview
          </h3>
          <div
            className="rounded-xl p-6 border border-white/10"
            style={{ backgroundColor: settings.backgroundColor }}
          >
            <div
              className="rounded-lg p-5 mb-4"
              style={{ backgroundColor: settings.cardColor }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: settings.primaryColor + '33' }}
                >
                  <Globe className="w-5 h-5" style={{ color: settings.primaryColor }} />
                </div>
                <span className="font-bold text-white text-lg">{settings.brandName}</span>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-black"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-black"
                  style={{ backgroundColor: settings.accentColor }}
                >
                  Win / Success
                </button>
                <button
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: settings.dangerColor }}
                >
                  Loss / Danger
                </button>
                <button
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white border"
                  style={{ borderColor: settings.secondaryColor, backgroundColor: settings.secondaryColor + '44' }}
                >
                  Secondary
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Assets */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Image className="w-5 h-5 text-cyan-400" />
          Brand Assets
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: 'logoUrl', label: 'Logo URL', placeholder: 'https://example.com/logo.png' },
            { key: 'faviconUrl', label: 'Favicon URL', placeholder: 'https://example.com/favicon.ico' },
            { key: 'heroImageUrl', label: 'Hero Image URL', placeholder: 'https://example.com/hero.jpg' },
            { key: 'backgroundImageUrl', label: 'Background Image URL', placeholder: 'https://example.com/bg.jpg' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-text-secondary mb-2">{field.label}</label>
              <input
                type="text"
                value={(settings as any)[field.key] || ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
              />
              {(settings as any)[field.key] && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/10 h-20 bg-white/5">
                  <img
                    src={(settings as any)[field.key]}
                    alt={field.label}
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
