'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';

const vipTiers = [
  {
    level: 0,
    name: 'Bronze',
    icon: '🥉',
    color: 'from-amber-700 to-amber-900',
    border: 'border-amber-700/30',
    minWager: 0,
    rakeback: '5%',
    withdrawalLimit: '$5,000/day',
    perks: ['Basic support', 'Standard withdrawal speed', '5% Rakeback'],
  },
  {
    level: 1,
    name: 'Silver',
    icon: '🥈',
    color: 'from-gray-400 to-gray-600',
    border: 'border-gray-400/30',
    minWager: 1000,
    rakeback: '7%',
    withdrawalLimit: '$10,000/day',
    perks: ['Priority support', 'Faster withdrawals', '7% Rakeback', 'Weekly bonus'],
  },
  {
    level: 2,
    name: 'Gold',
    icon: '🥇',
    color: 'from-yellow-400 to-yellow-600',
    border: 'border-yellow-400/30',
    minWager: 10000,
    rakeback: '10%',
    withdrawalLimit: '$25,000/day',
    perks: ['Dedicated account manager', 'Instant withdrawals', '10% Rakeback', 'Daily bonus', 'Exclusive promotions'],
  },
  {
    level: 3,
    name: 'Platinum',
    icon: '💎',
    color: 'from-primary to-primary',
    border: 'border-accent-primary/30',
    minWager: 50000,
    rakeback: '12%',
    withdrawalLimit: '$50,000/day',
    perks: ['VIP account manager', 'Priority instant withdrawals', '12% Rakeback', 'Custom bonuses', 'Birthday bonus', 'Exclusive events'],
  },
  {
    level: 4,
    name: 'Diamond',
    icon: '👑',
    color: 'from-purple-400 to-purple-600',
    border: 'border-purple-400/30',
    minWager: 250000,
    rakeback: '15%',
    withdrawalLimit: '$100,000/day',
    perks: ['Personal VIP host', 'No withdrawal limits', '15% Rakeback', 'Luxury gifts', 'Travel packages', 'Custom limits', 'All perks included'],
  },
  {
    level: 5,
    name: 'Iron',
    icon: '🏆',
    color: 'from-red-500 to-orange-500',
    border: 'border-red-500/30',
    minWager: 1000000,
    rakeback: '20%',
    withdrawalLimit: 'Unlimited',
    perks: ['Dedicated VIP team', 'Unlimited withdrawals', '20% Rakeback', 'Supercar giveaways', 'Private jet access', 'Invite-only tournaments', 'Everything unlocked'],
  },
];

export default function VIPPage() {
  const { user } = useAuth();
  const currentLevel = user?.vipLevel || 0;
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8" data-testid="vip-page">
        {/* Hero Section */}
        <div className="relative bg-bg-card border border-white/10 rounded-2xl p-8 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-transparent to-purple-500/5" />
          <div className="relative z-10 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              👑 VIP Program
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-6">
              Unlock exclusive rewards, higher limits, and premium perks as you play.
              The more you wager, the higher your VIP level.
            </p>
            {user && (
              <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-6 py-3">
                <span className="text-2xl">{vipTiers[Math.min(currentLevel, 5)].icon}</span>
                <span className="text-white font-semibold">
                  Your Level: <span className="text-accent-primary">{vipTiers[Math.min(currentLevel, 5)].name}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* VIP Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vipTiers.map((tier) => (
            <div
              key={tier.level}
              onClick={() => setSelectedTier(selectedTier === tier.level ? null : tier.level)}
              className={`bg-bg-card border rounded-2xl p-6 cursor-pointer transition-all hover:scale-[1.02] ${
                currentLevel === tier.level
                  ? 'border-accent-primary shadow-glow'
                  : tier.border + ' hover:border-white/20'
              }`}
            >
              {/* Tier Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                    <span className="text-2xl">{tier.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                    <p className="text-text-secondary text-xs">Level {tier.level}</p>
                  </div>
                </div>
                {currentLevel === tier.level && (
                  <span className="px-2 py-1 bg-accent-primary/10 text-accent-primary text-xs font-bold rounded-lg border border-accent-primary/20">
                    CURRENT
                  </span>
                )}
              </div>

              {/* Key Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Min Wager</span>
                  <span className="text-white font-medium">${tier.minWager.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Rakeback</span>
                  <span className="text-accent-primary font-medium">{tier.rakeback}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Withdrawal Limit</span>
                  <span className="text-white font-medium">{tier.withdrawalLimit}</span>
                </div>
              </div>

              {/* Perks */}
              {(selectedTier === tier.level) && (
                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="text-sm font-semibold text-white mb-2">Perks:</p>
                  <ul className="space-y-1">
                    {tier.perks.map((perk, i) => (
                      <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                        <span className="text-accent-primary">✓</span> {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎮</span>
              </div>
              <h3 className="text-white font-semibold mb-2">1. Play Games</h3>
              <p className="text-text-secondary text-sm">Every bet you place counts towards your VIP progress. Play any game to earn XP.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📈</span>
              </div>
              <h3 className="text-white font-semibold mb-2">2. Level Up</h3>
              <p className="text-text-secondary text-sm">Reach wagering milestones to automatically advance to the next VIP tier.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎁</span>
              </div>
              <h3 className="text-white font-semibold mb-2">3. Earn Rewards</h3>
              <p className="text-text-secondary text-sm">Enjoy increasing rakeback, exclusive bonuses, faster withdrawals, and luxury gifts.</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
