'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';

// Game states matching backend
export type GameState = 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED';

// Bet status for the current user
export type BetStatus = 'NONE' | 'PLACED' | 'CASHED_OUT' | 'LOST';

interface GameRound {
  gameId: string;
  startTime: number;
  crashPoint?: number;
}

interface PlayerBet {
  oddsId: string;
  oddsName: string;
  betAmount: number;
  cashoutMultiplier?: number;
  profit?: number;
}

interface CrashGameState {
  // Game state
  gameState: GameState;
  currentMultiplier: number;
  crashPoint: number | null;
  countdown: number;
  gameId: string | null;
  
  // Player state
  betStatus: BetStatus;
  currentBet: PlayerBet | null;
  potentialWin: number;
  
  // History
  recentCrashes: number[];
  
  // Actions
  placeBet: (amount: number, autoCashout?: number) => void;
  cashOut: () => void;
  
  // Connection status
  isConnected: boolean;
  error: string | null;
}

/**
 * useCrashGame - The main hook for Crash game logic
 * Handles all socket events and game state management
 */
export const useCrashGame = (): CrashGameState => {
  const { socket, isConnected } = useSocket();
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  
  // Player state
  const [betStatus, setBetStatus] = useState<BetStatus>('NONE');
  const [currentBet, setCurrentBet] = useState<PlayerBet | null>(null);
  const [potentialWin, setPotentialWin] = useState(0);
  
  // History
  const [recentCrashes, setRecentCrashes] = useState<number[]>([2.45, 1.23, 5.67, 1.00, 3.21]);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Animation frame ref for smooth multiplier updates
  const animationRef = useRef<number | null>(null);
  const targetMultiplierRef = useRef(1.00);
  const lastUpdateTimeRef = useRef(Date.now());

  // Smooth multiplier animation
  const animateMultiplier = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateTimeRef.current;
    
    // Interpolate towards target multiplier
    const diff = targetMultiplierRef.current - currentMultiplier;
    const step = diff * Math.min(elapsed / 50, 1); // Smooth interpolation
    
    if (Math.abs(diff) > 0.001) {
      setCurrentMultiplier(prev => {
        const newValue = prev + step;
        return Math.round(newValue * 100) / 100;
      });
    }
    
    lastUpdateTimeRef.current = now;
    
    if (gameState === 'RUNNING') {
      animationRef.current = requestAnimationFrame(animateMultiplier);
    }
  }, [gameState, currentMultiplier]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Game tick - multiplier update
    const handleTick = (data: { multiplier: number; gameId: string }) => {
      targetMultiplierRef.current = data.multiplier;
      setGameId(data.gameId);
      
      if (gameState !== 'RUNNING') {
        setGameState('RUNNING');
        setCrashPoint(null);
      }
      
      // Update potential win if bet is placed
      if (betStatus === 'PLACED' && currentBet) {
        setPotentialWin(currentBet.betAmount * data.multiplier);
      }
    };

    // Game crashed
    const handleCrashed = (data: { crashPoint: number; gameId: string }) => {
      console.log('[Crash] Game crashed at:', data.crashPoint);
      
      // Cancel animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      setGameState('CRASHED');
      setCrashPoint(data.crashPoint);
      setCurrentMultiplier(data.crashPoint);
      targetMultiplierRef.current = data.crashPoint;
      
      // Update history
      setRecentCrashes(prev => [data.crashPoint, ...prev.slice(0, 9)]);
      
      // If player had a bet and didn't cash out, they lost
      if (betStatus === 'PLACED') {
        setBetStatus('LOST');
        setPotentialWin(0);
      }
    };

    // Game starting (countdown)
    const handleStarting = (data: { countdown: number; gameId: string }) => {
      console.log('[Crash] Game starting in:', data.countdown);
      setGameState('WAITING');
      setCountdown(data.countdown);
      setGameId(data.gameId);
      setCurrentMultiplier(1.00);
      targetMultiplierRef.current = 1.00;
      setCrashPoint(null);
      
      // Reset bet status for new round
      if (betStatus === 'CASHED_OUT' || betStatus === 'LOST') {
        setBetStatus('NONE');
        setCurrentBet(null);
        setPotentialWin(0);
      }
    };

    // Game started
    const handleStarted = (data: { gameId: string }) => {
      console.log('[Crash] Game started:', data.gameId);
      setGameState('RUNNING');
      setCountdown(0);
      lastUpdateTimeRef.current = Date.now();
      
      // Start animation loop
      animationRef.current = requestAnimationFrame(animateMultiplier);
    };

    // Bet placed confirmation
    const handleBetPlaced = (data: { success: boolean; bet: PlayerBet; error?: string }) => {
      if (data.success) {
        console.log('[Crash] Bet placed:', data.bet);
        setBetStatus('PLACED');
        setCurrentBet(data.bet);
        setError(null);
      } else {
        console.error('[Crash] Bet failed:', data.error);
        setError(data.error || 'Failed to place bet');
      }
    };

    // Cashout confirmation
    const handleCashout = (data: { success: boolean; multiplier: number; profit: number; error?: string }) => {
      if (data.success) {
        console.log('[Crash] Cashed out at:', data.multiplier, 'Profit:', data.profit);
        setBetStatus('CASHED_OUT');
        setCurrentBet(prev => prev ? { ...prev, cashoutMultiplier: data.multiplier, profit: data.profit } : null);
        setError(null);
      } else {
        console.error('[Crash] Cashout failed:', data.error);
        setError(data.error || 'Failed to cash out');
      }
    };

    // State change handler - handles WAITING, STARTING, RUNNING states from backend
    const handleStateChange = (data: { state: string; gameNumber?: number; multiplier?: string; crashPoint?: string }) => {
      console.log('[Crash] State change:', data.state, data);
      
      const gameIdStr = data.gameNumber?.toString() || '';
      
      if (data.state === 'WAITING') {
        handleStarting({ countdown: 5, gameId: gameIdStr });
      } else if (data.state === 'STARTING') {
        handleStarting({ countdown: 3, gameId: gameIdStr });
      } else if (data.state === 'RUNNING') {
        handleStarted({ gameId: gameIdStr });
        // Also update multiplier if provided
        if (data.multiplier) {
          const mult = parseFloat(data.multiplier);
          if (!isNaN(mult)) {
            targetMultiplierRef.current = mult;
          }
        }
      } else if (data.state === 'CRASHED' && data.crashPoint) {
        const cp = parseFloat(data.crashPoint);
        if (!isNaN(cp)) {
          handleCrashed({ crashPoint: cp, gameId: gameIdStr });
        }
      }
    };

    // Subscribe to events
    socket.on('crash:tick', handleTick);
    socket.on('crash:crashed', handleCrashed);
    socket.on('crash:state_change', handleStateChange);
    socket.on('crash:starting', handleStarting);
    socket.on('crash:started', handleStarted);
    socket.on('crash:bet_placed', handleBetPlaced);
    socket.on('crash:cashout', handleCashout);

    // Request current game state
    socket.emit('crash:get_state');

    return () => {
      // Cleanup
      socket.off('crash:tick', handleTick);
      socket.off('crash:crashed', handleCrashed);
      socket.off('crash:state_change', handleStateChange);
      socket.off('crash:starting', handleStarting);
      socket.off('crash:started', handleStarted);
      socket.off('crash:bet_placed', handleBetPlaced);
      socket.off('crash:cashout', handleCashout);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [socket, gameState, betStatus, currentBet, animateMultiplier]);

  // Start animation when game starts running
  useEffect(() => {
    if (gameState === 'RUNNING' && !animationRef.current) {
      animationRef.current = requestAnimationFrame(animateMultiplier);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [gameState, animateMultiplier]);

  // Place bet action
  const placeBet = useCallback((amount: number, autoCashout?: number) => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    
    if (gameState !== 'WAITING') {
      setError('Can only bet during waiting phase');
      return;
    }
    
    if (betStatus === 'PLACED') {
      setError('Bet already placed');
      return;
    }
    
    console.log('[Crash] Placing bet:', amount, 'Auto cashout:', autoCashout);
    
    socket.emit('crash:place_bet', {
      amount,
      autoCashout: autoCashout || null,
    });
    
    // Optimistic update
    setBetStatus('PLACED');
    setCurrentBet({
      oddsId: 'pending',
      oddsName: 'Crash',
      betAmount: amount,
    });
  }, [socket, isConnected, gameState, betStatus]);

  // Cash out action
  const cashOut = useCallback(() => {
    if (!socket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    
    if (gameState !== 'RUNNING') {
      setError('Can only cash out during running phase');
      return;
    }
    
    if (betStatus !== 'PLACED') {
      setError('No active bet to cash out');
      return;
    }
    
    console.log('[Crash] Cashing out at:', currentMultiplier);
    
    socket.emit('crash:cashout', {
      gameId,
    });
  }, [socket, isConnected, gameState, betStatus, currentMultiplier, gameId]);

  return {
    // Game state
    gameState,
    currentMultiplier,
    crashPoint,
    countdown,
    gameId,
    
    // Player state
    betStatus,
    currentBet,
    potentialWin,
    
    // History
    recentCrashes,
    
    // Actions
    placeBet,
    cashOut,
    
    // Connection
    isConnected,
    error,
  };
};

export default useCrashGame;
