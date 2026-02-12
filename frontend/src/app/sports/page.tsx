'use client';
import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import config from '@/config/api';

const API_URL = config.apiUrl;

interface SportEvent {
  id: string;
  externalId: string;
  sportKey: string;
  sportTitle: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  status: string;
  odds: {
    home: number;
    away: number;
    draw?: number;
  } | null;
}

interface League {
  key: string;
  title: string;
  icon: string;
  events: SportEvent[];
  eventCount: number;
}

interface BetSlipItem {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  selectionName: string;
  odds: number;
  commenceTime: string;
  sportTitle: string;
}

// ============================================
// BET SLIP COMPONENT
// ============================================
function BetSlip({ 
  items, 
  onRemove, 
  onClear, 
  onPlaceBet 
}: { 
  items: BetSlipItem[];
  onRemove: (eventId: string) => void;
  onClear: () => void;
  onPlaceBet: (eventId: string, selection: string, stake: number) => void;
}) {
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [placingBet, setPlacingBet] = useState<string | null>(null);

  const handleStakeChange = (eventId: string, value: string) => {
    setStakes(prev => ({ ...prev, [eventId]: value }));
  };

  const handlePlace = async (item: BetSlipItem) => {
    const stake = parseFloat(stakes[item.eventId] || '0');
    if (stake <= 0) return;
    setPlacingBet(item.eventId);
    await onPlaceBet(item.eventId, item.selection, stake);
    setPlacingBet(null);
  };

  if (items.length === 0) {
    return (
      <div className="bg-[#131B2C] rounded-xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-xl">🎫</span> Bet Slip
        </h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 text-sm">Click on any odds to add to your bet slip</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#131B2C] rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-xl">🎫</span> Bet Slip
          <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full">{items.length}</span>
        </h3>
        <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 transition-colors">
          Clear All
        </button>
      </div>

      <div className="space-y-3">
        {items.map(item => {
          const stake = parseFloat(stakes[item.eventId] || '0');
          const potentialWin = stake > 0 ? (stake * item.odds).toFixed(2) : '0.00';
          const isPlacing = placingBet === item.eventId;

          return (
            <div key={item.eventId} className="bg-[#0A0E17] rounded-lg p-3 border border-gray-700/30">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-400">{item.sportTitle}</p>
                  <p className="text-sm text-white font-medium">{item.homeTeam} vs {item.awayTeam}</p>
                </div>
                <button onClick={() => onRemove(item.eventId)} className="text-gray-500 hover:text-red-400 ml-2">
                  ✕
                </button>
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-cyan-400 text-sm font-semibold">{item.selectionName}</span>
                <span className="bg-cyan-500/20 text-cyan-300 text-sm font-bold px-2 py-0.5 rounded">
                  {item.odds.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    placeholder="Stake"
                    value={stakes[item.eventId] || ''}
                    onChange={(e) => handleStakeChange(item.eventId, e.target.value)}
                    className="w-full bg-[#1a2235] border border-gray-600/50 rounded-lg pl-5 pr-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    min="1"
                    step="1"
                  />
                </div>
                <button
                  onClick={() => handlePlace(item)}
                  disabled={stake <= 0 || isPlacing}
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:cursor-not-allowed"
                >
                  {isPlacing ? '...' : 'Bet'}
                </button>
              </div>

              {stake > 0 && (
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-gray-400">Potential Win:</span>
                  <span className="text-green-400 font-semibold">${potentialWin}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// ODDS BUTTON COMPONENT
// ============================================
function OddsButton({ 
  label, 
  odds, 
  isSelected, 
  onClick 
}: { 
  label: string; 
  odds: number | undefined; 
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!odds) return (
    <div className="flex-1 bg-[#0A0E17] rounded-lg p-2 text-center opacity-50">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm text-gray-600 font-bold">—</div>
    </div>
  );

  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg p-2 text-center transition-all cursor-pointer border ${
        isSelected
          ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
          : 'bg-[#0A0E17] border-transparent hover:bg-[#1a2235] hover:border-gray-600/50'
      }`}
    >
      <div className="text-[10px] text-gray-400 uppercase">{label}</div>
      <div className={`text-sm font-bold ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
        {odds.toFixed(2)}
      </div>
    </button>
  );
}

// ============================================
// EVENT CARD COMPONENT
// ============================================
function EventCard({ 
  event, 
  selectedSelection, 
  onSelectOdd 
}: { 
  event: SportEvent; 
  selectedSelection: string | null;
  onSelectOdd: (event: SportEvent, selection: string, selectionName: string, odds: number) => void;
}) {
  const date = new Date(event.commenceTime);
  const isToday = new Date().toDateString() === date.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === date.toDateString();
  
  let dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (isToday) dateLabel = 'Today';
  if (isTomorrow) dateLabel = 'Tomorrow';
  
  const timeLabel = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4 hover:border-gray-600/50 transition-all">
      {/* Match Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {event.status === 'LIVE' && (
            <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              LIVE
            </span>
          )}
          <span className="text-xs text-gray-400">{event.sportTitle}</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">{dateLabel}</div>
          <div className="text-xs text-cyan-400 font-medium">{timeLabel}</div>
        </div>
      </div>

      {/* Teams */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-white">{event.homeTeam}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{event.awayTeam}</span>
        </div>
      </div>

      {/* Odds */}
      {event.odds ? (
        <div className="flex gap-2">
          <OddsButton
            label="Home"
            odds={event.odds.home}
            isSelected={selectedSelection === 'home'}
            onClick={() => onSelectOdd(event, 'home', event.homeTeam, event.odds!.home)}
          />
          {event.odds.draw !== undefined && (
            <OddsButton
              label="Draw"
              odds={event.odds.draw}
              isSelected={selectedSelection === 'draw'}
              onClick={() => onSelectOdd(event, 'draw', 'Draw', event.odds!.draw!)}
            />
          )}
          <OddsButton
            label="Away"
            odds={event.odds.away}
            isSelected={selectedSelection === 'away'}
            onClick={() => onSelectOdd(event, 'away', event.awayTeam, event.odds!.away)}
          />
        </div>
      ) : (
        <div className="text-center py-2 text-gray-500 text-xs">Odds not available</div>
      )}
    </div>
  );
}

// ============================================
// MAIN SPORTS PAGE
// ============================================
export default function SportsPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLeague, setActiveLeague] = useState<string | null>(null);
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showMobileBetSlip, setShowMobileBetSlip] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const url = activeLeague 
        ? `${API_URL}/api/v1/sports/events?sport=${activeLeague}`
        : `${API_URL}/api/v1/sports/events`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setLeagues(data.leagues || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeLeague]);

  useEffect(() => {
    fetchEvents();
    // Refresh every 5 minutes
    const interval = setInterval(fetchEvents, 300000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const handleSelectOdd = (event: SportEvent, selection: string, selectionName: string, odds: number) => {
    setBetSlip(prev => {
      // If already selected same event+selection, remove it
      const existing = prev.find(b => b.eventId === event.id);
      if (existing && existing.selection === selection) {
        return prev.filter(b => b.eventId !== event.id);
      }
      // If same event different selection, replace
      if (existing) {
        return prev.map(b => b.eventId === event.id ? {
          eventId: event.id,
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          selection,
          selectionName,
          odds,
          commenceTime: event.commenceTime,
          sportTitle: event.sportTitle,
        } : b);
      }
      // Add new
      return [...prev, {
        eventId: event.id,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        selection,
        selectionName,
        odds,
        commenceTime: event.commenceTime,
        sportTitle: event.sportTitle,
      }];
    });
  };

  const handleRemoveBet = (eventId: string) => {
    setBetSlip(prev => prev.filter(b => b.eventId !== eventId));
  };

  const handleClearBetSlip = () => {
    setBetSlip([]);
  };

  const handlePlaceBet = async (eventId: string, selection: string, stake: number) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Please login to place bets');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/sports/bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId, selection, stake, currency: 'USDT' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place bet');

      // Remove from bet slip
      setBetSlip(prev => prev.filter(b => b.eventId !== eventId));
      setSuccessMessage(`Bet placed! Potential win: $${Number(data.bet.potentialWin).toFixed(2)}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 4000);
    }
  };

  const getSelectedSelection = (eventId: string): string | null => {
    const item = betSlip.find(b => b.eventId === eventId);
    return item ? item.selection : null;
  };

  const totalEvents = leagues.reduce((sum, l) => sum + l.eventCount, 0);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">⚽</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Sports Betting</h1>
              <p className="text-sm text-gray-400">{totalEvents} upcoming events across {leagues.filter(l => l.eventCount > 0).length} leagues</p>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
            <span className="text-green-400 text-xl">✅</span>
            <span className="text-green-300 font-medium">{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <span className="text-red-400 text-xl">⚠️</span>
            <span className="text-red-300 font-medium">{error}</span>
          </div>
        )}

        {/* League Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveLeague(null)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              !activeLeague
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-[#131B2C] text-gray-400 border border-gray-700/30 hover:border-gray-600/50'
            }`}
          >
            🏟️ All Sports
          </button>
          {leagues.map(league => (
            <button
              key={league.key}
              onClick={() => setActiveLeague(league.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeLeague === league.key
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-[#131B2C] text-gray-400 border border-gray-700/30 hover:border-gray-600/50'
              }`}
            >
              {league.icon} {league.title}
              <span className="text-xs opacity-60">({league.eventCount})</span>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Events List */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="bg-[#131B2C] rounded-xl border border-gray-700/30 p-4 animate-pulse">
                    <div className="h-4 bg-gray-700/50 rounded w-1/3 mb-3" />
                    <div className="h-4 bg-gray-700/50 rounded w-2/3 mb-2" />
                    <div className="h-4 bg-gray-700/50 rounded w-1/2 mb-3" />
                    <div className="flex gap-2">
                      <div className="flex-1 h-12 bg-gray-700/50 rounded-lg" />
                      <div className="flex-1 h-12 bg-gray-700/50 rounded-lg" />
                      <div className="flex-1 h-12 bg-gray-700/50 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {leagues.filter(l => l.eventCount > 0).map(league => (
                  <div key={league.key}>
                    {/* League Header */}
                    {!activeLeague && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{league.icon}</span>
                        <h2 className="text-lg font-bold text-white">{league.title}</h2>
                        <span className="text-xs text-gray-500 bg-gray-700/30 px-2 py-0.5 rounded-full">
                          {league.eventCount} matches
                        </span>
                      </div>
                    )}

                    {/* Events Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {league.events.map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          selectedSelection={getSelectedSelection(event.id)}
                          onSelectOdd={handleSelectOdd}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {leagues.every(l => l.eventCount === 0) && (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">🏟️</div>
                    <h3 className="text-xl font-bold text-white mb-2">No Events Available</h3>
                    <p className="text-gray-400">Check back soon for upcoming matches</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bet Slip Sidebar (Desktop) */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4">
              <BetSlip
                items={betSlip}
                onRemove={handleRemoveBet}
                onClear={handleClearBetSlip}
                onPlaceBet={handlePlaceBet}
              />
            </div>
          </div>
        </div>

        {/* Mobile Bet Slip Toggle */}
        {betSlip.length > 0 && (
          <div className="lg:hidden fixed bottom-4 right-4 z-50">
            <button
              onClick={() => setShowMobileBetSlip(!showMobileBetSlip)}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold px-5 py-3 rounded-full shadow-lg shadow-cyan-500/30 flex items-center gap-2"
            >
              🎫 Bet Slip
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{betSlip.length}</span>
            </button>
          </div>
        )}

        {/* Mobile Bet Slip Modal */}
        {showMobileBetSlip && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/70 flex items-end">
            <div className="w-full max-h-[80vh] overflow-y-auto bg-[#0A0E17] rounded-t-2xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Bet Slip</h3>
                <button onClick={() => setShowMobileBetSlip(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <BetSlip
                items={betSlip}
                onRemove={handleRemoveBet}
                onClear={handleClearBetSlip}
                onPlaceBet={handlePlaceBet}
              />
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
