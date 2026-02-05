'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';

// Game states matching backend
export type GameState = 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED';

// Bet status for the current user
export type BetStatus = 'NONE' | 'PLACED' | 'CASHED_OUT' | 'LOST' | 'WON';

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
 * FIXED: Added countdown timer and improved multiplier sync
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
  
  // Countdown timer ref
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // FIXED: Local countdown timer that decrements every second
  useEffect(() => {
    // Clear any existing timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    
    // Only run countdown when waiting and countdown > 0
    if ((gameState === 'WAITING' || gameState === 'STARTING') && countdown > 0) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Clear timer when reaching 0
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [gameState, countdown > 0]); // Only re-run when gameState changes or countdown starts

  // FIXED: Improved smooth multiplier animation with direct updates
  const animateMultiplier = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateTimeRef.current;
    
    // Interpolate towards target multiplier - faster interpolation
    const diff = targetMultiplierRef.current - currentMultiplier;
    const step = diff * Math.min(elapsed / 30, 1); // Faster interpolation (30ms instead of 50ms)
    
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

    // FIXED: Game tick - multiplier update with immediate display update
    const handleTick = (data: { multiplier: number | string; gameId?: string; elapsed?: number }) => {
      // Parse multiplier - could be string or number from backend
      const mult = typeof data.multiplier === 'string' ? parseFloat(data.multiplier) : data.multiplier;
      if (!isNaN(mult)) {
        targetMultiplierRef.current = mult;
        // FIXED: Also update current multiplier directly for immediate display
        setCurrentMultiplier(mult);
      }
      
      if (data.gameId) {
        setGameId(data.gameId);
      }
      
      if (gameState !== 'RUNNING') {
        setGameState('RUNNING');
        setCrashPoint(null);
        setCountdown(0); // Clear countdown when running
      }
      
      // Update potential win if bet is placed
      if (betStatus === 'PLACED' && currentBet && !isNaN(mult)) {
        setPotentialWin(currentBet.betAmount * mult);
      }
    };

    // Game crashed - FIXED: Handle both string and number crashPoint, and gameNumber vs gameId
    const handleCrashed = (data: { crashPoint: number | string; gameId?: string; gameNumber?: number }) => {
      try {
        // Parse crashPoint - backend sends it as string
        const cp = typeof data.crashPoint === 'string' ? parseFloat(data.crashPoint) : data.crashPoint;
        const gid = data.gameId || data.gameNumber?.toString() || '';
        
        console.log('[Crash] Game crashed at:', cp, 'Raw data:', data);
        
        if (isNaN(cp)) {
          console.error('[Crash] Invalid crashPoint:', data.crashPoint);
          return;
        }
        
        // Cancel animation
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        
        setGameState('CRASHED');
        setCrashPoint(cp);
        setCurrentMultiplier(cp);
        targetMultiplierRef.current = cp;
        setCountdown(0);
        
        // Update history
        setRecentCrashes(prev => { if (prev.length > 0 && prev[0] === cp) { return prev; } return [cp, ...prev].slice(0, 10); });
        
        // If player had a bet and didn't cash out, they lost
        if (betStatus === 'PLACED') {
          setBetStatus('LOST');
          setPotentialWin(0);
        }
      } catch (err) {
        console.error('[Crash] Error handling crash event:', err);
      }
    };

    // FIXED: Game starting (countdown) - properly set initial countdown
    const handleStarting = (data: { countdown: number; gameId?: string; gameNumber?: number }) => {
      console.log('[Crash] Game starting in:', data.countdown);
      const gid = data.gameId || data.gameNumber?.toString() || '';
      
      setGameState('WAITING');
      setCountdown(data.countdown); // This will trigger the countdown timer effect
      setGameId(gid);
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
    const handleStarted = (data: { gameId?: string; gameNumber?: number }) => {
      const gid = data.gameId || data.gameNumber?.toString() || '';
      console.log('[Crash] Game started:', gid);
      
      setGameState('RUNNING');
      setCountdown(0);
      lastUpdateTimeRef.current = Date.now();
      
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Start animation loop
      animationRef.current = requestAnimationFrame(animateMultiplier);
    };

    // Bet placed confirmation
    const handleBetPlaced = (data: { success?: boolean; bet?: PlayerBet; error?: string; userId?: string; amount?: string }) => {
      // Handle both confirmation format and broadcast format
      if (data.success !== undefined) {
        if (data.success && data.bet) {
          console.log('[Crash] Bet placed:', data.bet);
          setBetStatus('PLACED');
          setCurrentBet(data.bet);
          setError(null);
        } else if (!data.success) {
          console.error('[Crash] Bet failed:', data.error);
          setError(data.error || 'Failed to place bet');
          setBetStatus('NONE');
          setCurrentBet(null);
        }
      }
      // Broadcast format - just log it
      else if (data.userId && data.amount) {
        console.log('[Crash] Bet broadcast:', data.userId, data.amount);
      }
    };

    // Cashout confirmation
    const handleCashout = (data: { success?: boolean; multiplier?: number | string; profit?: number | string; error?: string; betId?: string }) => {
      // Handle confirmation format
      if (data.success !== undefined) {
        if (data.success) {
          const mult = typeof data.multiplier === 'string' ? parseFloat(data.multiplier) : (data.multiplier || 0);
          const prof = typeof data.profit === 'string' ? parseFloat(data.profit) : (data.profit || 0);
          
          console.log('[Crash] Cashed out at:', mult, 'Profit:', prof);
          setBetStatus('CASHED_OUT');
          setCurrentBet(prev => prev ? { ...prev, cashoutMultiplier: mult, profit: prof } : null);
          setError(null);
        } else {
          console.error('[Crash] Cashout failed:', data.error);
          setError(data.error || 'Failed to cash out');
        }
      }
      // Broadcast format - just log it
      else if (data.betId) {
        console.log('[Crash] Cashout broadcast:', data.betId);
      }
    };

    // FIXED: State change handler - handles WAITING, STARTING, RUNNING, CRASHED states from backend
    const handleStateChange = (data: { state: string; gameNumber?: number; multiplier?: string; crashPoint?: string }) => {
      console.log('[Crash] State change:', data.state, data);
      
      const gameIdStr = data.gameNumber?.toString() || '';
      
      if (data.state === 'WAITING') {
        handleStarting({ countdown: 10, gameId: gameIdStr }); // 10 seconds waiting time
      } else if (data.state === 'STARTING') {
        handleStarting({ countdown: 3, gameId: gameIdStr });
      } else if (data.state === 'RUNNING') {
        handleStarted({ gameId: gameIdStr });
        // Also update multiplier if provided
        if (data.multiplier) {
          const mult = parseFloat(data.multiplier);
          if (!isNaN(mult)) {
            targetMultiplierRef.current = mult;
            setCurrentMultiplier(mult);
          }
        }
      } else if (data.state === 'CRASHED' && data.crashPoint) {
        // Don't call handleCrashed here - it's already called by crash:crashed event
        // This prevents duplicate history entries
        const cp = parseFloat(data.crashPoint);
        if (!isNaN(cp)) {
          setGameState('CRASHED');
          setCrashPoint(cp);
          setCurrentMultiplier(cp);
          targetMultiplierRef.current = cp;
          setCountdown(0);
          // History is updated by crash:crashed event, not here
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
    
    // Listen for balance updates and trigger page refresh of balance
    const handleBalanceUpdate = (data: { change: string; reason: string }) => {
      console.log('[Crash] Balance update received:', data);
      // Dispatch a custom event that AuthContext can listen to
      window.dispatchEvent(new CustomEvent('balance:update', { detail: data }));
    };
    socket.on('balance:update', handleBalanceUpdate);
    
    // Listen for crash history on connect
    const handleHistory = (data: { crashes: number[] }) => {
      console.log('[Crash] History received:', data.crashes.length, 'entries');
      if (data.crashes && data.crashes.length > 0) {
        setRecentCrashes(data.crashes);
      }
    };
    socket.on('crash:history', handleHistory);

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
      socket.off('balance:update', handleBalanceUpdate);
      socket.off('crash:history', handleHistory);
      
      // Cancel animation on cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [socket, gameState, betStatus, currentBet, animateMultiplier]);

  // Start animation when game starts running
  useEffect(() => {
    if (gameState === 'RUNNING' && !animationRef.current) {
      animationRef.current = requestAnimationFrame(animateMultiplier);
    }
    
    return () => {
      // Cleanup animation on unmount
      if (animationRef.current && gameState !== 'RUNNING') {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [gameState, animateMultiplier]);

  // Place bet action
  const placeBet = useCallback((amount: number, autoCashout?: number) => {
    console.log('[Crash] placeBet called with:', { amount, autoCashout, gameState, betStatus, isConnected, hasSocket: !!socket });
    
    if (!socket || !isConnected) {
      console.error('[Crash] Not connected - socket:', !!socket, 'isConnected:', isConnected);
      setError('Not connected to server');
      return;
    }
    
    // Allow betting during WAITING or STARTING phases (before game actually runs)
    if (gameState !== 'WAITING' && gameState !== 'STARTING') {
      console.error('[Crash] Wrong game state:', gameState, '- expected WAITING or STARTING');
      setError('Can only bet before game starts');
      return;
    }
    
    if (betStatus === 'PLACED') {
      console.error('[Crash] Bet already placed:', betStatus);
      setError('Bet already placed');
      return;
    }
    
    console.log('[Crash] ✅ All checks passed, emitting crash:place_bet');
    
    socket.emit('crash:place_bet', {
      amount,
      autoCashout: autoCashout || null,
    });
    
    console.log('[Crash] ✅ Emitted crash:place_bet event');
    
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
