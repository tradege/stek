'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface VIPModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TierData {
  name: string;
  icon: string;
  color: string;
  glowColor: string;
  minVolume: number;
  tier1Rate: string;
  tier2Rate: string;
  tier3Rate: string;
  benefits: string[];
}

const TIERS: TierData[] = [
  {
    name: 'Iron',
    icon: '🔩',
    color: '#6B7280',
    glowColor: 'rgba(107, 114, 128, 0.5)',
    minVolume: 0,
    tier1Rate: '5%',
    tier2Rate: '2%',
    tier3Rate: '1%',
    benefits: ['Basic Support', '5% Tier 1 Commission'],
  },
  {
    name: 'Bronze',
    icon: '🥉',
    color: '#CD7F32',
    glowColor: 'rgba(205, 127, 50, 0.5)',
    minVolume: 1000,
    tier1Rate: '6%',
    tier2Rate: '2.5%',
    tier3Rate: '1%',
    benefits: ['Priority Support', '6% Tier 1 Commission', 'Unlock Tier 2'],
  },
  {
    name: 'Silver',
    icon: '🥈',
    color: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.6)',
    minVolume: 5000,
    tier1Rate: '7%',
    tier2Rate: '3%',
    tier3Rate: '1.5%',
    benefits: ['VIP Support', '7% Tier 1 Commission', 'Unlock Tier 3'],
  },
  {
    name: 'Gold',
    icon: '🥇',
    color: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.6)',
    minVolume: 25000,
    tier1Rate: '8%',
    tier2Rate: '3.5%',
    tier3Rate: '2%',
    benefits: ['Dedicated Manager', '8% Tier 1 Commission', 'Exclusive Bonuses'],
  },
  {
    name: 'Diamond',
    icon: '💎',
    color: '#00F0FF',
    glowColor: 'rgba(0, 240, 255, 0.6)',
    minVolume: 100000,
    tier1Rate: '10%',
    tier2Rate: '4%',
    tier3Rate: '2%',
    benefits: ['24/7 VIP Line', '10% Tier 1 Commission', 'Custom Deals'],
  },
];

