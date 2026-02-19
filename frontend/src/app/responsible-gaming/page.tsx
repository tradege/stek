'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useBranding } from '@/contexts/BrandingContext';

export default function ResponsibleGamingPage() {
  const { branding } = useBranding();
  const name = branding.brandName || 'Betworkss';

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8" data-testid="responsible-gaming-page">
        {/* Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
          <h1 className="text-4xl font-bold text-white mb-4">Responsible Gaming</h1>
          <p className="text-text-secondary max-w-2xl mx-auto">
            At {name}, we want our players to have fun while playing. We are committed to promoting responsible gambling and providing tools to help you stay in control.
          </p>
        </div>

        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎮</span>
            </div>
            <h3 className="text-white font-bold mb-2">Play for Fun</h3>
            <p className="text-text-secondary text-sm">Gambling should be seen as entertainment, not a way to make money.</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-white font-bold mb-2">Set Limits</h3>
            <p className="text-text-secondary text-sm">Only gamble with money you can afford to lose. Never chase losses.</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏱️</span>
            </div>
            <h3 className="text-white font-bold mb-2">Take Breaks</h3>
            <p className="text-text-secondary text-sm">Balance gambling with other activities. Take regular breaks from the screen.</p>
          </div>
        </div>

        {/* Self-Exclusion */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <span className="text-primary">🛡️</span> Self-Exclusion Policy
          </h2>
          <div className="space-y-4 text-text-secondary text-sm leading-relaxed">
            <p>
              If you feel that your gambling is becoming a problem, we offer a self-exclusion tool that allows you to close your account for a specified period (6 months, 1 year, 2 years, 5 years, or permanently).
            </p>
            <p>
              During a self-exclusion period, you will not be able to access your account, deposit funds, or place bets. We will also take reasonable steps to ensure you do not receive any marketing materials from us.
            </p>
            <p>
              To request self-exclusion, please contact our support team via live chat or email. Once a self-exclusion is active, it cannot be reversed until the chosen period has ended.
            </p>
          </div>
        </div>

        {/* Player Protection Tools */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="text-primary">🛠️</span> Player Protection Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h4 className="text-white font-bold">Deposit Limits</h4>
              <p className="text-text-secondary text-sm">Control your spending by setting daily, weekly, or monthly deposit limits.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-white font-bold">Loss Limits</h4>
              <p className="text-text-secondary text-sm">Set a maximum amount you are willing to lose over a specific timeframe.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-white font-bold">Session Time Limits</h4>
              <p className="text-text-secondary text-sm">Set reminders or hard limits on how long you can stay logged in.</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-white font-bold">Cooling-Off Period</h4>
              <p className="text-text-secondary text-sm">Take a short break from 24 hours up to 30 days to clear your head.</p>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">External Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex justify-between items-center group">
              <div>
                <div className="text-white font-bold group-hover:text-primary transition-colors">GamCare</div>
                <div className="text-text-secondary text-xs">Leading UK provider of support</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex justify-between items-center group">
              <div>
                <div className="text-white font-bold group-hover:text-primary transition-colors">Gamblers Anonymous</div>
                <div className="text-text-secondary text-xs">Global support network</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer" className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex justify-between items-center group">
              <div>
                <div className="text-white font-bold group-hover:text-primary transition-colors">Gambling Therapy</div>
                <div className="text-text-secondary text-xs">Online support in multiple languages</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex justify-between items-center group">
              <div>
                <div className="text-white font-bold group-hover:text-primary transition-colors">BeGambleAware</div>
                <div className="text-text-secondary text-xs">Confidential help and advice</div>
              </div>
              <span className="text-xl">→</span>
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
