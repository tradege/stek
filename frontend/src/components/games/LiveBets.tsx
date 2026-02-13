'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';

/**
 * LiveBets - Premium Live Bets Display
 * Features:
 * - Smooth slide-in animations for new bets
 * - Flash green animation for winners
 * - Pulse animation for active bets
 * - Confetti effect for big wins
 * - Real-time updates via WebSocket
 */

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
  slot?: number;
  status: 'ACTIVE' | 'CASHED_OUT' | 'LOST';
  timestamp: Date;
  isNew?: boolean;
  isWinFlash?: boolean;
  isBigWin?: boolean;
}

const LiveBets: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [bets, setBets] = useState<Bet[]>([]);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWagered, setTotalWagered] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for bet events
  useEffect(() => {
    if (!socket) {
      return;
    }


    // New bet placed - listen to the broadcast event
    const handleNewBet = (data: any) => {
      
      // Make sure we have the required fields
      if (!data || !data.id) {
        return;
      }

      const newBet: Bet = {
        id: data.id || data.betId || crypto.randomUUID(),
        oddsId: data.oddsId || data.id,
        oddsNumber: data.oddsNumber || 0,
        oddsNumberFormatted: data.oddsNumberFormatted || '0',
        oddsNumberFormattedShort: data.oddsNumberFormattedShort || '0',
        oddsNumberFormattedLong: data.oddsNumberFormattedLong || '0',
        userId: data.userId || '',
        username: data.username || 'Player',
        avatar: data.avatar,
        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : (data.amount || 0),
        currency: data.currency || 'USDT',
        status: 'ACTIVE',
        slot: data.slot || undefined,
        timestamp: new Date(),
        isNew: true,
      };

      setBets((prev) => {
        // Check if bet already exists
        if (prev.some(b => b.id === newBet.id)) {
          return prev;
        }
        
        
        // Remove isNew flag after animation
        setTimeout(() => {
          setBets((current) =>
            current.map((b) => (b.id === newBet.id ? { ...b, isNew: false } : b))
          );
        }, 600);
        
        return [newBet, ...prev.slice(0, 49)];
      });
      
      setTotalBets((prev) => prev + 1);
      setTotalWagered((prev) => prev + newBet.amount);
    };

    // Cashout event
    const handleCashout = (data: { betId: string; oddsId?: string; oddsNumber?: number; oddsNumberFormatted?: string; multiplier: number; profit: number; userId?: string; slot?: number }) => {
      
      setBets((prev) =>
        prev.map((bet) => {
          // Match by betId, oddsId, or userId+slot (slot-aware matching for dual-dragon mode)
          const matchById = bet.id === data.betId || bet.oddsId === data.oddsId;
          const matchByUser = data.userId && bet.userId === data.userId;
          // If both bet and event have slot info, require slot match too
          const slotMatch = (!data.slot || !bet.slot) ? true : (data.slot === bet.slot);
          const isMatch = matchById || (matchByUser && slotMatch);
          
          if (isMatch && bet.status === 'ACTIVE') {
            const isBigWin = data.profit >= 100; // Big win threshold
            
            // Trigger confetti for big wins
            if (isBigWin) {
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 2000);
            }
            
            // Flash animation
            setTimeout(() => {
              setBets((current) =>
                current.map((b) => (b.id === bet.id ? { ...b, isWinFlash: false } : b))
              );
            }, 1000);
            
            return {
              ...bet,
              status: 'CASHED_OUT' as const,
              cashoutMultiplier: data.multiplier,
              profit: data.profit,
              isWinFlash: true,
              isBigWin,
            };
          }
          return bet;
        })
      );
    };

    // Round crashed - mark all active bets as lost
    const handleCrashed = (data: any) => {
      setBets((prev) =>
        prev.map((bet) =>
          bet.status === 'ACTIVE' ? { ...bet, status: 'LOST' as const } : bet
        )
      );
    };

    // New round - clear bets
    const handleNewRound = () => {
      setBets([]);
      setTotalBets(0);
      setTotalWagered(0);
    };

    // Round history/initial bets
    const handleBetsHistory = (data: { bets: Bet[] }) => {
      if (data.bets && Array.isArray(data.bets)) {
        setBets(data.bets.map((b) => ({ ...b, timestamp: new Date(b.timestamp) })));
      }
    };

    socket.on('crash:bet_placed', handleNewBet);
    socket.on('crash:cashout', handleCashout);
    socket.on('crash:crashed', handleCrashed);
    socket.on('crash:starting', handleNewRound);
    socket.on('crash:bets_history', handleBetsHistory);

    // Also listen for state changes to clear on new game
    socket.on('crash:state_change', (data: { state: string }) => {
      if (data.state === 'WAITING') {
        setBets([]);
        setTotalBets(0);
        setTotalWagered(0);
      }
    });

    return () => {
      socket.off('crash:bet_placed', handleNewBet);
      socket.off('crash:cashout', handleCashout);
      socket.off('crash:crashed', handleCrashed);
      socket.off('crash:starting', handleNewRound);
      socket.off('crash:bets_history', handleBetsHistory);
      socket.off('crash:state_change');
    };
  }, [socket]);

  // Format currency
  const formatAmount = (amount: number, currency: string = 'USDT') => {
    return `${Number(amount).toFixed(2)} ${currency}`;
  };

  // Get row style based on status
  const getRowStyle = (bet: Bet) => {
    const baseClasses = 'transition-all duration-300';
    
    if (bet.isNew) {
      return `${baseClasses} animate-slideInFromTop bg-accent-primary/20 border-l-2 border-primary`;
    }
    if (bet.isWinFlash) {
      return `${baseClasses} animate-winFlash bg-green-500/30 border-l-2 border-green-400`;
    }
    if (bet.isBigWin) {
      return `${baseClasses} bg-yellow-500/10 border-l-2 border-yellow-400`;
    }
    if (bet.status === 'CASHED_OUT') {
      return `${baseClasses} bg-green-500/10`;
    }
    if (bet.status === 'LOST') {
      return `${baseClasses} bg-red-500/10 opacity-60`;
    }
    return `${baseClasses} bg-gray-800/50 hover:bg-gray-700/50`;
  };

  // Get avatar gradient based on username
  const getAvatarGradient = (username: string) => {
    const gradients = [
      'from-[#1475e1] to-[#1475e1]',
      'from-primary to-blue-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-red-500',
      'from-yellow-500 to-orange-500',
      'from-[#1475e1] to-[#1475e1]',
    ];
    const index = username.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Live Bets</h3>
          <span className="text-xs text-gray-500">({bets.length})</span>
        </div>
        <div className="text-xs text-gray-400">
          Total: <span className="text-accent-primary font-mono">{formatAmount(totalWagered)}</span>
        </div>
      </div>

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                width: '10px',
                height: '10px',
                backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'][i % 4],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Bets table */}
      <div ref={containerRef} className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
            <tr className="text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium text-right">Bet</th>
              <th className="px-4 py-2 font-medium text-right">Multiplier</th>
              <th className="px-4 py-2 font-medium text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {bets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-gray-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isConnected ? 'Waiting for bets...' : 'Connecting...'}
                  </div>
                </td>
              </tr>
            ) : (
              bets.map((bet, index) => (
                <tr
                  key={bet.id}
                  className={`border-b border-gray-800/50 ${getRowStyle(bet)}`}
                  style={{
                    animationDelay: bet.isNew ? `${index * 50}ms` : '0ms',
                  }}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarGradient(bet.username)} flex items-center justify-center text-xs font-bold text-white shadow-lg`}>
                        {bet.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-white truncate max-w-[100px]">
                        {bet.username}
                      </span>
                      {bet.isBigWin && (
                        <span className="text-yellow-400 animate-bounce">🏆</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="text-sm font-mono tabular-nums text-white">
                      {formatAmount(bet.amount, bet.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {bet.status === 'CASHED_OUT' && bet.cashoutMultiplier ? (
                      <span className={`text-sm font-mono tabular-nums ${bet.isBigWin ? 'text-yellow-400 font-bold' : 'text-green-400'}`}>
                        {Number(bet.cashoutMultiplier).toFixed(2)}x
                      </span>
                    ) : bet.status === 'LOST' ? (
                      <span className="text-sm font-mono tabular-nums text-red-400">
                        💥
                      </span>
                    ) : (
                      <span className="text-sm font-mono tabular-nums text-gray-400 animate-pulse">
                        ...
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {bet.status === 'CASHED_OUT' && bet.profit !== undefined ? (
                      <span className={`text-sm font-mono tabular-nums ${bet.isBigWin ? 'text-yellow-400 font-bold' : 'text-green-400'}`}>
                        +{formatAmount(bet.profit, bet.currency)}
                      </span>
                    ) : bet.status === 'LOST' ? (
                      <span className="text-sm font-mono tabular-nums text-red-400">
                        -{formatAmount(bet.amount, bet.currency)}
                      </span>
                    ) : (
                      <span className="text-sm font-mono tabular-nums text-gray-400">
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

      {/* Custom animations styles */}
      <style jsx>{`
        @keyframes slideInFromTop {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes winFlash {
          0%, 100% {
            background-color: rgba(34, 197, 94, 0.1);
          }
          50% {
            background-color: rgba(34, 197, 94, 0.4);
          }
        }
        
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
        
        .animate-slideInFromTop {
          animation: slideInFromTop 0.4s ease-out forwards;
        }
        
        .animate-winFlash {
          animation: winFlash 0.5s ease-in-out 3;
        }
        
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LiveBets;