export default function VIPModal({ isOpen, onClose }: VIPModalProps) {
  const [currentTier, setCurrentTier] = useState(0); // 0 = Iron, 1 = Bronze, etc.
  const [currentVolume, setCurrentVolume] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      // Fetch user's VIP data
      fetchVIPData();
    }
  }, [isOpen]);

  const fetchVIPData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/affiliates/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentVolume(data.totalNetworkVolume || 0);
          // Determine tier based on volume
          const tierIndex = TIERS.findIndex((t, i) => {
            const nextTier = TIERS[i + 1];
            return !nextTier || data.totalNetworkVolume < nextTier.minVolume;
          });
          setCurrentTier(Math.max(0, tierIndex));
        }
      }
    } catch (error) {
      console.error('Failed to fetch VIP data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressToNextTier = () => {
    const nextTier = TIERS[currentTier + 1];
    if (!nextTier) return 100; // Already at max tier
    const currentTierMin = TIERS[currentTier].minVolume;
    const progress = ((currentVolume - currentTierMin) / (nextTier.minVolume - currentTierMin)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const getVolumeToNextTier = () => {
    const nextTier = TIERS[currentTier + 1];
    if (!nextTier) return 0;
    return Math.max(0, nextTier.minVolume - currentVolume);
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  if (!isOpen) return null;

  // Use portal to render modal at document body level
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-black/95 border border-gray-700/50 shadow-2xl backdrop-blur-xl">
              {/* Decorative Elements */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-colors group"
              >
                <svg className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Content */}
              <div className="relative p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center gap-3 mb-4">
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      className="text-5xl"
                    >
                      👑
                    </motion.span>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                      VIP Program
                    </h2>
                    <motion.span
                      animate={{ rotate: [0, -10, 10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      className="text-5xl"
                    >
                      👑
                    </motion.span>
                  </div>
                  <p className="text-gray-400 text-lg">
                    Climb the ranks and unlock exclusive rewards
                  </p>
                </div>

                {/* Current Status Card */}
                <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/30">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Current Rank */}
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={{
                          boxShadow: [
                            `0 0 20px ${TIERS[currentTier].glowColor}`,
                            `0 0 40px ${TIERS[currentTier].glowColor}`,
                            `0 0 20px ${TIERS[currentTier].glowColor}`,
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                        style={{ backgroundColor: `${TIERS[currentTier].color}20` }}
                      >
                        {TIERS[currentTier].icon}
                      </motion.div>
                      <div>
                        <p className="text-gray-400 text-sm">Current Rank</p>
                        <p className="text-2xl font-bold" style={{ color: TIERS[currentTier].color }}>
                          {TIERS[currentTier].name}
                        </p>
                        <p className="text-gray-500 text-sm">
                          Volume: {formatVolume(currentVolume)}
                        </p>
                      </div>
                    </div>

                    {/* Progress to Next */}
                    <div className="flex-1 max-w-md w-full">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progress to {TIERS[currentTier + 1]?.name || 'Max'}</span>
                        <span className="text-cyan-400 font-medium">{getProgressToNextTier().toFixed(1)}%</span>
                      </div>
                      <div className="h-4 bg-gray-800 rounded-full overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${getProgressToNextTier()}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="h-full rounded-full relative"
                          style={{
                            background: `linear-gradient(90deg, ${TIERS[currentTier].color}, ${TIERS[currentTier + 1]?.color || TIERS[currentTier].color})`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        </motion.div>
                      </div>
                      {TIERS[currentTier + 1] && (
                        <p className="text-gray-500 text-sm mt-2 text-center">
                          {formatVolume(getVolumeToNextTier())} more to unlock{' '}
                          <span style={{ color: TIERS[currentTier + 1].color }}>{TIERS[currentTier + 1].name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tiers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {TIERS.map((tier, index) => {
                    const isActive = index === currentTier;
                    const isUnlocked = index <= currentTier;
                    
                    return (
                      <motion.div
                        key={tier.name}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative rounded-xl p-4 border transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-2'
                            : isUnlocked
                            ? 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800/50'
                            : 'bg-gray-900/30 border-gray-800/30 opacity-60'
                        }`}
                        style={{
                          borderColor: isActive ? tier.color : undefined,
                          boxShadow: isActive ? `0 0 30px ${tier.glowColor}` : undefined,
                        }}
                      >
                        {/* Active Indicator */}
                        {isActive && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg"
                          >
                            CURRENT
                          </motion.div>
                        )}

                        {/* Lock Icon for Locked Tiers */}
                        {!isUnlocked && (
                          <div className="absolute top-2 right-2 text-gray-600">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}

                        {/* Tier Icon */}
                        <div className="text-center mb-3">
                          <motion.span
                            animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="text-4xl inline-block"
                          >
                            {tier.icon}
                          </motion.span>
                        </div>

                        {/* Tier Name */}
                        <h3
                          className="text-lg font-bold text-center mb-2"
                          style={{ color: isUnlocked ? tier.color : '#6B7280' }}
                        >
                          {tier.name}
                        </h3>

                        {/* Volume Requirement */}
                        <p className="text-xs text-gray-500 text-center mb-3">
                          {tier.minVolume === 0 ? 'Starting Rank' : `${formatVolume(tier.minVolume)} Volume`}
                        </p>

                        {/* Commission Rates */}
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Tier 1</span>
                            <span className="text-cyan-400 font-medium">{tier.tier1Rate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Tier 2</span>
                            <span className="text-purple-400 font-medium">{tier.tier2Rate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Tier 3</span>
                            <span className="text-pink-400 font-medium">{tier.tier3Rate}</span>
                          </div>
                        </div>

                        {/* Benefits */}
                        <div className="mt-3 pt-3 border-t border-gray-700/30">
                          <ul className="space-y-1">
                            {tier.benefits.map((benefit, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-center gap-1">
                                <span className="text-green-500">✓</span>
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Bottom CTA */}
                <div className="mt-8 text-center">
                  <p className="text-gray-400 mb-4">
                    Increase your network volume to unlock higher tiers and earn more commissions!
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { onClose(); router.push('/affiliates'); }}
                    className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/25 transition-all"
                  >
                    Start Earning Now
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </AnimatePresence>,
    document.body
  );
}
