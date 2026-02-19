'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useBranding } from '@/contexts/BrandingContext';

export default function PrivacyPage() {
  const { branding } = useBranding();
  const name = branding.brandName || 'the Platform';
  const email = branding.supportEmail || 'support@platform.com';
  const privacyEmail = `privacy@${(branding.domain || 'platform.com').replace(/^[^.]*\./, '')}`;
  const dpoEmail = `dpo@${(branding.domain || 'platform.com').replace(/^[^.]*\./, '')}`;

  const sections = [
    {
      title: '1. Information We Collect',
      content: `We collect information you provide directly to us, including: (a) Account information such as email address, username, and password; (b) Financial information such as cryptocurrency wallet addresses and transaction history; (c) Identity verification documents when required for KYC/AML compliance (government-issued ID, proof of address, selfie verification); (d) Communication data from support interactions, chat messages, and feedback submissions. We also automatically collect: IP addresses, browser type and version, device information (type, operating system, screen resolution), referral URLs, pages visited, time spent on pages, click patterns, and usage analytics through cookies and similar technologies.`,
    },
    {
      title: '2. How We Use Your Information',
      content: `We use your information to: (a) Provide, maintain, and improve the Platform and its features; (b) Process transactions, manage your account, and maintain accurate financial records; (c) Verify your identity and prevent fraud, money laundering, and other illegal activities; (d) Comply with legal and regulatory obligations, including anti-money laundering (AML) and know-your-customer (KYC) requirements; (e) Send you important notifications about your account, security alerts, and service updates; (f) Provide customer support and respond to your inquiries; (g) Analyze usage patterns to improve user experience and develop new features; (h) Enforce our Terms of Service and protect the rights and safety of our users; (i) Detect and prevent technical issues, abuse, and security threats. We do not sell your personal information to third parties.`,
    },
    {
      title: '3. Data Sharing and Disclosure',
      content: `We may share your information with: (a) Service providers who assist in operating the Platform, including payment processors, hosting providers, analytics services, and customer support tools — all bound by data processing agreements; (b) Game providers for the purpose of delivering third-party games and verifying game integrity; (c) Regulatory authorities when required by law or in response to valid legal processes; (d) Law enforcement agencies in response to valid legal requests, subpoenas, or court orders; (e) Professional advisors such as lawyers, auditors, and compliance consultants; (f) Affiliated entities within our corporate group for operational and administrative purposes. All third-party service providers are contractually obligated to protect your data and use it only for the specified purposes.`,
    },
    {
      title: '4. Data Security',
      content: `We implement industry-standard security measures to protect your data, including: (a) AES-256 encryption for data at rest; (b) TLS 1.3 encryption for data in transit; (c) Multi-factor authentication options for account access; (d) Regular security audits, vulnerability assessments, and penetration testing; (e) Role-based access controls and activity monitoring for internal systems; (f) Secure data centers with physical security measures, redundant power, and environmental controls; (g) Automated threat detection and incident response procedures. Despite these measures, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security. We encourage users to enable all available security features on their accounts.`,
    },
    {
      title: '5. Cookies and Tracking Technologies',
      content: `We use the following types of cookies and similar technologies: (a) Essential Cookies — required for the Platform to function properly, including session management, authentication, and security tokens. These cannot be disabled. (b) Functional Cookies — remember your preferences such as language, display settings, and recently played games. (c) Analytics Cookies — help us understand how you use the Platform, including page views, session duration, and feature usage. We use these to improve our services. (d) Performance Cookies — monitor Platform performance and help us identify and fix technical issues. You can control non-essential cookie settings through your browser preferences. Disabling essential cookies may affect Platform functionality. We do not use advertising or third-party tracking cookies.`,
    },
    {
      title: '6. Data Retention',
      content: `We retain your personal data for as long as your account is active or as needed to provide services. After account closure, we retain certain data for up to 5 years to comply with legal obligations (anti-money laundering regulations, tax requirements, and regulatory record-keeping). Transaction records and financial data are retained for 7 years as required by applicable financial regulations. Game history and fairness verification data are retained for 3 years. You may request deletion of your data, subject to our legal retention obligations. Data that is no longer required is securely deleted or anonymized.`,
    },
    {
      title: '7. Your Rights (GDPR and Global Privacy)',
      content: `If you are located in the European Economic Area, United Kingdom, or other jurisdictions with applicable privacy laws, you have the following rights: (a) Right to access your personal data and obtain a copy; (b) Right to rectification of inaccurate or incomplete data; (c) Right to erasure ("right to be forgotten"), subject to legal retention requirements; (d) Right to restrict processing of your data in certain circumstances; (e) Right to data portability — receive your data in a structured, machine-readable format; (f) Right to object to processing based on legitimate interests; (g) Right to withdraw consent at any time where processing is based on consent; (h) Right to lodge a complaint with your local data protection authority. To exercise these rights, contact our Data Protection Officer at ${dpoEmail}. We will respond within 30 days.`,
    },
    {
      title: '8. International Data Transfers',
      content: `Your data may be transferred to and processed in countries outside your country of residence. We ensure that appropriate safeguards are in place for international data transfers, including Standard Contractual Clauses (SCCs) approved by the European Commission, adequacy decisions, or other legally recognized transfer mechanisms. By using the Platform, you consent to the transfer of your data to jurisdictions that may have different data protection laws than your own.`,
    },
    {
      title: '9. Third-Party Links and Services',
      content: `The Platform may contain links to third-party websites, services, or applications. We are not responsible for the privacy practices, content, or security of these third parties. We encourage you to read the privacy policies of any third-party sites you visit. Third-party game providers may collect certain data in accordance with their own privacy policies when you access their games through our Platform.`,
    },
    {
      title: "10. Children's Privacy",
      content: `The Platform is not intended for individuals under the age of 18 (or the legal gambling age in the applicable jurisdiction). We do not knowingly collect personal information from minors. If we discover that we have collected data from a minor, we will delete it immediately and terminate the associated account. If you believe a minor has provided us with personal information, please contact us immediately at ${email}.`,
    },
    {
      title: '11. Changes to This Policy',
      content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of significant changes by posting a prominent notice on the Platform, sending you an email, or through an in-app notification. Your continued use of the Platform after changes constitutes acceptance of the updated policy. We encourage you to review this policy periodically.`,
    },
    {
      title: '12. Contact Us',
      content: `For questions about this Privacy Policy, to exercise your data rights, or to report a privacy concern, contact us at: General Inquiries: ${email}. Privacy Matters: ${privacyEmail}. Data Protection Officer: ${dpoEmail}. You also have the right to lodge a complaint with your local data protection authority if you believe your privacy rights have been violated.`,
    },
  ];

  return (
    <MainLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" data-testid="privacy-page">
        {/* Header */}
        <div className="bg-bg-card border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-text-secondary">Last updated: February 16, 2026</p>
        </div>

        {/* Introduction */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <p className="text-text-secondary text-sm leading-relaxed">
            {name} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy and safeguarding your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully. By using {name}, you consent to the data practices described in this policy. If you do not agree with this policy, please do not use the Platform.
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
