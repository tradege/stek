'use client';
import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: string;
  bonusPercent: number;
  maxBonus: number;
  wagerReq: number;
  minDeposit: number;
  currency: string;
  imageUrl?: string;
  startsAt: string;
  expiresAt?: string;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const res = await fetch(`${API_URL}/promotions`);
        if (res.ok) {
          const data = await res.json();
          setPromotions(data);
        }
      } catch (err) {
        console.error('Failed to fetch promotions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPromotions();
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT_BONUS': return '💰';
      case 'RELOAD_BONUS': return '🔄';
      case 'CASHBACK': return '💸';
      case 'VIP_BONUS': return '👑';
      default: return '🎁';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT_BONUS': return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
      case 'RELOAD_BONUS': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'CASHBACK': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'VIP_BONUS': return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      default: return 'from-accent-primary/20 to-purple-500/20 border-accent-primary/30';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-bg-primary to-bg-secondary">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-3">Promotions & Rewards</h1>
            <p className="text-gray-400">Claim exclusive bonuses and boost your gameplay</p>
          </div>

          {promotions.length === 0 ? (
            <div className="text-center py-12 bg-[#1A1F2E] rounded-2xl border border-gray-700/50">
              <div className="text-5xl mb-4">🎁</div>
              <h2 className="text-2xl font-bold text-white mb-2">No Active Promotions</h2>
              <p className="text-gray-400">Check back soon for exciting new offers!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {promotions.map((promo) => (
                <div key={promo.id} 
                  className={`relative bg-gradient-to-br ${getTypeColor(promo.type)} rounded-2xl p-6 border overflow-hidden group hover:scale-[1.02] transition-transform`}>
                  {/* Background decoration */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
                  
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{getTypeIcon(promo.type)}</div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{promo.title}</h3>
                          <div className="text-accent-primary text-sm font-semibold">
                            {promo.bonusPercent}% Bonus up to ${promo.maxBonus}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                      {promo.description}
                    </p>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Min Deposit</div>
                        <div className="text-white font-bold">${promo.minDeposit}</div>
                      </div>
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Wager Req</div>
                        <div className="text-white font-bold">{promo.wagerReq}x</div>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <button className="w-full py-3 bg-accent-primary text-black font-bold rounded-lg hover:bg-accent-primary/90 transition-colors">
                      Claim Now
                    </button>

                    {/* Expiry */}
                    {promo.expiresAt && (
                      <div className="text-center mt-3 text-xs text-gray-400">
                        Expires: {new Date(promo.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="mt-8 bg-[#1A1F2E] rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-3">Terms & Conditions</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>• All bonuses are subject to wagering requirements before withdrawal</li>
              <li>• Only one active bonus per user at a time</li>
              <li>• Bonuses expire 30 days after activation</li>
              <li>• Maximum bet limit of $5 while bonus is active</li>
              <li>• We reserve the right to cancel bonuses in case of abuse</li>
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
