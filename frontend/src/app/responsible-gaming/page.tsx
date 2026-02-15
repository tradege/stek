'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

export default function ResponsibleGamingPage() {
  const { user } = useAuth();
  const { branding } = useBranding();
  const brandName = branding.brandName || 'the Platform';
  const [depositLimit, setDepositLimit] = useState('');
  const [lossLimit, setLossLimit] = useState('');
  const [wagerLimit, setWagerLimit] = useState('');
  const [sessionLimit, setSessionLimit] = useState('');
  const [cooldownPeriod, setCooldownPeriod] = useState('');
  const [showSelfExclusion, setShowSelfExclusion] = useState(false);

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8" data-testid="responsible-gaming-page">
        {/* Hero */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-8 lg:p-12 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            🛡️ Responsible Gaming
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            At {brandName}, we are committed to providing a safe and enjoyable gaming experience.
            We encourage all players to gamble responsibly.
          </p>
        </div>

        {/* Know Your Limits */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-white mb-6">🎯 Set Your Limits</h2>
          <p className="text-text-secondary mb-6">
            Take control of your gaming by setting personal limits. These limits help you manage your spending and time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <label className="text-white font-medium text-sm block mb-2">Daily Deposit Limit (USDT)</label>
              <input
                type="number"
                value={depositLimit}
                onChange={(e) => setDepositLimit(e.target.value)}
                placeholder="e.g., 100"
                className="w-full bg-main border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:border-accent-primary focus:outline-none transition-all"
              />
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <label className="text-white font-medium text-sm block mb-2">Weekly Loss Limit (USDT)</label>
              <input
                type="number"
                value={lossLimit}
                onChange={(e) => setLossLimit(e.target.value)}
                placeholder="e.g., 500"
                className="w-full bg-main border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:border-accent-primary focus:outline-none transition-all"
              />
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <label className="text-white font-medium text-sm block mb-2">Monthly Wager Limit (USDT)</label>
              <input
                type="number"
                value={wagerLimit}
                onChange={(e) => setWagerLimit(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full bg-main border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:border-accent-primary focus:outline-none transition-all"
              />
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <label className="text-white font-medium text-sm block mb-2">Session Time Limit (hours)</label>
              <input
                type="number"
                value={sessionLimit}
                onChange={(e) => setSessionLimit(e.target.value)}
                placeholder="e.g., 4"
                className="w-full bg-main border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:border-accent-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          <button className="mt-6 px-6 py-3 bg-gradient-to-r from-primary to-blue-500 text-white rounded-xl font-semibold hover:from-primary hover:to-blue-400 transition-all">
            Save Limits
          </button>
        </div>

        {/* Cooling Off Period */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">⏸️ Cooling Off Period</h2>
          <p className="text-text-secondary mb-6">
            Need a break? Set a cooling off period to temporarily restrict your account from placing bets.
          </p>
          <div className="flex flex-wrap gap-3">
            {['24 Hours', '48 Hours', '7 Days', '30 Days'].map((period) => (
              <button
                key={period}
                onClick={() => setCooldownPeriod(period)}
                className={`px-5 py-3 rounded-xl font-medium transition-all ${
                  cooldownPeriod === period
                    ? 'bg-warning/10 text-warning border border-warning/20'
                    : 'bg-white/5 text-text-secondary border border-white/10 hover:border-white/20'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
          {cooldownPeriod && (
            <button className="mt-4 px-6 py-3 bg-warning/10 text-warning border border-warning/20 rounded-xl font-semibold hover:bg-warning/20 transition-all">
              Activate {cooldownPeriod} Cooling Off
            </button>
          )}
        </div>

        {/* Self-Exclusion */}
        <div className="bg-bg-card border border-red-500/20 rounded-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">🚫 Self-Exclusion</h2>
          <p className="text-text-secondary mb-4">
            If you feel that gambling is becoming a problem, you can choose to self-exclude from {brandName}.
            During the exclusion period, you will not be able to access your account or place any bets.
          </p>
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm font-medium">
              ⚠️ Warning: Self-exclusion cannot be reversed during the selected period. Please consider this carefully.
            </p>
          </div>
          <button
            onClick={() => setShowSelfExclusion(!showSelfExclusion)}
            className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-semibold hover:bg-red-500/20 transition-all"
          >
            {showSelfExclusion ? 'Hide Options' : 'View Self-Exclusion Options'}
          </button>
          {showSelfExclusion && (
            <div className="mt-4 flex flex-wrap gap-3">
              {['6 Months', '1 Year', '5 Years', 'Permanent'].map((period) => (
                <button
                  key={period}
                  className="px-5 py-3 bg-red-500/5 text-red-400 border border-red-500/20 rounded-xl font-medium hover:bg-red-500/10 transition-all"
                >
                  {period}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Warning Signs */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-white mb-6">⚠️ Warning Signs of Problem Gambling</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'Spending more money than you can afford to lose',
              'Gambling to escape problems or relieve stress',
              'Chasing losses by increasing bets',
              'Lying to family or friends about gambling',
              'Neglecting work, school, or family responsibilities',
              'Borrowing money to gamble',
              'Feeling restless or irritable when not gambling',
              'Unable to stop or control gambling behavior',
            ].map((sign, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                <span className="text-warning mt-0.5">⚠</span>
                <p className="text-text-secondary text-sm">{sign}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Help Resources */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 lg:p-8">
          <h2 className="text-2xl font-bold text-white mb-6">📞 Get Help</h2>
          <p className="text-text-secondary mb-6">
            If you or someone you know has a gambling problem, please reach out to these organizations:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Gamblers Anonymous', url: 'https://www.gamblersanonymous.org', desc: 'Free peer support groups worldwide' },
              { name: 'BeGambleAware', url: 'https://www.begambleaware.org', desc: 'Free advice and support (UK)' },
              { name: 'National Council on Problem Gambling', url: 'https://www.ncpgambling.org', desc: 'US helpline: 1-800-522-4700' },
              { name: 'GamCare', url: 'https://www.gamcare.org.uk', desc: 'Free counseling and support (UK)' },
            ].map((resource) => (
              <a
                key={resource.name}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-white/5 rounded-xl border border-white/10 hover:border-accent-primary/30 transition-all"
              >
                <h3 className="text-white font-semibold">{resource.name}</h3>
                <p className="text-text-secondary text-sm mt-1">{resource.desc}</p>
                <p className="text-accent-primary text-xs mt-2">{resource.url}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
