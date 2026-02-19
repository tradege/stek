'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface NetworkOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  referralCode: string;
  referralLink: string;
}

const NetworkOverviewModal: React.FC<NetworkOverviewModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
    }
  }, [isOpen, token]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/affiliates/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {}
    setLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (val: number) => `$${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            <span className="text-2xl">🌐</span>
            Network Overview
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-primary"></div>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                  <div className="text-text-secondary text-xs mb-1">Total Referrals</div>
                  <div className="text-white font-bold text-lg">{stats?.totalReferrals || 0}</div>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                  <div className="text-text-secondary text-xs mb-1">Active Referrals</div>
                  <div className="text-green-400 font-bold text-lg">{stats?.activeReferrals || 0}</div>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                  <div className="text-text-secondary text-xs mb-1">Total Earnings</div>
                  <div className="text-accent-primary font-bold text-lg">{formatCurrency(stats?.totalEarnings || 0)}</div>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                  <div className="text-text-secondary text-xs mb-1">Pending</div>
                  <div className="text-yellow-400 font-bold text-lg">{formatCurrency(stats?.pendingEarnings || 0)}</div>
                </div>
              </div>

              {/* Referral Link */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Your Referral Link</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-bg-main p-3 rounded-lg border border-white/10 overflow-hidden">
                    <p className="text-white text-sm font-mono truncate">
                      {stats?.referralLink || `${window.location.origin}?ref=${stats?.referralCode || 'N/A'}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(stats?.referralLink || `${window.location.origin}?ref=${stats?.referralCode || ''}`)}
                    className="px-4 py-3 bg-accent-primary text-black font-bold rounded-lg hover:bg-accent-primary/90 transition-colors text-sm whitespace-nowrap"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                {stats?.referralCode && (
                  <p className="text-text-secondary text-xs mt-2">
                    Referral Code: <span className="text-accent-primary font-mono">{stats.referralCode}</span>
                  </p>
                )}
              </div>

              {/* How It Works */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">How Affiliates Work</h3>
                <div className="space-y-3">
                  {[
                    { emoji: '🔗', title: 'Share Your Link', desc: 'Send your unique referral link to friends' },
                    { emoji: '👥', title: 'They Sign Up', desc: 'When they register using your link' },
                    { emoji: '💰', title: 'Earn Commission', desc: 'Get a percentage of their wagering activity' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-xl">{step.emoji}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{step.title}</p>
                        <p className="text-text-secondary text-xs">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkOverviewModal;
