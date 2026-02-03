'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  status: string;
  amount: string;
  currency: string;
  txHash?: string;
  walletAddress?: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function AdminTransactionsPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check admin access
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch transactions
  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      fetchTransactions();
    }
  }, [token, filter, user]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const endpoint = filter === 'pending' 
        ? '/admin/transactions/pending' 
        : '/admin/transactions';
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (transactionId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(transactionId);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/admin/transactions/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionId,
          action,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || `Transaction ${action.toLowerCase()}d!` });
        // Remove from list or refresh
        fetchTransactions();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to process transaction' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateHash = (hash?: string) => {
    if (!hash) return '-';
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Transaction Management</h1>
            <p className="text-text-secondary mt-1">Approve or reject deposit and withdrawal requests</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            ← Back to Game
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setFilter('pending')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              filter === 'pending'
                ? 'bg-accent-primary text-black shadow-glow-cyan'
                : 'bg-white/10 text-text-secondary hover:text-white'
            }`}
          >
            Pending ({transactions.filter(t => t.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-accent-primary text-black shadow-glow-cyan'
                : 'bg-white/10 text-text-secondary hover:text-white'
            }`}
          >
            All Transactions
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-bg-card rounded-xl border border-white/10 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-text-secondary mt-4">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-secondary">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">User</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Type</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">TX Hash / Address</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-medium">{tx.user.username}</p>
                          <p className="text-text-secondary text-sm">{tx.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          tx.type === 'DEPOSIT'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-mono font-bold">
                          {parseFloat(tx.amount).toLocaleString()} {tx.currency}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-text-secondary font-mono text-sm">
                          {tx.type === 'DEPOSIT' 
                            ? truncateHash(tx.txHash)
                            : truncateHash(tx.walletAddress)
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          tx.status === 'PENDING'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : tx.status === 'CONFIRMED'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary text-sm">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        {tx.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(tx.id, 'APPROVE')}
                              disabled={processingId === tx.id}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              {processingId === tx.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAction(tx.id, 'REJECT')}
                              disabled={processingId === tx.id}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              {processingId === tx.id ? '...' : 'Reject'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-text-secondary text-sm">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-bg-card rounded-xl p-6 border border-white/10">
            <h3 className="text-text-secondary text-sm mb-2">Pending Deposits</h3>
            <p className="text-2xl font-bold text-accent-primary">
              {transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'PENDING').length}
            </p>
          </div>
          <div className="bg-bg-card rounded-xl p-6 border border-white/10">
            <h3 className="text-text-secondary text-sm mb-2">Pending Withdrawals</h3>
            <p className="text-2xl font-bold text-accent-danger">
              {transactions.filter(t => t.type === 'WITHDRAWAL' && t.status === 'PENDING').length}
            </p>
          </div>
          <div className="bg-bg-card rounded-xl p-6 border border-white/10">
            <h3 className="text-text-secondary text-sm mb-2">Total Pending Value</h3>
            <p className="text-2xl font-bold text-white">
              ${transactions
                .filter(t => t.status === 'PENDING')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
