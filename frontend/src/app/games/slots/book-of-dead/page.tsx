"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function BookOfDeadPage() {
  const [mounted, setMounted] = useState(false);
  const [notifyClicked, setNotifyClicked] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNotify = () => {
    setNotifyClicked(true);
    setTimeout(() => setNotifyClicked(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg-accent-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Egyptian themed particles */}
      <div className="absolute inset-0 pointer-events-none">
        {['✨', '⭐', '💫', '🌟', '✨', '⭐', '💫', '🌟'].map((star, i) => (
          <div
            key={i}
            className="absolute text-xl star"
            style={{
              left: `${8 + i * 11}%`,
              top: `${15 + (i % 4) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              color: '#FFD700',
            }}
          >
            {star}
          </div>
        ))}
      </div>

      {/* Sand effect gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-amber-900/10 to-transparent pointer-events-none" />

      {/* Animated rings - golden/bronze theme */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full border border-amber-500/20 animate-ring-pulse" />
        <div className="absolute w-80 h-80 rounded-full border border-amber-500/10 animate-ring-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute w-96 h-96 rounded-full border border-amber-500/5 animate-ring-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className={`max-w-md w-full text-center relative z-10 ${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
        {/* Game icon with float animation */}
        <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-amber-600 via-yellow-600 to-orange-700 flex items-center justify-center shadow-2xl animate-coming-soon-float animate-jackpot-glow">
          <span className="text-6xl animate-icon-bounce">📜</span>
        </div>

        {/* Title with shimmer */}
        <h1 className="text-4xl font-bold text-white mb-4 text-shimmer">Book of Dead</h1>

        {/* Coming Soon badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/50 rounded-full mb-6 animate-badge-pulse">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
          <span className="text-amber-400 font-semibold">Coming Soon</span>
        </div>

        {/* Description */}
        <p className="text-gray-400 mb-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Explore ancient Egyptian treasures! Join Rich Wilde on his quest for legendary riches and expanding symbols!
        </p>

        {/* Features list */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {['Expanding Symbols', 'Free Spins', 'Gamble Feature', 'High Volatility'].map((feature, i) => (
            <div
              key={feature}
              className={`px-3 py-2 bg-gray-800/50 rounded-lg border border-amber-500/30 text-sm text-gray-300 animate-slide-in-up hover-glow-yellow`}
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Notify button with animation */}
        <button
          onClick={handleNotify}
          className={`w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl transition-all mb-4 btn-pulse-glow hover-lift ${
            notifyClicked ? 'animate-win-shake bg-green-500' : 'hover:from-amber-400 hover:to-orange-500'
          }`}
        >
          {notifyClicked ? '✅ You will be notified!' : '🔔 Notify Me When Available'}
        </button>

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all hover-scale group"
        >
          <svg
            className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Games
        </Link>
      </div>
    </div>
  );
}
