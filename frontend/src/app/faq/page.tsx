'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqItems: FAQItem[] = [
  // Getting Started
  {
    category: 'Getting Started',
    question: 'How do I create an account?',
    answer: 'Click the "Register" button on the homepage. Enter your email, choose a username and password, and verify your email address. Your account will be ready to use immediately after verification.',
  },
  {
    category: 'Getting Started',
    question: 'Is StakePro legal in my country?',
    answer: 'StakePro operates under a Curacao eGaming license. However, online gambling laws vary by jurisdiction. It is your responsibility to ensure that using StakePro is legal in your location. We restrict access from certain jurisdictions where online gambling is prohibited.',
  },
  {
    category: 'Getting Started',
    question: 'What cryptocurrencies do you accept?',
    answer: 'We currently accept Bitcoin (BTC), Ethereum (ETH), USDT (Tether), and Solana (SOL). We are constantly working on adding more cryptocurrencies. All balances are displayed in your chosen currency.',
  },
  // Deposits & Withdrawals
  {
    category: 'Deposits & Withdrawals',
    question: 'How do I deposit funds?',
    answer: 'Go to the Wallet section, select your preferred cryptocurrency, and copy the deposit address. Send your crypto to that address. Deposits are credited after the required blockchain confirmations (1 for ETH/USDT, 2 for BTC, 1 for SOL).',
  },
  {
    category: 'Deposits & Withdrawals',
    question: 'How long do withdrawals take?',
    answer: 'Withdrawal requests are processed within 1-24 hours depending on your VIP level. VIP Gold and above enjoy instant withdrawals. After processing, the actual transfer time depends on the blockchain network congestion.',
  },
  {
    category: 'Deposits & Withdrawals',
    question: 'What are the minimum deposit and withdrawal amounts?',
    answer: 'Minimum deposit: $10 equivalent in any supported cryptocurrency. Minimum withdrawal: $20 equivalent. Maximum withdrawal depends on your VIP level, ranging from $5,000/day (Bronze) to unlimited (Master).',
  },
  {
    category: 'Deposits & Withdrawals',
    question: 'Why is my withdrawal pending?',
    answer: 'Withdrawals may be pending due to: (1) Security verification for large amounts; (2) First-time withdrawal KYC check; (3) Unmet wagering requirements on bonus funds. Contact support if your withdrawal is pending for more than 24 hours.',
  },
  // Games
  {
    category: 'Games',
    question: 'What is Provably Fair?',
    answer: 'Provably Fair is a system that allows you to verify the fairness of every game result. Before each round, we publish a hash of the server seed. After the round, we reveal the actual server seed so you can verify the result was predetermined and not manipulated. You can verify any round using our built-in verification tool.',
  },
  {
    category: 'Games',
    question: 'How does the Crash game work?',
    answer: 'In Crash, a multiplier starts at 1.00x and increases over time. You place a bet before the round starts and can cash out at any time. If you cash out before the crash, you win your bet multiplied by the cashout multiplier. If the game crashes before you cash out, you lose your bet. You can also set an auto-cashout multiplier.',
  },
  {
    category: 'Games',
    question: 'What is the house edge?',
    answer: 'Our house edge varies by game: Crash: 3%, Plinko: 1-3% (depending on risk level), Dice: 1%, Mines: 2-5% (depending on mine count). These are among the lowest in the industry. Third-party games have their own RTP (Return to Player) percentages.',
  },
  {
    category: 'Games',
    question: 'Can I play for free?',
    answer: 'Currently, all games require a real money bet. We are working on adding a demo/practice mode where you can play with virtual funds to learn the games before wagering real money.',
  },
  // Account & Security
  {
    category: 'Account & Security',
    question: 'How do I enable Two-Factor Authentication (2FA)?',
    answer: 'Go to your Profile > Security tab. Click "Enable 2FA" and scan the QR code with an authenticator app (Google Authenticator, Authy, etc.). Enter the 6-digit code to confirm. We strongly recommend enabling 2FA for account security.',
  },
  {
    category: 'Account & Security',
    question: 'I forgot my password. How do I reset it?',
    answer: 'Click "Forgot Password" on the login page. Enter your registered email address and we will send you a password reset link. The link expires after 1 hour. If you do not receive the email, check your spam folder or contact support.',
  },
  {
    category: 'Account & Security',
    question: 'What is KYC verification?',
    answer: 'KYC (Know Your Customer) is an identity verification process required for certain actions like large withdrawals. You may need to provide a government-issued ID and proof of address. This is required by our gaming license to prevent fraud and money laundering.',
  },
  // VIP & Bonuses
  {
    category: 'VIP & Bonuses',
    question: 'How does the VIP program work?',
    answer: 'Your VIP level is determined by your total wagered amount. As you play, you automatically progress through 6 tiers: Bronze, Silver, Gold, Platinum, Diamond, and Master. Each tier unlocks better rakeback, higher withdrawal limits, exclusive bonuses, and premium perks.',
  },
  {
    category: 'VIP & Bonuses',
    question: 'What is Rakeback?',
    answer: 'Rakeback is a percentage of the house edge returned to you on every bet, regardless of whether you win or lose. For example, with 10% rakeback on a $100 bet with 3% house edge, you receive $0.30 back. Rakeback is calculated in real-time and can be claimed from your wallet.',
  },
  {
    category: 'VIP & Bonuses',
    question: 'How do wagering requirements work?',
    answer: 'Wagering requirements specify how many times you must bet the bonus amount before you can withdraw bonus funds. For example, a $100 bonus with 30x wagering means you must place $3,000 in total bets before the bonus becomes withdrawable. Only real money bets count towards wagering.',
  },
  // Affiliate
  {
    category: 'Affiliate',
    question: 'How does the referral/affiliate program work?',
    answer: 'Share your unique referral link with friends. When they sign up and play, you earn a percentage of the house edge on their bets. We offer a 3-tier MLM system: Tier 1 (direct referrals): 5-12%, Tier 2: 2-5%, Tier 3: 1-2.5%. Rates increase with your affiliate rank.',
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(faqItems.map((item) => item.category)))];
  const filteredItems = activeCategory === 'All' ? faqItems : faqItems.filter((item) => item.category === activeCategory);

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="faq-page">
        {/* Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">❓ Frequently Asked Questions</h1>
          <p className="text-text-secondary">Find answers to the most common questions about StakePro.</p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                  : 'bg-bg-card text-text-secondary border border-white/10 hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {filteredItems.map((item, i) => (
            <div
              key={i}
              className="bg-bg-card border border-white/10 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-accent-primary text-sm font-mono">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-white font-medium">{item.question}</span>
                </div>
                <svg
                  className={`w-5 h-5 text-text-secondary transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 border-t border-white/5">
                  <p className="text-text-secondary text-sm leading-relaxed pt-4">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Still Need Help */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Still have questions?</h2>
          <p className="text-text-secondary mb-4">Our support team is available 24/7 via live chat.</p>
          <button className="px-6 py-3 bg-gradient-to-r from-primary to-blue-500 text-white rounded-xl font-semibold hover:from-primary hover:to-blue-400 transition-all">
            Open Live Chat
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
