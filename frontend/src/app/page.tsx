'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import GameCard from '@/components/ui/GameCard';
import Link from 'next/link';

// Rocket Icon Component
const RocketIcon = () => (
  <svg className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.5 2C9.64 2 7.5 4.14 7.5 7c0 1.45.59 2.76 1.55 3.71L4.5 15.26V22h6.74l4.55-4.55c.95.96 2.26 1.55 3.71 1.55 2.86 0 5-2.14 5-5 0-5.52-4.48-10-10-10zm7 10c0 1.66-1.34 3-3 3-.79 0-1.51-.31-2.04-.82l-1.42 1.42L11.59 20H6.5v-5.09l4.4-4.4c.51-.51.82-1.23.82-2.01 0-1.66 1.34-3 3-3 3.31 0 6 2.69 6 6z"/>
    <circle cx="17" cy="8" r="2"/>
    <path d="M2 22l3-3 2 2-3 3z"/>
  </svg>
);

// Plinko Icon Component
const PlinkoIcon = () => (
  <svg className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="3" r="2"/>
    <circle cx="6" cy="7" r="1.5"/>
    <circle cx="12" cy="7" r="1.5"/>
    <circle cx="18" cy="7" r="1.5"/>
    <circle cx="4" cy="11" r="1.5"/>
    <circle cx="9" cy="11" r="1.5"/>
    <circle cx="15" cy="11" r="1.5"/>
    <circle cx="20" cy="11" r="1.5"/>
    <circle cx="6" cy="15" r="1.5"/>
    <circle cx="12" cy="15" r="1.5"/>
    <circle cx="18" cy="15" r="1.5"/>
    <rect x="2" y="19" width="4" height="3" rx="1"/>
    <rect x="7" y="19" width="4" height="3" rx="1"/>
    <rect x="13" y="19" width="4" height="3" rx="1"/>
    <rect x="18" y="19" width="4" height="3" rx="1"/>
  </svg>
);

