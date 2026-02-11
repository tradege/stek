'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

// Game states matching backend
export type GameState = 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED';

// Bet status for the current user
export type BetStatus = 'NONE' | 'PLACED' | 'CASHED_OUT' | 'LOST' | 'WON';

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
  currentMultiplier: number;   // Dragon 1 multiplier (for backward compat)
  currentMultiplier2: number;  // Dragon 2 multiplier
  crashPoint: number | null;   // Dragon 1 crash point (revealed after crash)
  crashPoint2: number | null;  // Dragon 2 crash point
  dragon1Crashed: boolean;     // Has dragon 1 crashed this round?
  dragon2Crashed: boolean;     // Has dragon 2 crashed this round?
  countdown: number;
  gameId: string | null;
  
  // Player state (Dragon 1)
  betStatus: BetStatus;
  currentBet: PlayerBet | null;
  potentialWin: number;
  
  // Player state (Dragon 2)
  betStatus2: BetStatus;
  currentBet2: PlayerBet | null;
  potentialWin2: number;
  
  // History
  recentCrashes: number[];
  
  // Actions
  placeBet: (amount: number, autoCashout?: number) => void;
  cashOut: () => void;
  placeBet2: (amount: number, autoCashout?: number) => void;
  cashOut2: () => void;
  
  // Connection status
  isConnected: boolean;
  error: string | null;
}

/**
 * useCrashGame — Dual-Dragon mode
 * Each dragon has its own multiplier and crash point.
 * Dragon 1 can crash while Dragon 2 keeps flying, and vice versa.
 */
