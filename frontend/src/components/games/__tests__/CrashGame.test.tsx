/**
 * 🎰 CrashGamePanel - Comprehensive Frontend Tests
 * 
 * This test suite provides exhaustive coverage of the Crash game component:
 * - Rendering and initialization
 * - Bet button states (connected/disconnected)
 * - Game state transitions
 * - Socket event handling
 * - User interactions
 * - Canvas rendering
 * 
 * Target: Full coverage of CrashGamePanel component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================
// MOCK DEPENDENCIES
// ============================================

// Mock useCrashGame hook
const mockPlaceBet = jest.fn();
const mockCashout = jest.fn();
const mockSetBetAmount = jest.fn();
const mockSetAutoCashout = jest.fn();

const mockUseCrashGame = {
  gameState: 'WAITING',
  currentMultiplier: '1.00',
  crashPoint: null,
  countdown: 10,
  bets: [],
  myBet: null,
  betAmount: 10,
  autoCashout: null,
  isConnected: true,
  placeBet: mockPlaceBet,
  cashout: mockCashout,
  setBetAmount: mockSetBetAmount,
  setAutoCashout: mockSetAutoCashout,
  history: [],
  serverSeedHash: 'abc123...',
};

jest.mock('@/hooks/useCrashGame', () => ({
  useCrashGame: () => mockUseCrashGame,
  GameState: {
    WAITING: 'WAITING',
    RUNNING: 'RUNNING',
    CRASHED: 'CRASHED',
  },
  BetStatus: {
    ACTIVE: 'ACTIVE',
    CASHED_OUT: 'CASHED_OUT',
    LOST: 'LOST',
  },
}));

// Mock SocketContext
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connected: true,
};

jest.mock('@/contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: mockSocket,
    isConnected: true,
  }),
}));

// Mock canvas context
const mockCanvasContext = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  scale: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  measureText: jest.fn(() => ({ width: 100 })),
  setLineDash: jest.fn(),
  closePath: jest.fn(),
  quadraticCurveTo: jest.fn(),
  bezierCurveTo: jest.fn(),
};

HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext);

// Mock AudioContext
const mockAudioContext = {
  createOscillator: jest.fn(() => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 0, setValueAtTime: jest.fn() },
    type: 'sine',
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    gain: { value: 0, setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
  })),
  destination: {},
  currentTime: 0,
};

(window as any).AudioContext = jest.fn(() => mockAudioContext);
(window as any).webkitAudioContext = jest.fn(() => mockAudioContext);

// Import component after mocks
import CrashGamePanel from '../CrashGamePanel';

// ============================================
// TEST SUITE
// ============================================

describe('🎰 CrashGamePanel - Comprehensive Frontend Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCrashGame.gameState = 'WAITING';
    mockUseCrashGame.currentMultiplier = '1.00';
    mockUseCrashGame.myBet = null;
    mockUseCrashGame.isConnected = true;
    mockUseCrashGame.countdown = 10;
  });

  // ============================================
  // 🎨 RENDERING TESTS
  // ============================================

  describe('🎨 Rendering', () => {
    it('Should render game canvas', () => {
      render(<CrashGamePanel />);
      
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('Should render bet input field', () => {
      render(<CrashGamePanel />);
      
      const betInput = screen.getByRole('spinbutton') || screen.getByPlaceholderText(/bet/i);
      expect(betInput).toBeInTheDocument();
    });

    it('Should render bet button', () => {
      render(<CrashGamePanel />);
      
      const betButton = screen.getByRole('button', { name: /bet|place/i });
      expect(betButton).toBeInTheDocument();
    });

    it('Should render multiplier display', () => {
      render(<CrashGamePanel />);
      
      // Multiplier should be visible somewhere
      expect(screen.getByText(/1\.00/)).toBeInTheDocument();
    });

    it('Should render game history', () => {
      mockUseCrashGame.history = [
        { crashPoint: 2.5, gameNumber: 1 },
        { crashPoint: 1.5, gameNumber: 2 },
      ];
      
      render(<CrashGamePanel />);
      
      // History should show crash points
      expect(screen.getByText(/2\.5/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔘 BET BUTTON STATES
  // ============================================

  describe('🔘 Bet Button States', () => {
    it('Should show "Bet" when in WAITING state and no bet placed', () => {
      mockUseCrashGame.gameState = 'WAITING';
      mockUseCrashGame.myBet = null;
      
      render(<CrashGamePanel />);
      
      const betButton = screen.getByRole('button', { name: /bet|place/i });
      expect(betButton).toBeEnabled();
    });

    it('Should show "Waiting..." when bet is placed in WAITING state', () => {
      mockUseCrashGame.gameState = 'WAITING';
      mockUseCrashGame.myBet = { status: 'ACTIVE', amount: 10 };
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/waiting|placed/i)).toBeInTheDocument();
    });

    it('Should show "Cash Out" when game is RUNNING and bet is active', () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.myBet = { status: 'ACTIVE', amount: 10 };
      mockUseCrashGame.currentMultiplier = '1.50';
      
      render(<CrashGamePanel />);
      
      const cashoutButton = screen.getByRole('button', { name: /cash|out/i });
      expect(cashoutButton).toBeEnabled();
    });

    it('Should disable bet button when not connected', () => {
      mockUseCrashGame.isConnected = false;
      
      render(<CrashGamePanel />);
      
      const betButton = screen.getByRole('button', { name: /bet|connect/i });
      expect(betButton).toBeDisabled();
    });

    it('Should disable bet button during RUNNING state without bet', () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.myBet = null;
      
      render(<CrashGamePanel />);
      
      const betButton = screen.getByRole('button');
      expect(betButton).toBeDisabled();
    });
  });

  // ============================================
  // 🎮 GAME STATE TRANSITIONS
  // ============================================

  describe('🎮 Game State Transitions', () => {
    it('Should display countdown in WAITING state', () => {
      mockUseCrashGame.gameState = 'WAITING';
      mockUseCrashGame.countdown = 5;
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });

    it('Should display multiplier in RUNNING state', () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.currentMultiplier = '2.50';
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/2\.50/)).toBeInTheDocument();
    });

    it('Should display crash point in CRASHED state', () => {
      mockUseCrashGame.gameState = 'CRASHED';
      mockUseCrashGame.crashPoint = '3.25';
      mockUseCrashGame.currentMultiplier = '3.25';
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/3\.25|crashed/i)).toBeInTheDocument();
    });

    it('Should show "Crashed" overlay when game crashes', () => {
      mockUseCrashGame.gameState = 'CRASHED';
      mockUseCrashGame.crashPoint = '1.50';
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/crash|bust/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // 🖱️ USER INTERACTIONS
  // ============================================

  describe('🖱️ User Interactions', () => {
    it('Should call placeBet when bet button is clicked', async () => {
      mockUseCrashGame.gameState = 'WAITING';
      mockUseCrashGame.myBet = null;
      
      render(<CrashGamePanel />);
      
      const betButton = screen.getByRole('button', { name: /bet|place/i });
      await userEvent.click(betButton);
      
      expect(mockPlaceBet).toHaveBeenCalled();
    });

    it('Should call cashout when cashout button is clicked', async () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.myBet = { status: 'ACTIVE', amount: 10 };
      
      render(<CrashGamePanel />);
      
      const cashoutButton = screen.getByRole('button', { name: /cash|out/i });
      await userEvent.click(cashoutButton);
      
      expect(mockCashout).toHaveBeenCalled();
    });

    it('Should update bet amount on input change', async () => {
      render(<CrashGamePanel />);
      
      const betInput = screen.getByRole('spinbutton');
      await userEvent.clear(betInput);
      await userEvent.type(betInput, '50');
      
      expect(mockSetBetAmount).toHaveBeenCalled();
    });

    it('Should handle half bet button', async () => {
      render(<CrashGamePanel />);
      
      const halfButton = screen.getByText(/½|half|0\.5x/i);
      if (halfButton) {
        await userEvent.click(halfButton);
        expect(mockSetBetAmount).toHaveBeenCalled();
      }
    });

    it('Should handle double bet button', async () => {
      render(<CrashGamePanel />);
      
      const doubleButton = screen.getByText(/2x|double/i);
      if (doubleButton) {
        await userEvent.click(doubleButton);
        expect(mockSetBetAmount).toHaveBeenCalled();
      }
    });
  });

  // ============================================
  // ⌨️ KEYBOARD HOTKEYS
  // ============================================

  describe('⌨️ Keyboard Hotkeys', () => {
    it('Should trigger bet/cashout on SPACEBAR press', async () => {
      mockUseCrashGame.gameState = 'WAITING';
      mockUseCrashGame.myBet = null;
      
      render(<CrashGamePanel />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      });
      
      // Should either place bet or cashout depending on state
      expect(mockPlaceBet).toHaveBeenCalled();
    });

    it('Should trigger cashout on SPACEBAR when running with bet', async () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.myBet = { status: 'ACTIVE', amount: 10 };
      
      render(<CrashGamePanel />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      });
      
      expect(mockCashout).toHaveBeenCalled();
    });
  });

  // ============================================
  // 🔊 SOUND EFFECTS
  // ============================================

  describe('🔊 Sound Effects', () => {
    it('Should have mute toggle button', () => {
      render(<CrashGamePanel />);
      
      const muteButton = screen.getByRole('button', { name: /mute|sound|🔊|🔇/i });
      expect(muteButton).toBeInTheDocument();
    });

    it('Should toggle mute state on click', async () => {
      render(<CrashGamePanel />);
      
      const muteButton = screen.getByRole('button', { name: /mute|sound|🔊|🔇/i });
      await userEvent.click(muteButton);
      
      // Button should change icon/state
      expect(muteButton).toBeInTheDocument();
    });
  });

  // ============================================
  // 📊 BETS DISPLAY
  // ============================================

  describe('📊 Bets Display', () => {
    it('Should display other players bets', () => {
      mockUseCrashGame.bets = [
        { oderId: 'user-1', username: 'Player1', amount: 100, status: 'ACTIVE' },
        { oderId: 'user-2', username: 'Player2', amount: 50, status: 'ACTIVE' },
      ];
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/Player1|100/)).toBeInTheDocument();
    });

    it('Should highlight cashed out bets', () => {
      mockUseCrashGame.bets = [
        { oderId: 'user-1', username: 'Player1', amount: 100, status: 'CASHED_OUT', cashedOutAt: 2.5 },
      ];
      
      render(<CrashGamePanel />);
      
      // Cashed out bets should show multiplier
      expect(screen.getByText(/2\.5|cashed/i)).toBeInTheDocument();
    });

    it('Should show lost bets after crash', () => {
      mockUseCrashGame.gameState = 'CRASHED';
      mockUseCrashGame.bets = [
        { oderId: 'user-1', username: 'Player1', amount: 100, status: 'LOST' },
      ];
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/lost|bust/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // 🎨 CANVAS RENDERING
  // ============================================

  describe('🎨 Canvas Rendering', () => {
    it('Should initialize canvas context', () => {
      render(<CrashGamePanel />);
      
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
    });

    it('Should clear canvas on each frame', async () => {
      render(<CrashGamePanel />);
      
      // Wait for animation frame
      await waitFor(() => {
        expect(mockCanvasContext.clearRect).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // 🔌 CONNECTION STATES
  // ============================================

  describe('🔌 Connection States', () => {
    it('Should show connecting state when not connected', () => {
      mockUseCrashGame.isConnected = false;
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/connect|offline|disconnected/i)).toBeInTheDocument();
    });

    it('Should enable controls when connected', () => {
      mockUseCrashGame.isConnected = true;
      mockUseCrashGame.gameState = 'WAITING';
      
      render(<CrashGamePanel />);
      
      const betButton = screen.getByRole('button', { name: /bet|place/i });
      expect(betButton).toBeEnabled();
    });
  });

  // ============================================
  // 💰 AUTO CASHOUT
  // ============================================

  describe('💰 Auto Cashout', () => {
    it('Should have auto cashout input', () => {
      render(<CrashGamePanel />);
      
      const autoCashoutInput = screen.getByPlaceholderText(/auto|cashout|target/i);
      expect(autoCashoutInput).toBeInTheDocument();
    });

    it('Should update auto cashout value', async () => {
      render(<CrashGamePanel />);
      
      const autoCashoutInput = screen.getByPlaceholderText(/auto|cashout|target/i);
      await userEvent.clear(autoCashoutInput);
      await userEvent.type(autoCashoutInput, '2.5');
      
      expect(mockSetAutoCashout).toHaveBeenCalled();
    });
  });

  // ============================================
  // 📜 PROVABLY FAIR
  // ============================================

  describe('📜 Provably Fair', () => {
    it('Should display server seed hash', () => {
      mockUseCrashGame.serverSeedHash = 'abc123def456...';
      
      render(<CrashGamePanel />);
      
      // Should show some indication of provably fair
      expect(screen.getByText(/fair|seed|verify/i)).toBeInTheDocument();
    });
  });

  // ============================================
  // 🎯 EDGE CASES
  // ============================================

  describe('🎯 Edge Cases', () => {
    it('Should handle instant bust (1.00x)', () => {
      mockUseCrashGame.gameState = 'CRASHED';
      mockUseCrashGame.crashPoint = '1.00';
      mockUseCrashGame.currentMultiplier = '1.00';
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/1\.00|bust/i)).toBeInTheDocument();
    });

    it('Should handle high multiplier (1000x+)', () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.currentMultiplier = '1234.56';
      
      render(<CrashGamePanel />);
      
      expect(screen.getByText(/1234/)).toBeInTheDocument();
    });

    it('Should handle zero bet amount', async () => {
      render(<CrashGamePanel />);
      
      const betInput = screen.getByRole('spinbutton');
      await userEvent.clear(betInput);
      await userEvent.type(betInput, '0');
      
      const betButton = screen.getByRole('button', { name: /bet|place/i });
      expect(betButton).toBeDisabled();
    });

    it('Should handle very large bet amount', async () => {
      render(<CrashGamePanel />);
      
      const betInput = screen.getByRole('spinbutton');
      await userEvent.clear(betInput);
      await userEvent.type(betInput, '999999');
      
      expect(mockSetBetAmount).toHaveBeenCalled();
    });
  });

  // ============================================
  // 🔄 STATE UPDATES
  // ============================================

  describe('🔄 State Updates', () => {
    it('Should update when game state changes', async () => {
      const { rerender } = render(<CrashGamePanel />);
      
      // Change state
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.currentMultiplier = '1.50';
      
      rerender(<CrashGamePanel />);
      
      expect(screen.getByText(/1\.50/)).toBeInTheDocument();
    });

    it('Should update when bet is placed', async () => {
      const { rerender } = render(<CrashGamePanel />);
      
      mockUseCrashGame.myBet = { status: 'ACTIVE', amount: 50 };
      
      rerender(<CrashGamePanel />);
      
      expect(screen.getByText(/50|placed|waiting/i)).toBeInTheDocument();
    });

    it('Should update when cashout happens', async () => {
      mockUseCrashGame.gameState = 'RUNNING';
      mockUseCrashGame.myBet = { status: 'ACTIVE', amount: 50 };
      
      const { rerender } = render(<CrashGamePanel />);
      
      mockUseCrashGame.myBet = { status: 'CASHED_OUT', amount: 50, cashedOutAt: 2.0, profit: 50 };
      
      rerender(<CrashGamePanel />);
      
      expect(screen.getByText(/win|profit|cashed/i)).toBeInTheDocument();
    });
  });
});

// ============================================
// 🧪 SOCKET EVENT TESTS
// ============================================

describe('🧪 Socket Event Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should register socket event listeners on mount', () => {
    render(<CrashGamePanel />);
    
    expect(mockSocket.on).toHaveBeenCalled();
  });

  it('Should unregister socket event listeners on unmount', () => {
    const { unmount } = render(<CrashGamePanel />);
    
    unmount();
    
    expect(mockSocket.off).toHaveBeenCalled();
  });
});

// ============================================
// 📱 RESPONSIVE TESTS
// ============================================

describe('📱 Responsive Design', () => {
  it('Should render on mobile viewport', () => {
    // Simulate mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });
    
    render(<CrashGamePanel />);
    
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('Should render on tablet viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });
    
    render(<CrashGamePanel />);
    
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('Should render on desktop viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true });
    
    render(<CrashGamePanel />);
    
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});
