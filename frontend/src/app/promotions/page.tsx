'use client';

import MainLayout from '@/components/layout/MainLayout';

export default function PromotionsPage() {
  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[70vh]">
        <div className="relative bg-bg-card border border-white/10 rounded-2xl p-10 lg:p-16 overflow-hidden w-full text-center">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-transparent to-purple-500/5 animate-pulse" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-accent-primary/10 rounded-full blur-[100px]" />

          <div className="relative z-10">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-purple-500/20 border border-accent-primary/30 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-accent-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Promotions & Rewards
            </h1>

            {/* Subtitle */}
            <p className="text-text-secondary text-lg max-w-xl mx-auto mb-8 leading-relaxed">
              Our VIP Rewards Program is loading... Prepare for the ultimate rewards experience.
              We are building something extraordinary for our players.
            </p>

            {/* Status badge */}
            <div className="inline-flex items-center gap-2 bg-accent-primary/10 border border-accent-primary/20 rounded-full px-6 py-3 mb-8">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-primary"></span>
              </span>
              <span className="text-accent-primary font-semibold text-sm">IN DEVELOPMENT</span>
            </div>

            {/* Features preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              {[
                { icon: '🎁', label: 'Deposit Bonuses' },
                { icon: '💰', label: 'Daily Cashback' },
                { icon: '🏆', label: 'Tournaments' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 opacity-60"
                >
                  <span className="text-2xl block mb-2">{item.icon}</span>
                  <span className="text-text-secondary text-sm">{item.label}</span>
                </div>
              ))}
            </div>

            <p className="text-text-secondary/60 text-sm mt-8">
              Stay tuned — exciting promotions are on the way.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
