'use client';

import MainLayout from '@/components/layout/MainLayout';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using StakePro ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Platform. These Terms constitute a legally binding agreement between you and StakePro.`,
  },
  {
    title: '2. Eligibility',
    content: `You must be at least 18 years of age (or the legal gambling age in your jurisdiction, whichever is higher) to use StakePro. By using the Platform, you represent and warrant that you meet the age requirement and that online gambling is legal in your jurisdiction. StakePro reserves the right to request proof of age at any time and may suspend or terminate accounts that fail to meet eligibility requirements.`,
  },
  {
    title: '3. Account Registration',
    content: `To use certain features of the Platform, you must create an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify StakePro immediately of any unauthorized use of your account. Each person may only maintain one account. Multi-accounting is strictly prohibited and will result in account termination and forfeiture of funds.`,
  },
  {
    title: '4. Deposits and Withdrawals',
    content: `StakePro supports cryptocurrency deposits and withdrawals. Deposits are credited after the required number of blockchain confirmations. Withdrawal requests are processed within 24 hours, subject to security verification. StakePro reserves the right to request identity verification (KYC) before processing withdrawals. Minimum deposit and withdrawal amounts apply as displayed on the Platform. StakePro is not responsible for funds sent to incorrect wallet addresses.`,
  },
  {
    title: '5. Bonuses and Promotions',
    content: `Bonuses and promotions are subject to specific terms and conditions as stated in each offer. Wagering requirements must be met before bonus funds can be withdrawn. StakePro reserves the right to void bonuses and winnings derived from bonus abuse, including but not limited to: multi-accounting, collusion, exploiting technical errors, or any other form of unfair advantage. Bonus terms may be modified or cancelled at any time at StakePro's discretion.`,
  },
  {
    title: '6. Provably Fair Gaming',
    content: `StakePro uses a provably fair system for all in-house games. Each game round uses a combination of server seed, client seed, and nonce to generate verifiable results. Players can verify the fairness of any game round using the verification tools provided. The server seed hash is published before each round begins, and the unhashed server seed is revealed after the round ends. Third-party games are provided by licensed game providers and are subject to their own fairness certifications.`,
  },
  {
    title: '7. Prohibited Activities',
    content: `The following activities are strictly prohibited: (a) Using the Platform for money laundering or any illegal activity; (b) Using automated software, bots, or scripts to interact with the Platform; (c) Exploiting bugs, glitches, or technical errors; (d) Colluding with other players; (e) Creating multiple accounts; (f) Using VPNs or proxies to circumvent geographic restrictions; (g) Engaging in any activity that disrupts the Platform's operations. Violation of these terms will result in immediate account termination and forfeiture of all funds.`,
  },
  {
    title: '8. Intellectual Property',
    content: `All content on the Platform, including but not limited to text, graphics, logos, icons, images, audio, video, software, and code, is the property of StakePro or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any content without prior written consent from StakePro.`,
  },
  {
    title: '9. Limitation of Liability',
    content: `StakePro is provided "as is" without warranties of any kind. To the maximum extent permitted by law, StakePro shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. StakePro's total liability shall not exceed the amount of funds in your account at the time of the claim. StakePro is not responsible for losses due to blockchain network issues, wallet errors, or third-party service failures.`,
  },
  {
    title: '10. Dispute Resolution',
    content: `Any disputes arising from these Terms or your use of the Platform shall first be resolved through StakePro's internal complaint procedure. If the dispute cannot be resolved internally within 30 days, it shall be submitted to binding arbitration. The arbitration shall be conducted in accordance with the rules of the applicable arbitration body. The language of arbitration shall be English.`,
  },
  {
    title: '11. Modifications',
    content: `StakePro reserves the right to modify these Terms at any time. Changes will be effective immediately upon posting on the Platform. Your continued use of the Platform after changes constitutes acceptance of the modified Terms. We encourage you to review these Terms periodically.`,
  },
  {
    title: '12. Contact',
    content: `For questions about these Terms, please contact our support team via the live chat feature on the Platform or email support@stakepro.com.`,
  },
];

export default function TermsPage() {
  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="terms-page">
        {/* Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">📜 Terms of Service</h1>
          <p className="text-text-secondary">Last updated: February 8, 2026</p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, i) => (
            <div key={i} className="bg-bg-card border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-3">{section.title}</h2>
              <p className="text-text-secondary text-sm leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
