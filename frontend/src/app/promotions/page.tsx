'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';

const promotions = [
  {
    id: 'welcome',
    title: 'Welcome Bonus',
    subtitle: '100% up to $1,000',
    description: 'Double your first deposit! Get a 100% match bonus up to $1,000 USDT on your first deposit. Start your journey with twice the bankroll.',
    icon: '🎉',
    gradient: 'from-cyan-500 to-blue-600',
    terms: 'Min deposit: $10. Wagering: 30x. Max bet: $5. Expires in 30 days.',
    active: true,
  },
  {
    id: 'daily-cashback',
    title: 'Daily Cashback',
    subtitle: 'Up to 15% back',
    description: 'Get cashback on your net losses every day. The higher your VIP level, the more cashback you receive. Automatically credited at midnight UTC.',
    icon: '💰',
    gradient: 'from-green-500 to-emerald-600',
    terms: 'Cashback calculated on net losses. No wagering requirements on cashback. VIP Bronze: 5%, Silver: 7%, Gold: 10%, Platinum+: 15%.',
    active: true,
  },
  {
    id: 'referral',
    title: 'Referral Program',
    subtitle: 'Earn 25% commission',
    description: 'Invite friends and earn 25% of the house edge on every bet they place. Lifetime commissions with no cap. Build your network and earn passively.',
    icon: '🤝',
    gradient: 'from-purple-500 to-pink-600',
    terms: 'Commission paid in real-time. 3-tier MLM system. Minimum withdrawal: $10.',
    active: true,
  },
  {
    id: 'reload',
    title: 'Weekly Reload',
    subtitle: '50% up to $500',
    description: 'Every Monday, get a 50% reload bonus on your deposit. Keep the momentum going with extra funds every week.',
    icon: '🔄',
    gradient: 'from-orange-500 to-red-600',
    terms: 'Available every Monday. Min deposit: $20. Wagering: 20x. Max bet: $10.',
    active: true,
  },
  {
    id: 'tournament',
    title: 'Weekly Tournament',
    subtitle: '$10,000 Prize Pool',
    description: 'Compete against other players in our weekly Crash tournament. Top 50 players share the $10,000 prize pool based on highest multipliers.',
    icon: '🏆',
    gradient: 'from-yellow-500 to-amber-600',
    terms: 'Runs Monday to Sunday. Min bet: $1. Leaderboard updates in real-time.',
    active: true,
  },
  {
    id: 'vip-exclusive',
    title: 'VIP Exclusive Drops',
    subtitle: 'Random rewards',
    description: 'VIP Gold+ members receive random bonus drops while playing. Surprise rewards that can include free bets, cashback boosts, and merchandise.',
    icon: '🎁',
    gradient: 'from-indigo-500 to-violet-600',
    terms: 'Available for VIP Gold and above. Drops are random and cannot be predicted. No wagering on free bet drops.',
    active: true,
  },
];

export default function PromotionsPage() {
  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8" data-testid="promotions-page">
        {/* Hero */}
        <div className="relative bg-bg-card border border-white/10 rounded-2xl p-8 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-cyan-500/5" />
          <div className="relative z-10 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              🎁 Promotions & Bonuses
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Boost your bankroll with our generous promotions. New offers added regularly.
            </p>
          </div>
        </div>

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className="bg-bg-card border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all group"
            >
              {/* Header */}
              <div className={`bg-gradient-to-r ${promo.gradient} p-6`}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{promo.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{promo.title}</h3>
                    <p className="text-white/80 font-semibold">{promo.subtitle}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-text-secondary mb-4">{promo.description}</p>
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-xs text-text-secondary">
                    <span className="text-white font-medium">Terms: </span>
                    {promo.terms}
                  </p>
                </div>
                <button className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all">
                  Claim Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* General Terms */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">General Promotion Terms</h2>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li>• All promotions are subject to our general Terms of Service.</li>
            <li>• StakePro reserves the right to modify or cancel any promotion at any time.</li>
            <li>• Bonus abuse or multi-accounting will result in forfeiture of bonuses and account suspension.</li>
            <li>• Only one bonus can be active at a time unless otherwise stated.</li>
            <li>• Wagering requirements must be met before withdrawal of bonus funds.</li>
          </ul>
        </div>
      </div>
    </MainLayout>
  );
}