// Mines Icon Component
const MinesIcon = () => (
  <svg className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2"/>
    <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2"/>
    <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2"/>
    <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" stroke="currentColor" strokeWidth="2"/>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" stroke="currentColor" strokeWidth="2"/>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// Dice Icon Component
const DiceIcon = () => (
  <svg className="w-16 h-16 text-white" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="8" cy="8" r="1.5"/>
    <circle cx="12" cy="12" r="1.5"/>
    <circle cx="16" cy="16" r="1.5"/>
    <circle cx="8" cy="16" r="1.5"/>
    <circle cx="16" cy="8" r="1.5"/>
  </svg>
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<'casino' | 'sports'>('casino');

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-blue-900 to-cyan-900 border border-white/10">
          {/* Animated Background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(120,0,255,0.3),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(0,200,255,0.3),transparent_50%)]" />
            <div className="absolute top-0 left-0 w-full h-full opacity-30">
              {/* Floating particles effect */}
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-purple-400 rounded-full animate-bounce" />
              <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
              <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Content */}
          <div className="relative px-8 py-12 md:py-16 text-center">
            <div className="inline-block px-4 py-1 mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full">
              <span className="text-sm font-bold text-white">🎁 WELCOME BONUS</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">StakePro</span>
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 mb-6">
              Get 200% Bonus on First Deposit!
            </p>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Experience the thrill of crypto gaming with provably fair games, instant withdrawals, and the best odds in the industry.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/games/crash"
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
              >
                🚀 Play Now
              </Link>
              <button className="px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Casino / Sports Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex bg-bg-card border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('casino')}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'casino'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🎰 Casino
            </button>
            <button
              onClick={() => setActiveTab('sports')}
              className={`px-8 py-3 rounded-lg font-bold transition-all relative ${
                activeTab === 'sports'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ⚽ Sports
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                Soon
              </span>
            </button>
          </div>
        </div>

        {/* Casino Content */}
        {activeTab === 'casino' && (
          <>
            {/* Stake Originals Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <span className="text-xl">⭐</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Stake Originals</h2>
                  <p className="text-gray-400 text-sm">Exclusive games with the best odds</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GameCard
                  title="Crash"
                  icon={<RocketIcon />}
                  link="/games/crash"
                  isLive={true}
                  isHot={true}
                  gradient="from-orange-600 via-red-600 to-pink-600"
                />
                <GameCard
                  title="Dice"
                  link="/games/dice"
                  icon={<DiceIcon />}
                  isComingSoon={true}
                  gradient="from-green-600 via-emerald-600 to-teal-600"
                />
                <GameCard
                  title="Plinko"
                  icon={<PlinkoIcon />}
                  link="/games/plinko"
                  gradient="from-blue-600 via-indigo-600 to-purple-600"
                />
                <GameCard
                  title="Mines"
                  link="/games/mines"
                  icon={<MinesIcon />}
                  isComingSoon={true}
                  gradient="from-yellow-600 via-orange-600 to-red-600"
                />
              </div>
            </section>

            {/* Slots Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎰</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Popular Slots</h2>
                  <p className="text-gray-400 text-sm">Top-rated slot games from leading providers</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <GameCard
                  title="Gates of Olympus"
                  link="/games/slots/gates-of-olympus"
                  icon={<span className="text-5xl">⚡</span>}
                  isComingSoon={true}
                  gradient="from-yellow-500 via-amber-600 to-orange-700"
                />
                <GameCard
                  title="Sweet Bonanza"
                  link="/games/slots/sweet-bonanza"
                  icon={<span className="text-5xl">🍬</span>}
                  isComingSoon={true}
                  gradient="from-pink-500 via-rose-600 to-red-600"
                />
                <GameCard
                  title="Book of Dead"
                  link="/games/slots/book-of-dead"
                  icon={<span className="text-5xl">📖</span>}
                  isComingSoon={true}
                  gradient="from-amber-700 via-yellow-800 to-orange-900"
                />
                <GameCard
                  title="Starburst"
                  link="/games/slots/starburst"
                  icon={<span className="text-5xl">💎</span>}
                  isComingSoon={true}
                  gradient="from-purple-600 via-violet-600 to-indigo-700"
                />
                <GameCard
                  title="Big Bass Bonanza"
                  link="/games/slots/big-bass-bonanza"
                  icon={<span className="text-5xl">🐟</span>}
                  isComingSoon={true}
                  gradient="from-blue-500 via-cyan-600 to-teal-600"
                />
              </div>
            </section>

            {/* Live Casino Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🃏</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Live Casino</h2>
                  <p className="text-gray-400 text-sm">Real dealers, real action</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GameCard
                  title="Blackjack"
                  icon={<span className="text-5xl">🃏</span>}
                  isComingSoon={true}
                  gradient="from-green-700 via-emerald-800 to-teal-900"
                />
                <GameCard
                  title="Roulette"
                  icon={<span className="text-5xl">🎡</span>}
                  isComingSoon={true}
                  gradient="from-red-700 via-rose-800 to-pink-900"
                />
                <GameCard
                  title="Baccarat"
                  icon={<span className="text-5xl">💰</span>}
                  isComingSoon={true}
                  gradient="from-amber-600 via-yellow-700 to-orange-800"
                />
                <GameCard
                  title="Poker"
                  icon={<span className="text-5xl">♠️</span>}
                  isComingSoon={true}
                  gradient="from-slate-600 via-gray-700 to-zinc-800"
                />
              </div>
            </section>
          </>
        )}

        {/* Sports Content */}
        {activeTab === 'sports' && (
          <section className="text-center py-16">
            <div className="inline-block p-8 bg-bg-card border border-white/10 rounded-3xl">
              <span className="text-6xl mb-4 block">⚽</span>
              <h2 className="text-2xl font-bold text-white mb-2">Sports Betting Coming Soon!</h2>
              <p className="text-gray-400 max-w-md mx-auto">
                We're working hard to bring you the best sports betting experience. 
                Stay tuned for live odds, in-play betting, and more!
              </p>
              <button className="mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all">
                Notify Me
              </button>
            </div>
          </section>
        )}

        {/* Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <p className="text-3xl font-bold text-cyan-400 mb-1">$1.2M+</p>
            <p className="text-sm text-gray-400">Total Wagered</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <p className="text-3xl font-bold text-green-400 mb-1">12,847+</p>
            <p className="text-sm text-gray-400">Games Played</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <p className="text-3xl font-bold text-yellow-400 mb-1">156.32x</p>
            <p className="text-sm text-gray-400">Highest Win</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <p className="text-3xl font-bold text-purple-400 mb-1">2,341+</p>
            <p className="text-sm text-gray-400">Active Players</p>
          </div>
        </section>

        {/* Features Section */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Provably Fair</h3>
            <p className="text-gray-400 text-sm">
              All games use cryptographic verification. Verify every bet yourself.
            </p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instant Withdrawals</h3>
            <p className="text-gray-400 text-sm">
              Withdraw your winnings instantly to your crypto wallet.
            </p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Secure & Private</h3>
            <p className="text-gray-400 text-sm">
              Your data is encrypted and we never share your information.
            </p>
          </div>
        </section>

        {/* Discord CTA */}
        <section className="text-center py-8">
          <a
            href="https://discord.gg/stakepro"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#5865F2] text-white font-bold rounded-xl hover:bg-[#4752C4] transition-all shadow-lg"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join our Discord Community
          </a>
        </section>
      </div>
    </MainLayout>
  );
}
