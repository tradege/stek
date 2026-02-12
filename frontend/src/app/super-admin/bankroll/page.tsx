'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Send,
  Clock,
  Building2,
} from 'lucide-react';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface BankrollItem {
  tenantId: string;
  brandName: string;
  domain: string;
  houseBalance: number;
  houseProfit: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalWagered: number;
  totalPayout: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

interface TransferHistoryItem {
  id: string;
  amount: number;
  note: string;
  source: string;
  timestamp: string;
}

export default function BankrollPage() {
  const { token } = useAuth();
  const [bankroll, setBankroll] = useState<BankrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [history, setHistory] = useState<TransferHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchBankroll();
  }, [token]);

  const fetchBankroll = async () => {
    try {
      const res = await fetch(`${API_URL}/api/super-admin/bankroll`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBankroll(await res.json());
    } catch (err) {
      console.error('Failed to fetch bankroll:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (tenantId: string) => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) return;

    setTransferring(true);
    try {
      const res = await fetch(`${API_URL}/api/super-admin/bankroll/${tenantId}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, note: transferNote }),
      });

      if (res.ok) {
        setTransferAmount('');
        setTransferNote('');
        setSelectedTenant(null);
        fetchBankroll();
      }
    } catch (err) {
      console.error('Transfer failed:', err);
    } finally {
      setTransferring(false);
    }
  };

  const fetchHistory = async (tenantId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/super-admin/bankroll/${tenantId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHistory(await res.json());
        setShowHistory(tenantId);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    const v = Number(val) || 0;
    if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
    return `$${v.toFixed(2)}`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
      case 'WARNING':
        return { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
      case 'CRITICAL':
        return { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      default:
        return { icon: <CheckCircle className="w-4 h-4" />, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Calculate totals
  const totalHouseBalance = bankroll.reduce((s, b) => s + (b.houseBalance || 0), 0);
  const totalHouseProfit = bankroll.reduce((s, b) => s + (b.houseProfit || 0), 0);
  const criticalCount = bankroll.filter((b) => b.status === 'CRITICAL').length;
  const warningCount = bankroll.filter((b) => b.status === 'WARNING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Bankroll Management</h1>
        <p className="text-text-secondary mt-1">Manage house wallets for all brands</p>
      </div>

      {/* Alert for critical brands */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">
            <strong>{criticalCount} brand(s)</strong> have critical balance levels. Withdrawals may be paused.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-cyan-400" />
            <span className="text-sm text-text-secondary">Total House Balance</span>
          </div>
          <p className={`text-2xl font-bold ${totalHouseBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalHouseBalance)}
          </p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-sm text-text-secondary">Total House Profit</span>
          </div>
          <p className={`text-2xl font-bold ${totalHouseProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(totalHouseProfit)}
          </p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <span className="text-sm text-text-secondary">Active Brands</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{bankroll.length}</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-text-secondary">Alerts</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{criticalCount + warningCount}</p>
        </div>
      </div>

      {/* Bankroll Table */}
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">House Wallets</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Brand</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">House Balance</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">House Profit</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Deposits</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Withdrawals</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bankroll.map((item) => {
                const statusCfg = getStatusConfig(item.status);
                return (
                  <tr key={item.tenantId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{item.brandName}</p>
                      <p className="text-xs text-text-secondary">{item.domain}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`}>
                        {statusCfg.icon}
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${item.houseBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(item.houseBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm ${item.houseProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(item.houseProfit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-green-400">{formatCurrency(item.totalDeposits)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-red-400">{formatCurrency(item.totalWithdrawals)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedTenant(selectedTenant === item.tenantId ? null : item.tenantId)}
                          className="px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                        >
                          <Send className="w-3 h-3 inline mr-1" />
                          Fund
                        </button>
                        <button
                          onClick={() => fetchHistory(item.tenantId)}
                          className="px-3 py-1.5 text-xs bg-white/5 text-text-secondary rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <Clock className="w-3 h-3 inline mr-1" />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {bankroll.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                    No active brands found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal */}
      {selectedTenant && (
        <div className="bg-bg-card border border-cyan-500/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Transfer Funds to {bankroll.find((b) => b.tenantId === selectedTenant)?.brandName}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Amount (USDT)</label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                min={0}
                step={100}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Note (optional)</label>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="e.g., Monthly funding"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => handleTransfer(selectedTenant)}
                disabled={transferring || !transferAmount}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
              >
                {transferring ? 'Sending...' : 'Send Funds'}
              </button>
              <button
                onClick={() => setSelectedTenant(null)}
                className="px-4 py-3 bg-white/5 text-text-secondary rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer History Modal */}
      {showHistory && (
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Transfer History — {bankroll.find((b) => b.tenantId === showHistory)?.brandName}
            </h3>
            <button
              onClick={() => setShowHistory(null)}
              className="text-text-secondary hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ArrowUpCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm text-white font-medium">{formatCurrency(h.amount)}</p>
                      <p className="text-xs text-text-secondary">{h.note}</p>
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {new Date(h.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-8">No transfers recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
