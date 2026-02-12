'use client';
import React, { useState, useEffect } from 'react';
import config from '@/config/api';
import { useAuth } from '@/hooks/useAuth';

const API_URL = config.apiUrl;

interface SportBetAdmin {
  id: string;
  selection: string;
  selectionName: string;
  odds: number;
  stake: number;
  potentialWin: number;
  status: string;
  profit: number | null;
  createdAt: string;
  user: { username: string; email: string };
  event: {
    homeTeam: string;
    awayTeam: string;
    sportTitle: string;
    commenceTime: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
}

interface SportsStats {
  totalBets: number;
  pendingBets: number;
  totalStaked: number;
  totalPaidOut: number;
  ggr: number;
  totalEvents: number;
  upcomingEvents: number;
  apiStatus: {
    apiKeyConfigured: boolean;
    lastFetchTime: string | null;
    apiCallsThisMonth: number;
    maxMonthlyCallsLimit: number;
  };
}

export default function AdminSportsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<SportsStats | null>(null);
  const [bets, setBets] = useState<SportBetAdmin[]>([]);
  const [totalBets, setTotalBets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [fetchingOdds, setFetchingOdds] = useState(false);
  const [settlingBets, setSettlingBets] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Force settle modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleEventId, setSettleEventId] = useState('');
  const [settleHomeScore, setSettleHomeScore] = useState('');
  const [settleAwayScore, setSettleAwayScore] = useState('');

  const getToken = () => token || localStorage.getItem('auth_token');

