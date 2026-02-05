'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000';

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  username: string;
  email: string;
  createdAt: string;
  txHash?: string;
  walletAddress?: string;
}

export default function AdminTransactionsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Simulate Deposit Modal State
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulateEmail, setSimulateEmail] = useState('');
  const [simulateAmount, setSimulateAmount] = useState('');
  const [simulateCurrency, setSimulateCurrency] = useState('USDT');
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateMessage, setSimulateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      fetchTransactions();
    }
  }, [token, user]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.map((t: any) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          amount: parseFloat(t.amount),
          currency: t.currency || 'USDT',
          username: t.user?.username || 'Unknown',
          email: t.user?.email || '',
          createdAt: t.createdAt,
          txHash: t.txHash,
          walletAddress: t.walletAddress,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transactionId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessing(transactionId);
    try {
      const response = await fetch(`${API_URL}/admin/transactions/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionId, action }),
      });
      if (response.ok) {
        fetchTransactions();
      }
    } catch (error) {
      console.error('Failed to process transaction:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleSimulateDeposit = async () => {
    if (!simulateEmail || !simulateAmount) {
      setSimulateMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setSimulateLoading(true);
    setSimulateMessage(null);

    try {
      const response = await fetch(`${API_URL}/admin/deposit/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userEmail: simulateEmail,
          amount: parseFloat(simulateAmount),
          currency: simulateCurrency,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSimulateMessage({ 
          type: 'success', 
          text: `✅ ${data.message}` 
        });
        setSimulateEmail('');
        setSimulateAmount('');
        fetchTransactions();
        // Close modal after 2 seconds on success
        setTimeout(() => {
          setShowSimulateModal(false);
          setSimulateMessage(null);
        }, 2000);
      } else {
        setSimulateMessage({ type: 'error', text: data.message || 'Failed to simulate deposit' });
      }
    } catch (error) {
      setSimulateMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSimulateLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    return true;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = transactions.filter(t => t.status === 'PENDING').length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">💳 Transactions</h1>
            <p className="text-text-secondary mt-1">Manage deposits and withdrawals</p>
          </div>
          <button
            onClick={() => setShowSimulateModal(true)}
            className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 shadow-lg"
          >
            <span className="text-xl">💰</span>
            Simulate Deposit
          </button>
        </div>

        {/* Pending Alert */}
        {pendingCount > 0 && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-[#1475e1] font-bold">{pendingCount} Pending Transaction{pendingCount > 1 ? 's' : ''}</p>
                <p className="text-[#1475e1]/70 text-sm">Requires your approval</p>
              </div>
            </div>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg hover:bg-[#1475e1] transition-colors"
            >
              View Pending
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-bg-card rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-bg-primary rounded-lg border border-white/10 text-white focus:outline-none focus:border-accent-primary"
            >
              <option value="ALL">All Types</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-bg-primary rounded-lg border border-white/10 text-white focus:outline-none focus:border-accent-primary"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button
              onClick={fetchTransactions}
              className="px-4 py-2 bg-accent-primary text-black rounded-lg hover:bg-accent-primary/90 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-bg-card rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-text-secondary font-medium">User</th>
                    <th className="px-6 py-4 text-left text-text-secondary font-medium">Type</th>
                    <th className="px-6 py-4 text-left text-text-secondary font-medium">Amount</th>
                    <th className="px-6 py-4 text-left text-text-secondary font-medium">Status</th>
                    <th className="px-6 py-4 text-left text-text-secondary font-medium">Date</th>
                    <th className="px-6 py-4 text-left text-text-secondary font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => (
                      <tr key={t.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        t.status === 'PENDING' ? 'bg-yellow-500/5' : ''
                      }`}>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-white font-medium">{t.username}</p>
                            <p className="text-text-secondary text-sm">{t.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            t.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {t.type === 'DEPOSIT' ? '⬇️' : '⬆️'} {t.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${
                            t.type === 'DEPOSIT' ? 'text-green-400' : 'text-orange-400'
                          }`}>
                            {t.type === 'DEPOSIT' ? '+' : '-'}{t.amount.toLocaleString()} {t.currency}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            t.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-400' :
                            t.status === 'PENDING' ? 'bg-yellow-500/20 text-[#1475e1] animate-pulse' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {t.status === 'PENDING' ? '⏳' : t.status === 'CONFIRMED' ? '✅' : '❌'} {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-text-secondary text-sm">{formatDate(t.createdAt)}</td>
                        <td className="px-6 py-4">
                          {t.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(t.id, 'APPROVE')}
                                disabled={processing === t.id}
                                className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                              >
                                {processing === t.id ? '...' : '✅ Approve'}
                              </button>
                              <button
                                onClick={() => handleApprove(t.id, 'REJECT')}
                                disabled={processing === t.id}
                                className="px-3 py-1 bg-red-500 text-white text-sm font-medium rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                              >
                                {processing === t.id ? '...' : '❌ Reject'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Simulate Deposit Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSimulateModal(false)}
          />
          <div className="relative w-full max-w-md mx-4 bg-bg-card rounded-xl border border-white/10 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <h2 className="text-xl font-bold text-white">Simulate Deposit</h2>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <p className="text-text-secondary text-sm">
                Directly credit funds to a user's wallet. This is for testing purposes and bypasses blockchain verification.
              </p>

              {/* Message */}
              {simulateMessage && (
                <div className={`p-4 rounded-lg ${
                  simulateMessage.type === 'success' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {simulateMessage.text}
                </div>
              )}

              {/* User Email */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">User Email</label>
                <input
                  type="email"
                  value={simulateEmail}
                  onChange={(e) => setSimulateEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Amount</label>
                <input
                  type="number"
                  value={simulateAmount}
                  onChange={(e) => setSimulateAmount(e.target.value)}
                  placeholder="100"
                  min="0"
                  step="0.01"
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Currency</label>
                <div className="flex gap-2">
                  {['USDT', 'BTC', 'ETH', 'SOL'].map((currency) => (
                    <button
                      key={currency}
                      onClick={() => setSimulateCurrency(currency)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all ${
                        simulateCurrency === currency
                          ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary'
                          : 'bg-white/5 text-text-secondary border border-white/10 hover:border-white/30'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSimulateDeposit}
                disabled={simulateLoading || !simulateEmail || !simulateAmount}
                className="w-full py-4 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {simulateLoading ? 'Processing...' : '💰 Credit Funds'}
              </button>

              <p className="text-xs text-text-secondary text-center">
                ⚠️ This action is logged and cannot be undone.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
