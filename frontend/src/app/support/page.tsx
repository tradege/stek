'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-[#0A0E17] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Support Center</h1>
            <p className="text-gray-400 text-lg">Need help? We are here for you 24/7</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Methods */}
            <div className="space-y-6">
              <div className="bg-[#1A1F2E] rounded-2xl p-6 border border-gray-700/50">
                <h2 className="text-xl font-bold text-white mb-4">Quick Contact</h2>
                <div className="space-y-4">
                  <a href="https://t.me/support" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-[#0A0E17] rounded-xl hover:bg-[#141824] transition-colors">
                    <span className="text-2xl">💬</span>
                    <div>
                      <div className="text-white font-medium">Telegram</div>
                      <div className="text-gray-400 text-sm">Fastest response - under 5 minutes</div>
                    </div>
                  </a>
                  <a href="mailto:support@stakepro.com"
                    className="flex items-center gap-3 p-3 bg-[#0A0E17] rounded-xl hover:bg-[#141824] transition-colors">
                    <span className="text-2xl">📧</span>
                    <div>
                      <div className="text-white font-medium">Email</div>
                      <div className="text-gray-400 text-sm">support@stakepro.com</div>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 p-3 bg-[#0A0E17] rounded-xl">
                    <span className="text-2xl">🕐</span>
                    <div>
                      <div className="text-white font-medium">Live Chat</div>
                      <div className="text-gray-400 text-sm">Available 24/7 in-app</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1F2E] rounded-2xl p-6 border border-gray-700/50">
                <h2 className="text-xl font-bold text-white mb-4">Common Topics</h2>
                <ul className="space-y-2 text-gray-400">
                  <li className="flex items-center gap-2"><span>💰</span> Deposits & Withdrawals</li>
                  <li className="flex items-center gap-2"><span>🎮</span> Game Issues</li>
                  <li className="flex items-center gap-2"><span>🔒</span> Account Security</li>
                  <li className="flex items-center gap-2"><span>🎁</span> Bonuses & Promotions</li>
                  <li className="flex items-center gap-2"><span>👥</span> Affiliate Program</li>
                </ul>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-[#1A1F2E] rounded-2xl p-6 border border-gray-700/50">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">✅</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Message Sent</h2>
                  <p className="text-gray-400">We will get back to you within 24 hours.</p>
                  <button onClick={() => setSubmitted(false)}
                    className="mt-6 px-6 py-3 bg-accent-primary text-black font-semibold rounded-lg hover:bg-accent-primary/90 transition-colors">
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="text-xl font-bold text-white mb-4">Send a Message</h2>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Name</label>
                    <input type="text" required value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none"
                      placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Email</label>
                    <input type="email" required value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none"
                      placeholder="your@email.com" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Subject</label>
                    <input type="text" required value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none"
                      placeholder="How can we help?" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Message</label>
                    <textarea required rows={5} value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none resize-none"
                      placeholder="Describe your issue..." />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 bg-accent-primary text-black font-semibold rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 min-h-[44px]">
                    {loading ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