  const fetchStats = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/sports/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchBets = async () => {
    const token = getToken();
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      
      const res = await fetch(`${API_URL}/api/admin/sports/bets?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBets(data.bets || []);
        setTotalBets(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch bets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats();
      fetchBets();
    }
  }, [statusFilter, token]);

  const handleTriggerFetch = async () => {
    const token = getToken();
    if (!token) return;
    setFetchingOdds(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/sports/trigger-fetch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setMessage({ type: 'success', text: `Odds fetched: ${data.fetched} events updated, ${data.errors} errors` });
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to fetch odds' });
    } finally {
      setFetchingOdds(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleTriggerSettlement = async () => {
    const token = getToken();
    if (!token) return;
    setSettlingBets(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/sports/trigger-settlement`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setMessage({ type: 'success', text: `Settlement complete: ${data.settled} bets settled` });
      fetchStats();
      fetchBets();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to settle bets' });
    } finally {
      setSettlingBets(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleForceSettle = async () => {
    const token = getToken();
    if (!token || !settleEventId) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/sports/force-settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: settleEventId,
          homeScore: parseInt(settleHomeScore),
          awayScore: parseInt(settleAwayScore),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Force settled: ${data.event} (${data.score}) - ${data.settledBets} bets settled` });
        setShowSettleModal(false);
        fetchStats();
        fetchBets();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to force settle' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to force settle' });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-500/10 text-yellow-400',
      WON: 'bg-green-500/10 text-green-400',
      LOST: 'bg-red-500/10 text-red-400',
      REFUNDED: 'bg-blue-500/10 text-blue-400',
    };
    return <span className={`${styles[status] || 'bg-gray-500/10 text-gray-400'} px-2 py-0.5 rounded text-xs font-medium`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">⚽</span> Sports Betting
          </h1>
          <p className="text-sm text-gray-400 mt-1">Monitor sports bets, odds, and settlements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTriggerFetch}
            disabled={fetchingOdds}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
          >
            {fetchingOdds ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div> Fetching...</>
            ) : (
              <><span>📡</span> Fetch Odds</>
            )}
          </button>
          <button
            onClick={handleTriggerSettlement}
            disabled={settlingBets}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
          >
            {settlingBets ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div> Settling...</>
            ) : (
              <><span>⚖️</span> Settle Bets</>
            )}
          </button>
          <button
            onClick={() => setShowSettleModal(true)}
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
          >
            <span>🔧</span> Force Settle
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-green-500/10 border-green-500/30 text-green-300' 
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Total Bets</p>
            <p className="text-xl font-bold text-white">{stats.totalBets}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Pending</p>
            <p className="text-xl font-bold text-yellow-400">{stats.pendingBets}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Total Staked</p>
            <p className="text-xl font-bold text-white">${stats.totalStaked.toFixed(0)}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Paid Out</p>
            <p className="text-xl font-bold text-green-400">${stats.totalPaidOut.toFixed(0)}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">GGR</p>
            <p className={`text-xl font-bold ${stats.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${stats.ggr.toFixed(0)}
            </p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Events</p>
            <p className="text-xl font-bold text-cyan-400">{stats.totalEvents}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">API Calls</p>
            <p className="text-xl font-bold text-white">
              {stats.apiStatus.apiCallsThisMonth}/{stats.apiStatus.maxMonthlyCallsLimit}
            </p>
          </div>
        </div>
      )}

      {/* API Status */}
      {stats?.apiStatus && (
        <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">API Status</h3>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-400">
              Key: {stats.apiStatus.apiKeyConfigured 
                ? <span className="text-green-400">Configured</span> 
                : <span className="text-red-400">Missing</span>}
            </span>
            <span className="text-gray-400">
              Last Fetch: {stats.apiStatus.lastFetchTime 
                ? <span className="text-white">{new Date(stats.apiStatus.lastFetchTime).toLocaleString()}</span>
                : <span className="text-yellow-400">Never</span>}
            </span>
            <span className="text-gray-400">
              Quota: <span className="text-white">{stats.apiStatus.apiCallsThisMonth}</span>/{stats.apiStatus.maxMonthlyCallsLimit} calls/month
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: '', label: 'All' },
          { key: 'PENDING', label: 'Pending' },
          { key: 'WON', label: 'Won' },
          { key: 'LOST', label: 'Lost' },
          { key: 'REFUNDED', label: 'Refunded' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === f.key
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-[#0A0E17] text-gray-400 border border-gray-700/30 hover:border-gray-600/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bets Table */}
      <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/30">
                <th className="text-left text-gray-400 text-xs font-medium py-3 px-4">User</th>
                <th className="text-left text-gray-400 text-xs font-medium py-3 px-4">Match</th>
                <th className="text-left text-gray-400 text-xs font-medium py-3 px-4">Pick</th>
                <th className="text-right text-gray-400 text-xs font-medium py-3 px-4">Odds</th>
                <th className="text-right text-gray-400 text-xs font-medium py-3 px-4">Stake</th>
                <th className="text-right text-gray-400 text-xs font-medium py-3 px-4">Potential</th>
                <th className="text-center text-gray-400 text-xs font-medium py-3 px-4">Status</th>
                <th className="text-right text-gray-400 text-xs font-medium py-3 px-4">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-400 mx-auto"></div>
                  </td>
                </tr>
              ) : bets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No sports bets found
                  </td>
                </tr>
              ) : (
                bets.map(bet => (
                  <tr key={bet.id} className="border-b border-gray-700/10 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-white text-sm font-medium">{bet.user.username}</p>
                      <p className="text-gray-500 text-xs">{bet.user.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-white text-sm">{bet.event.homeTeam} vs {bet.event.awayTeam}</p>
                      <p className="text-gray-500 text-xs">{bet.event.sportTitle}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-cyan-400 text-sm font-medium">{bet.selectionName}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-white text-sm font-mono">
                      {Number(bet.odds).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-white text-sm font-mono">
                      ${Number(bet.stake).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-400 text-sm font-mono">
                      ${Number(bet.potentialWin).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(bet.status)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400 text-xs">
                      {new Date(bet.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalBets > 50 && (
          <div className="p-4 border-t border-gray-700/30 text-center text-gray-400 text-sm">
            Showing 50 of {totalBets} bets
          </div>
        )}
      </div>

      {/* Force Settle Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#131B2C] rounded-2xl border border-gray-700/50 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🔧</span> Force Settle Event
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Manually set the final score for an event. This will settle all pending bets.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Event ID</label>
                <input
                  type="text"
                  value={settleEventId}
                  onChange={(e) => setSettleEventId(e.target.value)}
                  placeholder="Paste event ID here"
                  className="w-full bg-[#0A0E17] border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Home Score</label>
                  <input
                    type="number"
                    value={settleHomeScore}
                    onChange={(e) => setSettleHomeScore(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full bg-[#0A0E17] border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Away Score</label>
                  <input
                    type="number"
                    value={settleAwayScore}
                    onChange={(e) => setSettleAwayScore(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full bg-[#0A0E17] border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettleModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleForceSettle}
                disabled={!settleEventId || !settleHomeScore || !settleAwayScore}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold transition-all"
              >
                Force Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
