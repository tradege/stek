"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function BigBassBonanzaPage() {
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
      {/* Water/bubble particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${5 + i * 6}%`,
              bottom: '-20px',
              width: `${8 + Math.random() * 12}px`,
              height: `${8 + Math.random() * 12}px`,
              background: 'rgba(0, 150, 255, 0.3)',
              border: '1px solid rgba(0, 200, 255, 0.5)',
              animation: `confetti-fall ${3 + Math.random() * 2}s linear infinite reverse`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Water gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 via-transparent to-cyan-900/10 pointer-events-none" />

      {/* Animated rings - water theme */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full border border-blue-500/20 animate-ring-pulse" />
        <div className="absolute w-80 h-80 rounded-full border border-cyan-500/10 animate-ring-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute w-96 h-96 rounded-full border border-blue-500/5 animate-ring-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className={`max-w-md w-full text-center relative z-10 ${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}>
        {/* Game icon with float animation */}
        <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 flex items-center justify-center shadow-2xl animate-coming-soon-float animate-coming-soon-glow">
          <span className="text-6xl animate-icon-bounce">🐟</span>
        </div>

        {/* Title with shimmer */}
        <h1 className="text-4xl font-bold text-white mb-4 text-shimmer">Big Bass Bonanza</h1>

        {/* Coming Soon badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-full mb-6 animate-badge-pulse">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          <span className="text-blue-400 font-semibold">Coming Soon</span>
        </div>

        {/* Description */}
        <p className="text-gray-400 mb-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Cast your line for big wins! Catch fish symbols to collect money values and trigger the exciting free spins bonus!
        </p>

        {/* Features list */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {['Money Collect', 'Free Spins', 'Fisherman Wild', 'Multipliers'].map((feature, i) => (
            <div
              key={feature}
              className={`px-3 py-2 bg-gray-800/50 rounded-lg border border-blue-500/30 text-sm text-gray-300 animate-slide-in-up`}
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* Notify button with animation */}
        <button
          onClick={handleNotify}
          className={`w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl transition-all mb-4 btn-pulse-glow hover-lift ${
            notifyClicked ? 'animate-win-shake bg-green-500' : 'hover:from-blue-400 hover:to-cyan-400'
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
