'use client';
import { useState } from 'react';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientUsername?: string;
}

export default function TipModal({ isOpen, onClose, recipientUsername = '' }: TipModalProps) {
  const [toUsername, setToUsername] = useState(recipientUsername);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to send tips');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/chat/tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          toUsername,
          amount: parseFloat(amount),
          message: message || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setToUsername('');
          setAmount('');
          setMessage('');
        }, 2000);
      } else {
        setError(data.error || data.message || 'Failed to send tip');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1A1F2E] rounded-2xl border border-gray-700/50 p-6 max-w-md w-full shadow-2xl">
        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Tip Sent!</h2>
            <p className="text-gray-400">Your tip has been delivered</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Send a Tip</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-sm mb-2">To User</label>
                <input
                  type="text"
                  required
                  value={toUsername}
                  onChange={(e) => setToUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Amount (USDT)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Message (optional)</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0A0E17] border border-gray-700 rounded-lg text-white focus:border-accent-primary focus:outline-none resize-none"
                  placeholder="Say something nice..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent-primary text-black font-bold rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Tip'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
