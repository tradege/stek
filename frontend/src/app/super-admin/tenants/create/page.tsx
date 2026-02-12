'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Building2,
  Globe,
  Palette,
  Gamepad2,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Shield,
  Key,
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

const ALL_GAMES = [
  { id: 'CRASH', label: 'Crash', icon: '🚀' },
  { id: 'PLINKO', label: 'Plinko', icon: '⚪' },
  { id: 'DICE', label: 'Dice', icon: '🎲' },
  { id: 'MINES', label: 'Mines', icon: '💣' },
  { id: 'LIMBO', label: 'Limbo', icon: '📊' },
  { id: 'PENALTY', label: 'Penalty', icon: '⚽' },
  { id: 'OLYMPUS', label: 'Olympus Slots', icon: '⚡' },
  { id: 'CARD_RUSH', label: 'Card Rush', icon: '🃏' },
  { id: 'SPORTS', label: 'Sports Betting', icon: '🏆' },
];

const STEPS = ['Brand Info', 'Admin Account', 'Theme', 'Games', 'Review'];

export default function CreateTenantPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    brandName: '',
    domain: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerUsername: '',
    ggrFee: 12,
    locale: 'en',
    jurisdiction: '',
    licenseType: '',
    primaryColor: '#00F0FF',
    secondaryColor: '#131B2C',
    accentColor: '#00D46E',
    dangerColor: '#FF385C',
    backgroundColor: '#0A0E17',
    cardColor: '#131B2C',
    logoUrl: '',
    allowedGames: ALL_GAMES.map((g) => g.id),
  });

  const updateForm = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const toggleGame = (gameId: string) => {
    setForm((prev) => ({
      ...prev,
      allowedGames: prev.allowedGames.includes(gameId)
        ? prev.allowedGames.filter((g) => g !== gameId)
        : [...prev.allowedGames, gameId],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return form.brandName.trim() && form.domain.trim() && form.ggrFee >= 0;
      case 1:
        return form.ownerEmail.trim() && form.ownerEmail.includes('@');
      case 2:
        return true;
      case 3:
        return form.allowedGames.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create tenant');
      }

      setCreatedCredentials(data.adminCredentials);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen with credentials
  if (success) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-bg-card border border-green-500/30 rounded-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Brand Created Successfully!</h2>
            <p className="text-text-secondary">
              <span className="text-cyan-400 font-semibold">{form.brandName}</span> is now live at{' '}
              <span className="text-cyan-400 font-semibold">{form.domain}</span>
            </p>
          </div>

          {/* Admin Credentials Card */}
          {createdCredentials && (
            <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Key className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Admin Login Credentials</h3>
                  <p className="text-xs text-yellow-400">Save these credentials — the password will not be shown again!</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Login URL', value: createdCredentials.loginUrl, key: 'url' },
                  { label: 'Email', value: createdCredentials.email, key: 'email' },
                  { label: 'Username', value: createdCredentials.username, key: 'username' },
                  { label: 'Password', value: createdCredentials.password, key: 'password' },
                  { label: 'Role', value: createdCredentials.role, key: 'role' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between bg-black/30 rounded-lg px-4 py-3">
                    <div>
                      <span className="text-xs text-text-secondary block">{item.label}</span>
                      <span className="text-white font-mono text-sm">
                        {item.key === 'password' && !showPassword
                          ? '••••••••••••'
                          : item.value}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.key === 'password' && (
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-text-secondary" />
                          ) : (
                            <Eye className="w-4 h-4 text-text-secondary" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(item.value, item.key)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {copiedField === item.key ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-text-secondary" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const text = `Brand: ${form.brandName}\nLogin URL: ${createdCredentials.loginUrl}\nEmail: ${createdCredentials.email}\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}`;
                  navigator.clipboard.writeText(text);
                  setCopiedField('all');
                  setTimeout(() => setCopiedField(null), 2000);
                }}
                className="w-full mt-4 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied All Credentials!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy All Credentials
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/super-admin/tenants')}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
            >
              Back to Brands
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setCreatedCredentials(null);
                setForm({
                  brandName: '', domain: '', ownerEmail: '', ownerPassword: '', ownerUsername: '',
                  ggrFee: 12, locale: 'en', jurisdiction: '', licenseType: '',
                  primaryColor: '#00F0FF', secondaryColor: '#131B2C', accentColor: '#00D46E',
                  dangerColor: '#FF385C', backgroundColor: '#0A0E17', cardColor: '#131B2C',
                  logoUrl: '', allowedGames: ALL_GAMES.map((g) => g.id),
                });
                setStep(0);
              }}
              className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Another Brand
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/super-admin/tenants')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Create New Brand</h1>
          <p className="text-text-secondary mt-1">Set up a new white-label casino brand with admin access</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step
                  ? 'bg-cyan-600 text-white'
                  : i === step
                  ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500'
                  : 'bg-white/5 text-text-secondary'
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`text-sm font-medium hidden sm:block ${
                i === step ? 'text-cyan-400' : 'text-text-secondary'
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < step ? 'bg-cyan-600' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        {/* Step 0: Brand Info */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Brand Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Brand Name *</label>
                <input
                  type="text"
                  value={form.brandName}
                  onChange={(e) => updateForm('brandName', e.target.value)}
                  placeholder="e.g., Lucky Casino"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Domain *</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => updateForm('domain', e.target.value)}
                  placeholder="e.g., luckycasino.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">GGR Fee (%) *</label>
                <input
                  type="number"
                  value={form.ggrFee}
                  onChange={(e) => updateForm('ggrFee', parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                />
                <p className="text-xs text-text-secondary mt-1">Your commission from the brand&apos;s GGR</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Locale</label>
                <select
                  value={form.locale}
                  onChange={(e) => updateForm('locale', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                >
                  <option value="en">English</option>
                  <option value="he">Hebrew (RTL)</option>
                  <option value="ar">Arabic (RTL)</option>
                  <option value="es">Spanish</option>
                  <option value="pt">Portuguese</option>
                  <option value="ru">Russian</option>
                  <option value="tr">Turkish</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Jurisdiction</label>
                <select
                  value={form.jurisdiction}
                  onChange={(e) => updateForm('jurisdiction', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition-colors"
                >
                  <option value="">Select...</option>
                  <option value="curacao">Curacao</option>
                  <option value="malta">Malta (MGA)</option>
                  <option value="gibraltar">Gibraltar</option>
                  <option value="isle_of_man">Isle of Man</option>
                  <option value="kahnawake">Kahnawake</option>
                  <option value="costa_rica">Costa Rica</option>
                  <option value="anjouan">Anjouan</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Admin Account */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <UserPlus className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Admin Account</h2>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-cyan-300 font-medium">Automatic Admin Creation</p>
                  <p className="text-xs text-text-secondary mt-1">
                    An ADMIN account will be automatically created for the brand owner. They will have full access to the Admin Panel for their brand, including player management, bet monitoring, and brand settings.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Admin Email *</label>
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => updateForm('ownerEmail', e.target.value)}
                  placeholder="e.g., admin@luckycasino.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
                />
                <p className="text-xs text-text-secondary mt-1">This email will be used to login to the admin panel</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Admin Username</label>
                <input
                  type="text"
                  value={form.ownerUsername}
                  onChange={(e) => updateForm('ownerUsername', e.target.value)}
                  placeholder={form.brandName ? form.brandName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin' : 'auto-generated'}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
                />
                <p className="text-xs text-text-secondary mt-1">Leave empty to auto-generate from brand name</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-2">Admin Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.ownerPassword}
                    onChange={(e) => updateForm('ownerPassword', e.target.value)}
                    placeholder="Leave empty to auto-generate a secure password"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-text-secondary" />
                    ) : (
                      <Eye className="w-5 h-5 text-text-secondary" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  If left empty, a secure 12-character password will be generated automatically. The credentials will be shown after creation.
                </p>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-sm text-yellow-300">
                <strong>Important:</strong> The admin credentials will only be shown once after creation. Make sure to save them securely.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Theme */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Brand Theme</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: 'primaryColor', label: 'Primary Color' },
                { key: 'accentColor', label: 'Accent Color' },
                { key: 'dangerColor', label: 'Danger Color' },
                { key: 'backgroundColor', label: 'Background' },
                { key: 'cardColor', label: 'Card Background' },
                { key: 'secondaryColor', label: 'Secondary' },
              ].map((c) => (
                <div key={c.key}>
                  <label className="block text-sm font-medium text-text-secondary mb-2">{c.label}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={(form as any)[c.key]}
                      onChange={(e) => updateForm(c.key, e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border border-white/10"
                    />
                    <input
                      type="text"
                      value={(form as any)[c.key]}
                      onChange={(e) => updateForm(c.key, e.target.value)}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Live Preview */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-text-secondary uppercase mb-4">Live Preview</h3>
              <div
                className="rounded-xl p-6 border border-white/10"
                style={{ backgroundColor: form.backgroundColor }}
              >
                <div
                  className="rounded-lg p-4 mb-4"
                  style={{ backgroundColor: form.cardColor }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: form.primaryColor + '33' }}
                    >
                      <Globe className="w-4 h-4" style={{ color: form.primaryColor }} />
                    </div>
                    <span className="font-bold text-white">{form.brandName || 'Brand Name'}</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium text-black"
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      Primary Button
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium text-black"
                      style={{ backgroundColor: form.accentColor }}
                    >
                      Accent Button
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: form.dangerColor }}
                    >
                      Danger Button
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Logo URL (optional)</label>
              <input
                type="text"
                value={form.logoUrl}
                onChange={(e) => updateForm('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-text-secondary focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 3: Games */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-6 h-6 text-cyan-400" />
                <h2 className="text-xl font-semibold text-white">Allowed Games</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setForm((prev) => ({ ...prev, allowedGames: ALL_GAMES.map((g) => g.id) }))}
                  className="px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setForm((prev) => ({ ...prev, allowedGames: [] }))}
                  className="px-3 py-1.5 text-xs bg-white/5 text-text-secondary rounded-lg hover:bg-white/10 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {ALL_GAMES.map((game) => {
                const isSelected = form.allowedGames.includes(game.id);
                return (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="text-3xl mb-2">{game.icon}</div>
                    <p className={`font-medium ${isSelected ? 'text-cyan-400' : 'text-text-secondary'}`}>
                      {game.label}
                    </p>
                    {isSelected && (
                      <div className="mt-2">
                        <Check className="w-4 h-4 text-cyan-400 mx-auto" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-text-secondary">
              {form.allowedGames.length} of {ALL_GAMES.length} games selected
            </p>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Check className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Review & Create</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary uppercase">Brand Details</h3>
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Brand Name</span>
                    <span className="text-white font-medium">{form.brandName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Domain</span>
                    <span className="text-white font-medium">{form.domain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">GGR Fee</span>
                    <span className="text-yellow-400 font-bold">{form.ggrFee}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Locale</span>
                    <span className="text-white font-medium">{form.locale}</span>
                  </div>
                  {form.jurisdiction && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Jurisdiction</span>
                      <span className="text-white font-medium">{form.jurisdiction}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-secondary uppercase">Admin Account</h3>
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Email</span>
                    <span className="text-white font-medium">{form.ownerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Username</span>
                    <span className="text-white font-medium">
                      {form.ownerUsername || form.brandName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Password</span>
                    <span className="text-white font-medium">
                      {form.ownerPassword ? '••••••••' : 'Auto-generated'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Role</span>
                    <span className="text-cyan-400 font-bold">ADMIN</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-text-secondary uppercase">Theme & Games</h3>
                <div className="bg-white/5 rounded-lg p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'Primary', color: form.primaryColor },
                      { label: 'Accent', color: form.accentColor },
                      { label: 'Danger', color: form.dangerColor },
                      { label: 'BG', color: form.backgroundColor },
                      { label: 'Card', color: form.cardColor },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: c.color }} />
                        <span className="text-xs text-text-secondary">{c.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-sm text-text-secondary mb-2">
                      {form.allowedGames.length} Games Enabled:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {form.allowedGames.map((gId) => {
                        const game = ALL_GAMES.find((g) => g.id === gId);
                        return (
                          <span
                            key={gId}
                            className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg"
                          >
                            {game?.icon} {game?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2.5 text-text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Creating Brand & Admin...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Brand
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
