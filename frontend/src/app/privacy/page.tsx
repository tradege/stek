'use client';

import React from 'react';
import MainLayout from '@/components/layout/MainLayout';

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly to us, including: (a) Account information such as email address, username, and password; (b) Financial information such as cryptocurrency wallet addresses and transaction history; (c) Identity verification documents when required for KYC compliance; (d) Communication data from support interactions and chat messages. We also automatically collect: IP addresses, browser type, device information, operating system, referral URLs, and usage patterns through cookies and similar technologies.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information to: (a) Provide, maintain, and improve the Platform; (b) Process transactions and manage your account; (c) Verify your identity and prevent fraud; (d) Comply with legal and regulatory obligations; (e) Send you important notifications about your account; (f) Provide customer support; (g) Analyze usage patterns to improve user experience; (h) Enforce our Terms of Service. We do not sell your personal information to third parties.`,
  },
  {
    title: '3. Data Sharing',
    content: `We may share your information with: (a) Service providers who assist in operating the Platform (payment processors, hosting providers, analytics services); (b) Game providers for the purpose of delivering third-party games; (c) Regulatory authorities when required by law; (d) Law enforcement agencies in response to valid legal requests; (e) Professional advisors such as lawyers and auditors. All third-party service providers are contractually obligated to protect your data and use it only for the specified purposes.`,
  },
  {
    title: '4. Data Security',
    content: `We implement industry-standard security measures to protect your data, including: (a) AES-256 encryption for data at rest; (b) TLS 1.3 encryption for data in transit; (c) Multi-factor authentication options; (d) Regular security audits and penetration testing; (e) Access controls and monitoring; (f) Secure data centers with physical security measures. Despite these measures, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '5. Data Retention',
    content: `We retain your personal data for as long as your account is active or as needed to provide services. After account closure, we retain certain data for up to 5 years to comply with legal obligations (anti-money laundering regulations, tax requirements). Transaction records are retained for 7 years. You may request deletion of your data, subject to our legal retention obligations.`,
  },
  {
    title: '6. Your Rights (GDPR)',
    content: `If you are located in the European Economic Area, you have the following rights: (a) Right to access your personal data; (b) Right to rectification of inaccurate data; (c) Right to erasure ("right to be forgotten"); (d) Right to restrict processing; (e) Right to data portability; (f) Right to object to processing; (g) Right to withdraw consent at any time. To exercise these rights, contact our Data Protection Officer at privacy@stakepro.com. We will respond within 30 days.`,
  },
  {
    title: '7. Cookies',
    content: `We use cookies and similar tracking technologies to: (a) Keep you logged in; (b) Remember your preferences; (c) Analyze site traffic and usage; (d) Prevent fraud. Essential cookies are required for the Platform to function. Analytics cookies help us understand how you use the Platform. You can control cookie settings through your browser, but disabling essential cookies may affect Platform functionality.`,
  },
  {
    title: '8. Third-Party Links',
    content: `The Platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read the privacy policies of any third-party sites you visit.`,
  },
  {
    title: '9. Children\'s Privacy',
    content: `The Platform is not intended for individuals under the age of 18. We do not knowingly collect personal information from minors. If we discover that we have collected data from a minor, we will delete it immediately and terminate the associated account.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on the Platform or sending you an email. Your continued use of the Platform after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Contact Us',
    content: `For questions about this Privacy Policy or to exercise your data rights, contact us at: Email: privacy@stakepro.com. Data Protection Officer: dpo@stakepro.com. You also have the right to lodge a complaint with your local data protection authority.`,
  },
];

export default function PrivacyPage() {
  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="privacy-page">
        {/* Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">🔒 Privacy Policy</h1>
          <p className="text-text-secondary">Last updated: February 8, 2026</p>
        </div>

        {/* Introduction */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <p className="text-text-secondary text-sm leading-relaxed">
            StakePro (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully. By using StakePro, you consent to the data practices described in this policy.
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
