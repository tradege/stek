'use client';
import React, { useState, useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';

interface Bet {
  id: string;
  oddsId: string;
  oddsNumber: number;
  oddsNumberFormatted: string;
  oddsNumberFormattedShort: string;
  oddsNumberFormattedLong: string;
  userId: string;
  username: string;
  avatar?: string;
  amount: number;
  currency: string;
  cashoutMultiplier?: number;
  profit?: number;
  status: 'ACTIVE' | 'CASHED_OUT' | 'LOST';
  timestamp: Date;
  isNew?: boolean;
}

const LiveBets: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [bets, setBets] = useState<Bet[]>([]);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWagered, setTotalWagered] = useState(0);

  // Listen for bet events
  useEffect(() => {
    if (!socket) return;

    // New bet placed
    const handleNewBet = (data: Bet) => {
      setBets((prev) => {
        const newBet = { ...data, timestamp: new Date(), isNew: true };
        // Remove isNew flag after animation
        setTimeout(() => {
          setBets((current) =>
            current.map((b) => (b.id === newBet.id ? { ...b, isNew: false } : b))
          );
        }, 500);
        return [newBet, ...prev.slice(0, 49)];
      });
      setTotalBets((prev) => prev + 1);
      setTotalWagered((prev) => prev + data.amount);
    };

    // Cashout event
    const handleCashout = (data: { betId: string; multiplier: number; profit: number }) => {
      setBets((prev) =>
        prev.map((bet) =>
          bet.id === data.betId
            ? {
                ...bet,
                status: 'CASHED_OUT',
                cashoutMultiplier: data.multiplier,
                profit: data.profit,
              }
            : bet
        )
      );
    };

    // Round crashed - mark all active bets as lost
    const handleCrashed = () => {
      setBets((prev) =>
        prev.map((bet) =>
          bet.status === 'ACTIVE' ? { ...bet, status: 'LOST' } : bet
        )
      );
    };

    // New round - clear bets
    const handleNewRound = () => {
      setBets([]);
    };

    // Round history/initial bets
    const handleBetsHistory = (data: { bets: Bet[] }) => {
      setBets(data.bets.map((b) => ({ ...b, timestamp: new Date(b.timestamp) })));
    };

    socket.on('crash:bet_placed', handleNewBet);
    socket.on('crash:cashout', handleCashout);
    socket.on('crash:crashed', handleCrashed);
    socket.on('crash:starting', handleNewRound);
    socket.on('crash:bets_history', handleBetsHistory);

    return () => {
      socket.off('crash:bet_placed', handleNewBet);
      socket.off('crash:cashout', handleCashout);
      socket.off('crash:crashed', handleCrashed);
      socket.off('crash:starting', handleNewRound);
      socket.off('crash:bets_history', handleBetsHistory);
    };
  }, [socket]);

  // Format currency
  const formatAmount = (amount: number, currency: string = 'USDT') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  // Get row style based on status
  const getRowStyle = (bet: Bet) => {
    if (bet.isNew) {
      return 'animate-slide-in bg-accent-primary/10';
    }
    if (bet.status === 'CASHED_OUT') {
      return 'bg-green-500/10 border-l-2 border-green-500';
    }
    if (bet.status === 'LOST') {
      return 'bg-red-500/5 opacity-50';
    }
    return 'hover:bg-white/5';
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">Live Bets</h3>
          <span className="px-2 py-0.5 bg-accent-primary/20 text-accent-primary text-xs rounded-full tabular-nums">
            {bets.length}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Total:</span>
            <span className="text-white font-mono tabular-nums">{totalBets}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Wagered:</span>
            <span className="text-accent-primary font-mono tabular-nums">
              ${totalWagered.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <table className="w-full">
          <thead className="sticky top-0 bg-bg-card">
            <tr className="text-left text-xs text-text-secondary border-b border-white/10">
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium text-right">Bet</th>
              <th className="px-4 py-2 font-medium text-right">Multiplier</th>
              <th className="px-4 py-2 font-medium text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {bets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-secondary text-sm">
                  {isConnected ? 'Waiting for bets...' : 'Connecting...'}
                </td>
              </tr>
            ) : (
              bets.map((bet) => (
                <tr
                  key={bet.id}
                  className={`border-b border-white/5 transition-all duration-300 ${getRowStyle(bet)}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-xs font-bold text-black">
                        {bet.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white truncate max-w-[100px]">
                        {bet.username}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-sm font-mono tabular-nums text-white">
                      {formatAmount(bet.amount, bet.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {bet.status === 'CASHED_OUT' && bet.cashoutMultiplier ? (
                      <span className="text-sm font-mono tabular-nums text-green-400">
                        {bet.cashoutMultiplier.toFixed(2)}x
                      </span>
                    ) : bet.status === 'LOST' ? (
                      <span className="text-sm font-mono tabular-nums text-red-400">
                        —
                      </span>
                    ) : (
                      <span className="text-sm font-mono tabular-nums text-text-secondary">
                        ...
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {bet.status === 'CASHED_OUT' && bet.profit !== undefined ? (
                      <span className="text-sm font-mono tabular-nums text-green-400">
                        +{formatAmount(bet.profit, bet.currency)}
                      </span>
                    ) : bet.status === 'LOST' ? (
                      <span className="text-sm font-mono tabular-nums text-red-400">
                        -{formatAmount(bet.amount, bet.currency)}
                      </span>
                    ) : (
                      <span className="text-sm font-mono tabular-nums text-text-secondary">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Stats */}
      {bets.length > 0 && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Won: {bets.filter((b) => b.status === 'CASHED_OUT').length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Lost: {bets.filter((b) => b.status === 'LOST').length}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
            Active: {bets.filter((b) => b.status === 'ACTIVE').length}
          </span>
        </div>
      )}
    </div>
  );
};

export default LiveBets;
