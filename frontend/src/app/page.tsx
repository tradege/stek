'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import GameGrid from '@/components/lobby/GameGrid';
import Link from 'next/link';
import config from '@/config/api';
import { useBranding } from '@/contexts/BrandingContext';

const API_URL = config.apiUrl;
  

// Animated counter component
function AnimatedCounter({ target, prefix = '', suffix = '', color }: { target: number; prefix?: string; suffix?: string; color: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target <= 0 || hasAnimated.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toLocaleString();
  };

  return (
    <div ref={ref} className={`text-3xl font-bold ${color} mb-1 font-mono`}>
      {prefix}{formatNumber(count)}{suffix}
    </div>
  );
}

// Recent wins — fetched from real API data (no mock data)

export default function Home() {
  const { branding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState({
    totalWagered: 0,
    gamesPlayed: 0,
    highestWin: 0,
    activePlayers: 0,
  });

  const [recentWins, setRecentWins] = useState<{user: string; game: string; multiplier: number; amount: number; color: string}[]>([]);
  const [tickerOffset, setTickerOffset] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/platform/stats`);
        if (response.ok) {
          const data = await response.json();
          setPlatformStats({
            totalWagered: data.totalWagered || 0,
            gamesPlayed: data.totalBets || 0,
            highestWin: data.highestWin || 0,
            activePlayers: data.activeUsers || 0,
          });
          // Use real recent wins from backend
          if (data.recentWins && data.recentWins.length > 0) {
            setRecentWins(data.recentWins);
          }
        }
      } catch (err) {
        // Failed to fetch platform stats
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Ticker animation
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerOffset((prev) => (prev + 1) % recentWins.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [recentWins.length]);

  const [activeTab, setActiveTab] = useState<'casino' | 'sports'>('casino');
  const router = useRouter();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-blue-900 to-primary border border-white/10">
          {/* Animated Background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(120,0,255,0.3),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(0,200,255,0.3),transparent_50%)]" />
            <div className="absolute top-0 left-0 w-full h-full opacity-30">
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
              <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-purple-400 rounded-full animate-bounce" />
              <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
              <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Content */}
          <div className="relative px-8 py-12 md:py-16 text-center">
            <div className="inline-block px-4 py-1 mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full">
              <span className="text-sm font-bold text-white">CRYPTO CASINO</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">{branding.brandName}</span>
            </h1>
            <p className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 mb-6">
              Play. Win. Withdraw Instantly.
            </p>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Experience the thrill of crypto gaming with provably fair games, instant withdrawals, and the best odds in the industry.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/games/crash"
                className="px-8 py-4 bg-gradient-to-r from-primary to-blue-500 text-white font-bold rounded-xl hover:from-primary hover:to-blue-400 transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50"
              >
                Play Now
              </Link>
              <Link
                href="/promotions"
                className="px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/20"
              >
                View Promotions
              </Link>
            </div>
          </div>
        </div>

        {/* Live Recent Wins Ticker — real data from API */}
        {recentWins.length > 0 && (
          <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-green-400">LIVE WINS</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex gap-6 animate-marquee">
                  {[...recentWins, ...recentWins].map((win, i) => (
                    <div key={i} className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-400 text-sm">{win.user}</span>
                      <span className={`text-xs font-medium ${win.color}`}>{win.game}</span>
                      <span className="text-white font-bold text-sm">{win.multiplier}x</span>
                      <span className="text-green-400 font-mono text-sm">${Number(win.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Casino / Sports Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex bg-bg-card border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('casino')}
              className={`px-8 py-3 rounded-lg font-bold transition-all ${
                activeTab === 'casino'
                  ? 'bg-gradient-to-r from-primary to-blue-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Casino
            </button>
            <button
              onClick={() => router.push('/sports')}
              className={`px-8 py-3 rounded-lg font-bold transition-all relative ${
                activeTab === 'sports'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sports
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                Soon
              </span>
            </button>
          </div>
        </div>

        {/* In-House Games Highlight */}
        {activeTab === 'casino' && (
          <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-primary to-blue-500 rounded-full" />
                  In-House Games
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-medium">Provably Fair</span>
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'Crash', icon: '🚀', desc: 'Cash out before it crashes', href: '/games/crash', gradient: 'from-orange-600 to-red-600', edge: '4%' },
                  { name: 'Nova Rush', icon: '🛸', desc: 'Dodge asteroids in deep space', href: '/games/nova-rush', gradient: 'from-blue-600 to-purple-600', edge: '4%', isNew: true, isHot: true },
                  { name: 'Dragon Blaze', icon: '🐉', desc: 'Two dragons, double the thrill', href: '/games/dragon-blaze', gradient: 'from-red-600 to-orange-600', edge: '4%', isNew: true, isHot: true },
                  { name: 'Plinko', icon: '🎯', desc: 'Drop & win big multipliers', href: '/games/plinko', gradient: 'from-blue-600 to-indigo-600', edge: '4%' },
                  { name: 'Dice', icon: '🎲', desc: 'Roll over or under to win', href: '/games/dice', gradient: 'from-green-600 to-emerald-600', edge: '4%', isNew: true },
                  { name: 'Mines', icon: '💣', desc: 'Find gems, avoid mines', href: '/games/mines', gradient: 'from-yellow-600 to-amber-600', edge: '4%' },
                  { name: 'Olympus', icon: '⚡', desc: 'Gates of Olympus slots', href: '/games/olympus', gradient: 'from-purple-600 to-yellow-600', edge: '4%', isNew: true },
                  { name: 'Card Rush', icon: '🃏', desc: 'Instant Blackjack action', href: '/games/card-rush', gradient: 'from-yellow-500 to-orange-600', edge: '3%', isNew: true },
                  { name: 'Limbo', icon: '🎯', desc: 'Set your target multiplier', href: '/games/limbo', gradient: 'from-purple-600 to-pink-600', edge: '4%', isNew: true },
                  { name: 'Penalty', icon: '⚽', desc: 'Score goals, stack multipliers', href: '/games/penalty', gradient: 'from-green-600 to-teal-600', edge: '4%', isNew: true },
                ].map((game) => (
                  <Link
                    key={game.name}
                    href={game.href}
                    className="group relative bg-bg-card border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-all hover:scale-[1.02]"
                  >
                    <div className={`h-28 bg-gradient-to-br ${game.gradient} flex items-center justify-center relative`}>
                      <span className="text-5xl group-hover:scale-110 transition-transform">{game.icon}</span>
                      {game.isNew && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">NEW</span>
                      )}
                      {(game as any).isHot && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">HOT</span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-white font-bold">{game.name}</h3>
                      <p className="text-gray-400 text-xs mt-0.5">{game.desc}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded font-mono">Edge: {game.edge}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* All Games Lobby */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-500 rounded-xl flex items-center justify-center">
                    <span className="text-xl">🎰</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      All Games
                    </h2>
                    <p className="text-gray-400 text-sm">Browse our full game collection</p>
                  </div>
                </div>
              </div>
              <GameGrid />
            </section>
          </>
        )}

        {/* Sports Content (Coming Soon) */}
        {activeTab === 'sports' && (
          <section className="text-center py-20">
            <div className="inline-block p-12 bg-bg-card border border-white/10 rounded-3xl">
              <div className="text-6xl mb-4">⚽</div>
              <h3 className="text-2xl font-bold text-white mb-3">Sports Betting is Live!</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Explore live odds on Premier League, Champions League, NBA, and Euroleague. 
                
              </p>
              <button className="mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all">
                Go to Sports Betting
              </button>
            </div>
          </section>
        )}

        {/* Animated Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <AnimatedCounter target={platformStats.totalWagered} prefix="$" suffix="+" color="text-accent-primary" />
            <p className="text-sm text-gray-400">Total Wagered</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <AnimatedCounter target={platformStats.gamesPlayed} suffix="+" color="text-green-400" />
            <p className="text-sm text-gray-400">Games Played</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <AnimatedCounter target={platformStats.highestWin} prefix="$" color="text-yellow-400" />
            <p className="text-sm text-gray-400">Highest Win</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <AnimatedCounter target={platformStats.activePlayers} suffix="+" color="text-purple-400" />
            <p className="text-sm text-gray-400">Active Players</p>
          </div>
        </section>

        {/* Features Section */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 hover:border-green-500/30 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Provably Fair</h3>
            <p className="text-gray-400 text-sm">
              All games use HMAC-SHA256 cryptographic verification. Verify every bet yourself with server seed, client seed, and nonce.
            </p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 hover:border-yellow-500/30 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instant Withdrawals</h3>
            <p className="text-gray-400 text-sm">
              Withdraw your winnings instantly to your crypto wallet. No waiting, no delays.
            </p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 hover:border-purple-500/30 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Secure & Private</h3>
            <p className="text-gray-400 text-sm">
              Your data is encrypted with industry-standard protocols. We never share your information.
            </p>
          </div>
        </section>

        {/* Community CTA */}
        <section className="text-center py-8">
          <div className="bg-gradient-to-r from-[#5865F2]/20 to-[#5865F2]/10 border border-[#5865F2]/30 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-2">Join Our Community</h3>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">Connect with other players, get exclusive promotions, and stay updated on new features.</p>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#5865F2] text-white font-bold rounded-xl hover:bg-[#4752C4] transition-all shadow-lg"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>
        </section>
      </div>

      {/* Marquee CSS */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </MainLayout>
  );
}
