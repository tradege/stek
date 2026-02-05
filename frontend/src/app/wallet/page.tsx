'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function WalletPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch transactions from API
    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cashier/transactions`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const primaryBalance = user?.balance?.find(b => b.currency === 'USDT');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">💰 Wallet</h1>
          <p className="text-slate-400">Manage your funds and transactions</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="text-white/80 text-sm mb-2">Total Balance</div>
          <div className="text-5xl font-bold text-white mb-4">
            ₮ {primaryBalance?.available ? parseFloat(primaryBalance.available).toFixed(2) : '0.00'}
          </div>
          <div className="text-white/60 text-sm">USDT</div>
          
          <div className="flex gap-4 mt-6">
            <button className="bg-white text-cyan-600 px-6 py-3 rounded-lg font-semibold hover:bg-slate-100 transition-colors">
              💳 Deposit
            </button>
            <button className="bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors backdrop-blur">
              💸 Withdraw
            </button>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur">
          <h2 className="text-2xl font-bold text-white mb-6">📊 Recent Transactions</h2>
          
          {loading ? (
            <div className="text-center text-slate-400 py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <div className="text-6xl mb-4">🏦</div>
              <p className="text-lg">No transactions yet</p>
              <p className="text-sm mt-2">Make your first deposit to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-700/50 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                      tx.type === 'DEPOSIT' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {tx.type === 'DEPOSIT' ? '⬇️' : '⬆️'}
                    </div>
                    <div>
                      <div className="text-white font-semibold">{tx.type}</div>
                      <div className="text-slate-400 text-sm">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-orange-400'
                    }`}>
                      {tx.type === 'DEPOSIT' ? '+' : '-'}₮ {tx.amount.toFixed(2)}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                      tx.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                      tx.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
