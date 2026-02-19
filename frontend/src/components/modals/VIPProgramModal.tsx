'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface VIPProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const vipTiers = [
  { level: 0, name: 'Bronze', icon: '🥉', color: 'from-orange-700/40 to-orange-900/40', minWager: 0, rakeback: '0%', withdrawalLimit: '$500/day', perks: ['Basic support', 'Standard games'] },
  { level: 1, name: 'Silver', icon: '🥈', color: 'from-gray-400/40 to-gray-600/40', minWager: 1000, rakeback: '5%', withdrawalLimit: '$1,000/day', perks: ['Priority support', '5% rakeback', 'Weekly bonus'] },
  { level: 2, name: 'Gold', icon: '🥇', color: 'from-yellow-500/40 to-yellow-700/40', minWager: 10000, rakeback: '10%', withdrawalLimit: '$5,000/day', perks: ['VIP support', '10% rakeback', 'Daily bonus', 'Exclusive games'] },
  { level: 3, name: 'Platinum', icon: '💎', color: 'from-cyan-400/40 to-cyan-600/40', minWager: 50000, rakeback: '15%', withdrawalLimit: '$25,000/day', perks: ['Dedicated manager', '15% rakeback', 'Custom limits', 'Luxury gifts'] },
  { level: 4, name: 'Diamond', icon: '👑', color: 'from-purple-400/40 to-purple-600/40', minWager: 250000, rakeback: '25%', withdrawalLimit: 'Unlimited', perks: ['Personal concierge', '25% rakeback', 'No limits', 'VIP events', 'Luxury rewards'] },
];

const VIPProgramModal: React.FC<VIPProgramModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const currentLevel = (user as any)?.vipLevel || 0;
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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
            <span className="text-2xl">👑</span>
            VIP Program
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Current Level */}
          <div className="bg-gradient-to-r from-accent-primary/10 to-purple-500/10 rounded-xl border border-accent-primary/20 p-5 text-center">
            <span className="text-4xl block mb-2">{vipTiers[currentLevel]?.icon || '🥉'}</span>
            <h3 className="text-lg font-bold text-white">Your Level: {vipTiers[currentLevel]?.name || 'Bronze'}</h3>
            <p className="text-text-secondary text-sm mt-1">Keep playing to unlock higher tiers!</p>
          </div>

          {/* VIP Tiers */}
          {vipTiers.map((tier) => (
            <div
              key={tier.level}
              onClick={() => setSelectedTier(selectedTier === tier.level ? null : tier.level)}
              className={`bg-white/5 rounded-xl border p-4 cursor-pointer transition-all hover:bg-white/10 ${
                currentLevel === tier.level ? 'border-accent-primary' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                    <span className="text-xl">{tier.icon}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{tier.name}</h4>
                    <p className="text-text-secondary text-xs">Level {tier.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  {currentLevel === tier.level && (
                    <span className="px-2 py-1 bg-accent-primary/10 text-accent-primary text-xs font-bold rounded-lg">CURRENT</span>
                  )}
                  <p className="text-accent-primary text-sm font-semibold mt-1">{tier.rakeback}</p>
                </div>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-bg-main rounded-lg p-2 text-center">
                  <div className="text-text-secondary text-[10px]">Min Wager</div>
                  <div className="text-white text-xs font-bold">${tier.minWager.toLocaleString()}</div>
                </div>
                <div className="bg-bg-main rounded-lg p-2 text-center">
                  <div className="text-text-secondary text-[10px]">Rakeback</div>
                  <div className="text-accent-primary text-xs font-bold">{tier.rakeback}</div>
                </div>
                <div className="bg-bg-main rounded-lg p-2 text-center">
                  <div className="text-text-secondary text-[10px]">Withdraw</div>
                  <div className="text-white text-xs font-bold">{tier.withdrawalLimit}</div>
                </div>
              </div>

              {/* Expanded Perks */}
              {selectedTier === tier.level && (
                <div className="border-t border-white/10 pt-3 mt-3">
                  <p className="text-xs font-semibold text-white mb-2">Perks:</p>
                  <ul className="space-y-1">
                    {tier.perks.map((perk, i) => (
                      <li key={i} className="text-xs text-text-secondary flex items-center gap-2">
                        <span className="text-accent-primary">✓</span> {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {/* How It Works */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">How It Works</h3>
            <div className="space-y-3">
              {[
                { emoji: '🎮', title: 'Play Games', desc: 'Every bet counts towards VIP progress' },
                { emoji: '📈', title: 'Level Up', desc: 'Reach wagering milestones to advance' },
                { emoji: '🎁', title: 'Earn Rewards', desc: 'Enjoy rakeback, bonuses & exclusive perks' },
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
        </div>
      </div>
    </div>
  );
};

export default VIPProgramModal;
