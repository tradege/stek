'use client';
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface SportBet {
  id: string;
  selection: string;
  selectionName: string;
  odds: number;
  stake: number;
  potentialWin: number;
  status: string;
  currency: string;
  createdAt: string;
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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: 'Pending' },
  WON: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: 'Won' },
  LOST: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'Lost' },
  REFUNDED: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', label: 'Refunded' },
  VOID: { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', label: 'Void' },
};

export default function MyBetsPage() {
  const [bets, setBets] = useState<SportBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBets = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) { setError('Please login to view your bets'); setLoading(false); return; }
      try {
        const statusParam = activeTab !== 'all' ? `?status=${activeTab.toUpperCase()}` : '';
        const res = await fetch(`${API_URL}/api/v1/sports/my-bets${statusParam}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch bets');
        const data = await res.json();
        setBets(data.bets || data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBets();
  }, [activeTab]);

  const tabs = [
    { key: 'all', label: 'All Bets' },
    { key: 'pending', label: 'Open' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ];

  const totalStaked = bets.reduce((s, b) => s + Number(b.stake), 0);
  const totalWon = bets.filter(b => b.status === 'WON').reduce((s, b) => s + Number(b.potentialWin), 0);
  const pendingCount = bets.filter(b => b.status === 'PENDING').length;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">🎫</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">My Sports Bets</h1>
            <p className="text-sm text-gray-400">{bets.length} bets total</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Total Staked</p>
            <p className="text-lg font-bold text-white">${totalStaked.toFixed(2)}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Total Won</p>
            <p className="text-lg font-bold text-green-400">${totalWon.toFixed(2)}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Pending Bets</p>
            <p className="text-lg font-bold text-yellow-400">{pendingCount}</p>
          </div>
          <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Win Rate</p>
            <p className="text-lg font-bold text-accent-primary">
              {bets.length > 0 ? ((bets.filter(b => b.status === 'WON').length / bets.filter(b => b.status !== 'PENDING').length * 100) || 0).toFixed(0) : 0}%
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setLoading(true); }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                  : 'bg-[#131B2C] text-gray-400 border border-gray-700/30 hover:border-gray-600/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Bets List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4 animate-pulse">
                <div className="h-4 bg-gray-700/50 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-700/50 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-700/50 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : bets.length === 0 ? (
          <div className="text-center py-16 bg-[#131B2C] rounded-xl border border-gray-700/30">
            <div className="text-5xl mb-4">🎫</div>
            <h3 className="text-xl font-bold text-white mb-2">No Bets Found</h3>
            <p className="text-gray-400 mb-4">Place your first sports bet to see it here</p>
            <a href="/sports" className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-primary text-white font-bold rounded-xl hover:from-primary hover:to-primary transition-all">
              Browse Events
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map(bet => {
              const style = STATUS_STYLES[bet.status] || STATUS_STYLES.PENDING;
              const date = new Date(bet.createdAt);
              const matchDate = new Date(bet.event?.commenceTime || bet.createdAt);
              
              return (
                <div key={bet.id} className={`bg-[#131B2C] rounded-xl border p-4 ${style.bg}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-gray-400">{bet.event?.sportTitle || 'Sports'}</p>
                      <p className="text-sm font-semibold text-white">
                        {bet.event?.homeTeam || 'Team A'} vs {bet.event?.awayTeam || 'Team B'}
                      </p>
                      {bet.event?.homeScore !== null && bet.event?.awayScore !== null && (
                        <p className="text-xs text-gray-300 mt-0.5">
                          Score: {bet.event.homeScore} - {bet.event.awayScore}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Pick</p>
                      <p className="text-sm font-semibold text-accent-primary">{bet.selectionName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Odds</p>
                      <p className="text-sm font-semibold text-white">{Number(bet.odds).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Stake</p>
                      <p className="text-sm font-semibold text-white">${Number(bet.stake).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{bet.status === 'WON' ? 'Won' : 'Potential Win'}</p>
                      <p className={`text-sm font-semibold ${bet.status === 'WON' ? 'text-green-400' : 'text-gray-300'}`}>
                        ${Number(bet.potentialWin).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-700/30">
                    <p className="text-xs text-gray-500">
                      Match: {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      Placed: {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