export const useCrashGame = (): CrashGameState => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const currentUserId = user?.id;
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [currentMultiplier2, setCurrentMultiplier2] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [crashPoint2, setCrashPoint2] = useState<number | null>(null);
  const [dragon1Crashed, setDragon1Crashed] = useState(false);
  const [dragon2Crashed, setDragon2Crashed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  
  // Player state (Dragon 1)
  const [betStatus, setBetStatus] = useState<BetStatus>('NONE');
  const [currentBet, setCurrentBet] = useState<PlayerBet | null>(null);
  const [potentialWin, setPotentialWin] = useState(0);
  
  // Player state (Dragon 2)
  const [betStatus2, setBetStatus2] = useState<BetStatus>('NONE');
  const [currentBet2, setCurrentBet2] = useState<PlayerBet | null>(null);
  const [potentialWin2, setPotentialWin2] = useState(0);
  
  // History
  const [recentCrashes, setRecentCrashes] = useState<number[]>([]);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Countdown timer ref
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for stale closure prevention
  const betStatusRef = useRef<BetStatus>('NONE');
  const betStatus2Ref = useRef<BetStatus>('NONE');
  const currentBetRef = useRef<PlayerBet | null>(null);
  const currentBet2Ref = useRef<PlayerBet | null>(null);
  const gameStateRef = useRef<GameState>('WAITING');
  const gameIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { betStatusRef.current = betStatus; }, [betStatus]);
  useEffect(() => { betStatus2Ref.current = betStatus2; }, [betStatus2]);
  useEffect(() => { currentBetRef.current = currentBet; }, [currentBet]);
  useEffect(() => { currentBet2Ref.current = currentBet2; }, [currentBet2]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { gameIdRef.current = gameId; }, [gameId]);

  // Countdown timer
  useEffect(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if ((gameState === 'WAITING' || gameState === 'STARTING') && countdown > 0) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
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
  }, [gameState, countdown > 0]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Tick — now receives multiplier1 and multiplier2
    const handleTick = (data: { multiplier1?: string; multiplier2?: string; multiplier?: string; dragon1Crashed?: boolean; dragon2Crashed?: boolean; elapsed?: number }) => {
      // Support dual-dragon format
      if (data.multiplier1 !== undefined) {
        const m1 = parseFloat(data.multiplier1);
        const m2 = parseFloat(data.multiplier2 || data.multiplier1);
        if (!isNaN(m1)) setCurrentMultiplier(m1);
        if (!isNaN(m2)) setCurrentMultiplier2(m2);
        
        if (data.dragon1Crashed !== undefined) setDragon1Crashed(data.dragon1Crashed);
        if (data.dragon2Crashed !== undefined) setDragon2Crashed(data.dragon2Crashed);
      }
      // Fallback: old single-multiplier format
      else if (data.multiplier !== undefined) {
        const m = typeof data.multiplier === 'string' ? parseFloat(data.multiplier) : data.multiplier;
        if (!isNaN(m)) {
          setCurrentMultiplier(m);
          setCurrentMultiplier2(m);
        }
      }
      
      if (gameStateRef.current !== 'RUNNING') {
        setGameState('RUNNING');
        setCrashPoint(null);
        setCrashPoint2(null);
        setCountdown(0);
      }
      
      // Update potential wins
      if (betStatusRef.current === 'PLACED' && currentBetRef.current) {
        const m1 = parseFloat(data.multiplier1 || data.multiplier || '1');
        if (!isNaN(m1)) setPotentialWin(currentBetRef.current.betAmount * m1);
      }
      if (betStatus2Ref.current === 'PLACED' && currentBet2Ref.current) {
        const m2 = parseFloat(data.multiplier2 || data.multiplier1 || data.multiplier || '1');
        if (!isNaN(m2)) setPotentialWin2(currentBet2Ref.current.betAmount * m2);
      }
    };

    // Individual dragon crash — one dragon falls, other keeps flying
    const handleDragonCrashed = (data: { dragon: number; crashPoint: string; gameNumber?: number }) => {
      const cp = parseFloat(data.crashPoint);
      if (isNaN(cp)) return;
      
      console.log(`[Crash] Dragon ${data.dragon} crashed at ${cp}x`);
      
      if (data.dragon === 1) {
        setDragon1Crashed(true);
        setCrashPoint(cp);
        setCurrentMultiplier(cp);
        // Mark Dragon 1 bets as lost
        if (betStatusRef.current === 'PLACED') {
          setBetStatus('LOST');
          setPotentialWin(0);
        }
      } else if (data.dragon === 2) {
        setDragon2Crashed(true);
        setCrashPoint2(cp);
        setCurrentMultiplier2(cp);
        // Mark Dragon 2 bets as lost
        if (betStatus2Ref.current === 'PLACED') {
          setBetStatus2('LOST');
          setPotentialWin2(0);
        }
      }
    };

    // Full crash — both dragons down, round over
    const handleCrashed = (data: { crashPoint1?: string; crashPoint2?: string; crashPoint?: string; gameNumber?: number }) => {
      try {
        // Dual-dragon format
        if (data.crashPoint1 !== undefined) {
          const cp1 = parseFloat(data.crashPoint1);
          const cp2 = parseFloat(data.crashPoint2 || data.crashPoint1);
          
          setGameState('CRASHED');
          setCrashPoint(cp1);
          setCrashPoint2(cp2);
          setCurrentMultiplier(cp1);
          setCurrentMultiplier2(cp2);
          setDragon1Crashed(true);
          setDragon2Crashed(true);
          setCountdown(0);
          
          // Add max crash to history
          const maxCp = Math.max(cp1, cp2);
          setRecentCrashes(prev => {
            if (prev.length > 0 && prev[0] === maxCp) return prev;
            return [maxCp, ...prev].slice(0, 10);
          });
        }
        // Old single-multiplier format
        else if (data.crashPoint !== undefined) {
          const cp = typeof data.crashPoint === 'string' ? parseFloat(data.crashPoint) : data.crashPoint;
          if (isNaN(cp)) return;
          
          setGameState('CRASHED');
          setCrashPoint(cp);
          setCrashPoint2(cp);
          setCurrentMultiplier(cp);
          setCurrentMultiplier2(cp);
          setDragon1Crashed(true);
          setDragon2Crashed(true);
          setCountdown(0);
          
          setRecentCrashes(prev => {
            if (prev.length > 0 && prev[0] === cp) return prev;
            return [cp, ...prev].slice(0, 10);
          });
        }
        
        // Mark remaining active bets as lost
        if (betStatusRef.current === 'PLACED') {
          setBetStatus('LOST');
          setPotentialWin(0);
        }
        if (betStatus2Ref.current === 'PLACED') {
          setBetStatus2('LOST');
          setPotentialWin2(0);
        }
      } catch (err) {
        console.error('[Crash] Error handling crash event:', err);
      }
    };

    // State change — new round starting
    const handleStateChange = (data: { state: string; gameNumber?: number; multiplier1?: string; multiplier2?: string; multiplier?: string; dragon1Crashed?: boolean; dragon2Crashed?: boolean; crashPoint1?: string; crashPoint2?: string }) => {
      const gameIdStr = data.gameNumber?.toString() || '';
      
      if (data.state === 'WAITING') {
        setGameState('WAITING');
        setCountdown(10);
        setGameId(gameIdStr);
        setCurrentMultiplier(1.00);
        setCurrentMultiplier2(1.00);
        setCrashPoint(null);
        setCrashPoint2(null);
        setDragon1Crashed(false);
        setDragon2Crashed(false);
        
        // Reset bet statuses for new round
        if (betStatusRef.current === 'CASHED_OUT' || betStatusRef.current === 'LOST' || betStatusRef.current === 'WON') {
          setBetStatus('NONE');
          setCurrentBet(null);
          setPotentialWin(0);
        }
        if (betStatus2Ref.current === 'CASHED_OUT' || betStatus2Ref.current === 'LOST' || betStatus2Ref.current === 'WON') {
          setBetStatus2('NONE');
          setCurrentBet2(null);
          setPotentialWin2(0);
        }
      } else if (data.state === 'RUNNING') {
        setGameState('RUNNING');
        setCountdown(0);
        if (data.multiplier1) {
          const m1 = parseFloat(data.multiplier1);
          if (!isNaN(m1)) setCurrentMultiplier(m1);
        }
        if (data.multiplier2) {
          const m2 = parseFloat(data.multiplier2);
          if (!isNaN(m2)) setCurrentMultiplier2(m2);
        }
        if (data.dragon1Crashed !== undefined) setDragon1Crashed(data.dragon1Crashed);
        if (data.dragon2Crashed !== undefined) setDragon2Crashed(data.dragon2Crashed);
      } else if (data.state === 'CRASHED') {
        const cp1 = data.crashPoint1 ? parseFloat(data.crashPoint1) : null;
        const cp2 = data.crashPoint2 ? parseFloat(data.crashPoint2) : null;
        setGameState('CRASHED');
        if (cp1 !== null) { setCrashPoint(cp1); setCurrentMultiplier(cp1); }
        if (cp2 !== null) { setCrashPoint2(cp2); setCurrentMultiplier2(cp2); }
        setDragon1Crashed(true);
        setDragon2Crashed(true);
        setCountdown(0);
      }
    };

    // Bet placed confirmation
    const handleBetPlaced = (data: { success?: boolean; oddsId?: string; oddsName?: string; amount?: number; error?: string; slot?: number; userId?: string }) => {
      if (data.success !== undefined) {
        const betSlot = (data.slot === 1 || data.slot === 2) ? data.slot : null;
      if (betSlot === null) {
        console.warn('[Crash] Ignoring bet event with invalid slot:', data);
        return;
      }
        if (data.success) {
          if (betSlot === 2) {
            setBetStatus2('PLACED');
            if (data.oddsId) {
              setCurrentBet2({
                oddsId: data.oddsId,
                oddsName: data.oddsName || 'Crash Dragon 2',
                betAmount: data.amount || 0,
              });
            }
          } else {
            setBetStatus('PLACED');
            if (data.oddsId) {
              setCurrentBet({
                oddsId: data.oddsId,
                oddsName: data.oddsName || 'Crash',
                betAmount: data.amount || 0,
              });
            }
          }
          setError(null);
        } else {
          if (data.slot === 2) {
            if (betStatus2Ref.current === 'PLACED') {
              setBetStatus2('NONE');
              setCurrentBet2(null);
            }
          } else {
            if (betStatusRef.current === 'PLACED') {
              setBetStatus('NONE');
              setCurrentBet(null);
            }
          }
          setError(data.error || 'Failed to place bet');
        }
      }
    };

    // Cashout confirmation
    const handleCashout = (data: { success?: boolean; multiplier?: number | string; profit?: number | string; error?: string; betId?: string; slot?: number; userId?: string }) => {
      try {
        console.log('[Crash DEBUG] handleCashout received:', JSON.stringify(data), 'currentUserId:', currentUserId, 'betStatus1:', betStatusRef.current, 'betStatus2:', betStatus2Ref.current);
        if (data.success !== undefined) {
          // Filter: ignore events not meant for us
          if (data.userId && currentUserId && data.userId !== currentUserId) return;
          const cashoutSlot = (data.slot === 1 || data.slot === 2) ? data.slot : null;
          if (cashoutSlot === null) {
            console.warn('[Crash] Ignoring cashout event with invalid slot:', data);
            return;
          }
          if (data.success) {
            const mult = typeof data.multiplier === 'string' ? parseFloat(data.multiplier) : (data.multiplier || 0);
            const prof = typeof data.profit === 'string' ? parseFloat(data.profit) : (data.profit || 0);
            
            if (cashoutSlot === 2) {
              setBetStatus2('CASHED_OUT');
              setCurrentBet2(prev => prev ? { ...prev, cashoutMultiplier: mult, profit: prof } : null);
            } else {
              setBetStatus('CASHED_OUT');
              setCurrentBet(prev => prev ? { ...prev, cashoutMultiplier: mult, profit: prof } : null);
            }
            setError(null);
          } else {
            setError(data.error || 'Failed to cash out');
          }
        }
      } catch (err) {
        console.error('[Crash] Error in handleCashout:', err);
      }
    };

    // Subscribe to events
    socket.on('crash:tick', handleTick);
    socket.on('crash:crashed', handleCrashed);
    socket.on('crash:dragon_crashed', handleDragonCrashed);
    socket.on('crash:state_change', handleStateChange);
    socket.on('crash:bet_placed', handleBetPlaced);
    socket.on('crash:cashout', handleCashout);
    
    const handleBalanceUpdate = (data: { change: string; reason: string }) => {
      window.dispatchEvent(new CustomEvent('balance:update', { detail: data }));
    };
    socket.on('balance:update', handleBalanceUpdate);
    
    const handleHistory = (data: { crashes: number[] }) => {
      if (data.crashes && data.crashes.length > 0) {
        setRecentCrashes(data.crashes);
      }
    };
    socket.on('crash:history', handleHistory);

    socket.emit('crash:get_state');

    return () => {
      socket.off('crash:tick', handleTick);
      socket.off('crash:crashed', handleCrashed);
      socket.off('crash:dragon_crashed', handleDragonCrashed);
      socket.off('crash:state_change', handleStateChange);
      socket.off('crash:bet_placed', handleBetPlaced);
      socket.off('crash:cashout', handleCashout);
      socket.off('balance:update', handleBalanceUpdate);
      socket.off('crash:history', handleHistory);
    };
  }, [socket]);

  // Place bet (Dragon 1)
  const placeBet = useCallback((amount: number, autoCashout?: number) => {
    console.log('[DEBUG placeBet] socket:', !!socket, 'isConnected:', isConnected, 'gameState:', gameStateRef.current, 'betStatus:', betStatusRef.current);
    if (!socket || !isConnected) { console.log('[DEBUG placeBet] BLOCKED: not connected'); setError('Not connected to server'); return; }
    if (gameStateRef.current !== 'WAITING' && gameStateRef.current !== 'STARTING') { console.log('[DEBUG placeBet] BLOCKED: wrong state', gameStateRef.current); setError('Can only bet before game starts'); return; }
    if (betStatusRef.current === 'PLACED') { console.log('[DEBUG placeBet] BLOCKED: already placed'); setError('Bet already placed'); return; }
    
    console.log('[DEBUG placeBet] EMITTING crash:place_bet slot=1 amount=', amount);
    socket.emit('crash:place_bet', { amount, autoCashout: autoCashout || null, slot: 1 });
    setBetStatus('PLACED');
    setCurrentBet({ oddsId: 'pending', oddsName: 'Crash', betAmount: amount });
  }, [socket, isConnected]);

  // Place bet (Dragon 2)
  const placeBet2 = useCallback((amount: number, autoCashout?: number) => {
    if (!socket || !isConnected) { setError('Not connected to server'); return; }
    if (gameStateRef.current !== 'WAITING' && gameStateRef.current !== 'STARTING') { setError('Can only bet before game starts'); return; }
    if (betStatus2Ref.current === 'PLACED') { setError('Dragon 2 bet already placed'); return; }
    
    socket.emit('crash:place_bet', { amount, autoCashout: autoCashout || null, slot: 2 });
    setBetStatus2('PLACED');
    setCurrentBet2({ oddsId: 'pending-slot2', oddsName: 'Crash Dragon 2', betAmount: amount });
  }, [socket, isConnected]);

  // Cashout lock refs to prevent double-fire
  const cashout1LockRef = useRef(false);
  const cashout2LockRef = useRef(false);
  
  // Cash out (Dragon 1)
  const cashOut = useCallback(() => {
    console.log('[DEBUG cashOut1] socket:', !!socket, 'isConnected:', isConnected, 'gameState:', gameStateRef.current, 'betStatus:', betStatusRef.current);
    if (!socket || !isConnected) { console.log('[DEBUG cashOut1] BLOCKED: not connected'); setError('Not connected to server'); return; }
    if (gameStateRef.current !== 'RUNNING') { console.log('[DEBUG cashOut1] BLOCKED: wrong state'); setError('Can only cash out during running phase'); return; }
    if (betStatusRef.current !== 'PLACED') { console.log('[DEBUG cashOut1] BLOCKED: no active bet'); setError('No active bet to cash out'); return; }
    
    // Prevent double-fire
    if (cashout1LockRef.current) { console.log("[DEBUG cashOut1] LOCKED - ignoring duplicate"); return; }
    cashout1LockRef.current = true;
    setTimeout(() => { cashout1LockRef.current = false; }, 3000);
    console.log('[DEBUG cashOut1] EMITTING crash:cashout slot=1');
    socket.emit('crash:cashout', { gameId: gameIdRef.current, slot: 1 });
  }, [socket, isConnected]);

  // Cash out (Dragon 2)
  const cashOut2 = useCallback(() => {
    console.log('[DEBUG cashOut2] socket:', !!socket, 'isConnected:', isConnected, 'gameState:', gameStateRef.current, 'betStatus2:', betStatus2Ref.current);
    if (!socket || !isConnected) { console.log('[DEBUG cashOut2] BLOCKED: not connected'); setError('Not connected to server'); return; }
    if (gameStateRef.current !== 'RUNNING') { console.log('[DEBUG cashOut2] BLOCKED: wrong state'); setError('Can only cash out during running phase'); return; }
    if (betStatus2Ref.current !== 'PLACED') { console.log('[DEBUG cashOut2] BLOCKED: no active bet'); setError('No active Dragon 2 bet to cash out'); return; }
    
    // Prevent double-fire
    if (cashout2LockRef.current) { console.log("[DEBUG cashOut2] LOCKED - ignoring duplicate"); return; }
    cashout2LockRef.current = true;
    setTimeout(() => { cashout2LockRef.current = false; }, 3000);
    console.log('[DEBUG cashOut2] EMITTING crash:cashout slot=2');
    socket.emit('crash:cashout', { gameId: gameIdRef.current, slot: 2 });
  }, [socket, isConnected]);

  return {
    gameState,
    currentMultiplier,
    currentMultiplier2,
    crashPoint,
    crashPoint2,
    dragon1Crashed,
    dragon2Crashed,
    countdown,
    gameId,
    betStatus,
    currentBet,
    potentialWin,
    betStatus2,
    currentBet2,
    potentialWin2,
    recentCrashes,
    placeBet,
    cashOut,
    placeBet2,
    cashOut2,
    isConnected,
    error,
  };
};

export default useCrashGame;
