"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function GatesOfOlympusPage() {
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
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background particles - golden theme */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="particle star"
            style={{
              left: `${5 + i * 8}%`,
              top: `${15 + (i % 4) * 20}%`,
              animationDelay: `${i * 0.3}s`,
              background: 'rgba(255, 215, 0, 0.6)',
              width: '6px',
              height: '6px',
            }}
          />
        ))}
      </div>

      {/* Lightning effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-1 h-32 bg-gradient-to-b from-yellow-400 to-transparent opacity-30 animate-pulse" />
        <div className="absolute top-0 right-1/3 w-1 h-24 bg-gradient-to-b from-yellow-400 to-transparent opacity-20 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Animated rings - golden */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full border border-yellow-500/20 animate-ring-pulse" />
        <div className="absolute w-80 h-80 rounded-full border border-yellow-500/10 animate-ring-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute w-96 h-96 rounded-full border border-yellow-500/5 animate-ring-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className={`max-w-md w-full text-center relative z-10 ${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
        {/* Game icon with float animation */}
        <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 flex items-center justify-center shadow-2xl animate-coming-soon-float animate-jackpot-glow">
          <span className="text-6xl animate-icon-bounce">⚡</span>
        </div>

        {/* Title with shimmer */}
        <h1 className="text-4xl font-bold text-white mb-4 text-shimmer">Gates of Olympus</h1>

        {/* Coming Soon badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full mb-6 animate-badge-pulse">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
          <span className="text-yellow-500 font-semibold">Coming Soon</span>
        </div>

        {/* Description */}
        <p className="text-gray-400 mb-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Enter the realm of Zeus! Experience divine multipliers up to 500x with cascading wins and free spins!
        </p>

        {/* Features list */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {['500x Multiplier', 'Free Spins', 'Cascading Wins', 'Buy Bonus'].map((feature, i) => (
            <div
              key={feature}
              className={`px-3 py-2 bg-gray-800/50 rounded-lg border border-yellow-500/30 text-sm text-gray-300 animate-slide-in-up hover-glow-yellow`}
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Notify button with animation */}
        <button
          onClick={handleNotify}
          className={`w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl transition-all mb-4 btn-pulse-glow hover-lift ${
            notifyClicked ? 'animate-win-shake bg-green-500' : 'hover:from-yellow-400 hover:to-orange-400'
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
