'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useBranding } from '@/contexts/BrandingContext';

export default function TermsPage() {
  const { branding } = useBranding();
  const name = branding.brandName || 'the Platform';
  const email = branding.supportEmail || 'support@platform.com';

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By accessing or using ${name} ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Platform. These Terms constitute a legally binding agreement between you and ${name}. We reserve the right to update or modify these Terms at any time, and your continued use of the Platform following any changes constitutes your acceptance of the revised Terms.`,
    },
    {
      title: '2. Eligibility',
      content: `You must be at least 18 years of age (or the legal gambling age in your jurisdiction, whichever is higher) to use ${name}. By using the Platform, you represent and warrant that you meet the age requirement and that online gambling is legal in your jurisdiction. ${name} reserves the right to request proof of age and identity at any time and may suspend or terminate accounts that fail to meet eligibility requirements. It is your sole responsibility to determine whether your use of the Platform is lawful in your jurisdiction.`,
    },
    {
      title: '3. Prohibited Territories',
      content: `${name} does not offer services to residents or persons located in the following jurisdictions: the United States of America and its territories, the United Kingdom, France and its territories, the Netherlands, Australia, Spain, Italy, Turkey, Iran, North Korea, Cuba, Syria, Sudan, and any other jurisdiction where online gambling is prohibited or requires a specific license that ${name} does not hold. By accessing the Platform, you confirm that you are not a resident of, or located in, any prohibited territory. ${name} reserves the right to block access, void bets, and confiscate funds from users found to be in violation of this restriction. The use of VPNs, proxies, or other tools to circumvent geographic restrictions is strictly prohibited.`,
    },
    {
      title: '4. Account Registration',
      content: `To use certain features of the Platform, you must create an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify ${name} immediately of any unauthorized use of your account. Each person may only maintain one account. Multi-accounting is strictly prohibited and will result in account termination and forfeiture of funds. ${name} reserves the right to refuse registration or close accounts at its sole discretion.`,
    },
    {
      title: '5. Deposits and Withdrawals',
      content: `${name} supports cryptocurrency deposits and withdrawals. Deposits are credited after the required number of blockchain confirmations. Withdrawal requests are processed within 24 hours, subject to security verification. ${name} reserves the right to request identity verification (KYC) before processing withdrawals exceeding certain thresholds. Minimum deposit and withdrawal amounts apply as displayed on the Platform. ${name} is not responsible for funds sent to incorrect wallet addresses. All transactions are final once confirmed on the blockchain.`,
    },
    {
      title: '6. Bonuses and Promotions',
      content: `Bonuses and promotions are subject to specific terms and conditions as stated in each offer. Wagering requirements must be met before bonus funds can be withdrawn. ${name} reserves the right to void bonuses and winnings derived from bonus abuse, including but not limited to: multi-accounting, collusion, exploiting technical errors, or any other form of unfair advantage. Bonus terms may be modified or cancelled at any time at ${name}'s discretion. A maximum bet limit applies while a bonus is active.`,
    },
    {
      title: '7. Provably Fair Gaming',
      content: `${name} uses a provably fair system for all in-house games. Each game round uses a combination of server seed, client seed, and nonce to generate verifiable results. Players can verify the fairness of any game round using the verification tools provided. The server seed hash is published before each round begins, and the unhashed server seed is revealed after the round ends. Third-party games are provided by licensed game providers and are subject to their own fairness certifications and RNG audits.`,
    },
    {
      title: '8. Prohibited Activities',
      content: `The following activities are strictly prohibited: (a) Using the Platform for money laundering, terrorist financing, or any illegal activity; (b) Using automated software, bots, or scripts to interact with the Platform; (c) Exploiting bugs, glitches, or technical errors for financial gain; (d) Colluding with other players to manipulate game outcomes; (e) Creating multiple accounts or using another person's account; (f) Using VPNs, proxies, or similar tools to circumvent geographic restrictions; (g) Engaging in any activity that disrupts the Platform's operations or degrades the experience for other users; (h) Attempting to reverse-engineer, decompile, or hack any part of the Platform. Violation of these terms will result in immediate account termination and forfeiture of all funds.`,
    },
    {
      title: '9. Responsible Gambling',
      content: `${name} is committed to promoting responsible gambling. We provide tools to help you manage your gaming activity, including deposit limits, loss limits, session time limits, cooling-off periods, and self-exclusion options. If you believe you may have a gambling problem, we strongly encourage you to use these tools and seek professional help. Please visit our Responsible Gaming page for more information and links to support organizations. ${name} reserves the right to limit or close accounts where problem gambling behavior is suspected.`,
    },
    {
      title: '10. Intellectual Property',
      content: `All content on the Platform, including but not limited to text, graphics, logos, icons, images, audio, video, software, and code, is the property of ${name} or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any content without prior written consent from ${name}.`,
    },
    {
      title: '11. Limitation of Liability',
      content: `${name} is provided "as is" without warranties of any kind, either express or implied. To the maximum extent permitted by law, ${name} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. ${name}'s total liability shall not exceed the amount of funds in your account at the time of the claim. ${name} is not responsible for losses due to blockchain network issues, wallet errors, third-party service failures, or force majeure events.`,
    },
    {
      title: '12. Dispute Resolution',
      content: `Any disputes arising from these Terms or your use of the Platform shall first be resolved through ${name}'s internal complaint procedure by contacting our support team. If the dispute cannot be resolved internally within 30 days, it shall be submitted to binding arbitration. The arbitration shall be conducted in accordance with the rules of the applicable arbitration body. The language of arbitration shall be English. Each party shall bear its own costs of arbitration.`,
    },
    {
      title: '13. Account Suspension and Termination',
      content: `${name} reserves the right to suspend, restrict, or terminate your account at any time and for any reason, including but not limited to: suspected fraud, violation of these Terms, regulatory requirements, or inactivity exceeding 12 months. Upon termination, any remaining balance (excluding funds derived from fraudulent or prohibited activity) will be made available for withdrawal, subject to verification requirements.`,
    },
    {
      title: '14. Modifications',
      content: `${name} reserves the right to modify these Terms at any time. Changes will be effective immediately upon posting on the Platform. Material changes will be communicated via email or a prominent notice on the Platform. Your continued use of the Platform after changes constitutes acceptance of the modified Terms. We encourage you to review these Terms periodically.`,
    },
    {
      title: '15. Contact',
      content: `For questions about these Terms, please contact our support team via the live chat feature on the Platform or email ${email}. We aim to respond to all inquiries within 48 hours.`,
    },
  ];

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="terms-page">
        {/* Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-text-secondary">Last updated: February 16, 2026</p>
        </div>

        {/* Introduction */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <p className="text-text-secondary text-sm leading-relaxed">
            Welcome to {name}. These Terms of Service govern your access to and use of the Platform, including all associated services, features, and content. Please read these Terms carefully before using the Platform. By creating an account or placing a bet, you acknowledge that you have read, understood, and agree to be bound by these Terms.
          </p>
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
