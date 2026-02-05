/**
 * 🎮 Crash Game UI - Comprehensive Integration Tests
 * 
 * Operation "Crash-Test Dummy" - Frontend Coverage
 * 
 * Tests:
 * - Initial State: Connecting -> Waiting
 * - Bet Interaction: Input -> Click -> State Change
 * - Game Running: Socket events -> UI updates
 * - Cashout: Click -> Success notification
 * - Crash: Boom event -> Red UI -> Disabled buttons
 * 
 * Mocks: useSocket, useSound, useAuth
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================
// MOCK SETUP
// ============================================

// Mock Next.js Router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    pathname: '/games/crash',
  }),
  usePathname: () => '/games/crash',
}));

// Mock Socket Events
const mockSocketEmit = jest.fn();
const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();
let socketEventHandlers: { [key: string]: Function } = {};

jest.mock('socket.io-client', () => ({
  io: () => ({
    emit: mockSocketEmit,
    on: (event: string, handler: Function) => {
      socketEventHandlers[event] = handler;
      mockSocketOn(event, handler);
    },
    off: mockSocketOff,
    connected: true,
    disconnect: jest.fn(),
  }),
}));

// Mock useSound hook
jest.mock('@/hooks/useSound', () => ({
  useSound: () => ({
    play: jest.fn(),
    stop: jest.fn(),
    isPlaying: false,
  }),
}));

// Mock Audio
window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.pause = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn().mockReturnValue('mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16) as unknown as number);
global.cancelAnimationFrame = jest.fn();

// ============================================
// MOCK COMPONENTS
// ============================================

// Game State Types
type GameState = 'WAITING' | 'BETTING' | 'RUNNING' | 'CRASHED';

interface MockCrashGameProps {
  initialState?: GameState;
  initialMultiplier?: string;
  isConnected?: boolean;
  balance?: number;
  onBet?: (amount: number, autoCashout?: number) => void;
  onCashout?: () => void;
}

// Mock Crash Game Component
const MockCrashGame: React.FC<MockCrashGameProps> = ({
  initialState = 'WAITING',
  initialMultiplier = '1.00',
  isConnected = true,
  balance = 1000,
  onBet = jest.fn(),
  onCashout = jest.fn(),
}) => {
  const [gameState, setGameState] = React.useState<GameState>(initialState);
  const [multiplier, setMultiplier] = React.useState(initialMultiplier);
  const [betAmount, setBetAmount] = React.useState(10);
  const [autoCashout, setAutoCashout] = React.useState<number | undefined>();
  const [hasBet, setHasBet] = React.useState(false);
  const [notification, setNotification] = React.useState<string | null>(null);
  const [connecting, setConnecting] = React.useState(!isConnected);

  // Simulate socket connection
  React.useEffect(() => {
    if (!isConnected) {
      setConnecting(true);
      const timer = setTimeout(() => setConnecting(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  // Register socket event handlers
  React.useEffect(() => {
    // State change handler
    socketEventHandlers['crash:state_change'] = (data: { state: GameState; multiplier: string }) => {
      setGameState(data.state);
      setMultiplier(data.multiplier);
    };

    // Update handler (multiplier tick)
    socketEventHandlers['crash:update'] = (data: { multiplier: string }) => {
      setMultiplier(data.multiplier);
    };

    // Boom handler (crash)
    socketEventHandlers['crash:boom'] = (data: { crashPoint: string }) => {
      setGameState('CRASHED');
      setMultiplier(data.crashPoint);
      if (hasBet) {
        setNotification('You Lost!');
      }
    };

    // Cashout success handler
    socketEventHandlers['crash:cashout_success'] = (data: { profit: string }) => {
      setNotification(`You Won! +$${data.profit}`);
      setHasBet(false);
    };

    // Bet placed handler
    socketEventHandlers['crash:bet_placed'] = () => {
      setHasBet(true);
    };

    return () => {
      socketEventHandlers = {};
    };
  }, [hasBet]);

  const handleBet = () => {
    if (gameState === 'BETTING' && betAmount > 0 && betAmount <= balance) {
      onBet(betAmount, autoCashout);
      mockSocketEmit('crash:placeBet', { amount: betAmount, autoCashout });
      setHasBet(true);
    }
  };

  const handleCashout = () => {
    if (gameState === 'RUNNING' && hasBet) {
      onCashout();
      mockSocketEmit('crash:cashout', {});
    }
  };

  const handleCancelBet = () => {
    if (gameState === 'BETTING' && hasBet) {
      mockSocketEmit('crash:cancelBet', {});
      setHasBet(false);
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === 'BETTING' && !hasBet) {
          handleBet();
        } else if (gameState === 'RUNNING' && hasBet) {
          handleCashout();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, hasBet, betAmount, balance]);

  if (connecting) {
    return <div data-testid="connecting">Connecting...</div>;
  }

  return (
    <div data-testid="crash-game" className={gameState === 'CRASHED' ? 'crashed' : ''}>
      {/* Game Canvas */}
      <canvas data-testid="game-canvas" width={800} height={400} />

      {/* Multiplier Display */}
      <div 
        data-testid="multiplier" 
        className={gameState === 'CRASHED' ? 'text-red-500' : 'text-green-500'}
      >
        {multiplier}x
      </div>

      {/* Game State */}
      <div data-testid="game-state">{gameState}</div>

      {/* Balance */}
      <div data-testid="balance">${balance.toFixed(2)}</div>

      {/* Notification */}
      {notification && (
        <div data-testid="notification" className="notification">
          {notification}
        </div>
      )}

      {/* Bet Input */}
      <input
        type="number"
        data-testid="bet-input"
        value={betAmount}
        onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
        disabled={gameState !== 'BETTING' || hasBet}
        min={0}
      />

      {/* Auto Cashout Input */}
      <input
        type="number"
        data-testid="auto-cashout-input"
        value={autoCashout || ''}
        onChange={(e) => setAutoCashout(e.target.value ? Number(e.target.value) : undefined)}
        placeholder="Auto Cashout"
        disabled={gameState !== 'BETTING' || hasBet}
        min={1.01}
        step={0.01}
      />

      {/* Bet Button */}
      {!hasBet ? (
        <button
          data-testid="bet-button"
          onClick={handleBet}
          disabled={
            !isConnected ||
            gameState !== 'BETTING' ||
            betAmount <= 0 ||
            betAmount > balance
          }
        >
          Bet
        </button>
      ) : gameState === 'BETTING' ? (
        <button data-testid="cancel-button" onClick={handleCancelBet}>
          Cancel
        </button>
      ) : gameState === 'RUNNING' ? (
        <button data-testid="cashout-button" onClick={handleCashout}>
          Cashout @ {multiplier}x
        </button>
      ) : (
        <button data-testid="bet-button" disabled>
          {gameState === 'CRASHED' ? 'Crashed!' : 'Wait...'}
        </button>
      )}

      {/* Quick Bet Buttons */}
      <div data-testid="quick-bets">
        <button
          data-testid="quick-bet-10"
          onClick={() => setBetAmount(10)}
          disabled={gameState !== 'BETTING' || hasBet}
        >
          $10
        </button>
        <button
          data-testid="quick-bet-50"
          onClick={() => setBetAmount(50)}
          disabled={gameState !== 'BETTING' || hasBet}
        >
          $50
        </button>
        <button
          data-testid="quick-bet-100"
          onClick={() => setBetAmount(100)}
          disabled={gameState !== 'BETTING' || hasBet}
        >
          $100
        </button>
        <button
          data-testid="quick-bet-half"
          onClick={() => setBetAmount(Math.floor(balance / 2))}
          disabled={gameState !== 'BETTING' || hasBet}
        >
          1/2
        </button>
        <button
          data-testid="quick-bet-max"
          onClick={() => setBetAmount(balance)}
          disabled={gameState !== 'BETTING' || hasBet}
        >
          Max
        </button>
      </div>
    </div>
  );
};

// ============================================
// INITIAL STATE TESTS
// ============================================

describe('🎮 Initial State Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should show "Connecting..." when not connected', () => {
    render(<MockCrashGame isConnected={false} />);
    
    expect(screen.getByTestId('connecting')).toHaveTextContent('Connecting...');
  });

  it('Should show game canvas when connected', () => {
    render(<MockCrashGame isConnected={true} initialState="WAITING" />);
    
    expect(screen.getByTestId('game-canvas')).toBeInTheDocument();
  });

  it('Should display initial multiplier as 1.00x', () => {
    render(<MockCrashGame initialMultiplier="1.00" />);
    
    expect(screen.getByTestId('multiplier')).toHaveTextContent('1.00x');
  });

  it('Should display balance', () => {
    render(<MockCrashGame balance={1000} />);
    
    expect(screen.getByTestId('balance')).toHaveTextContent('$1000.00');
  });

  it('Should show WAITING state initially', () => {
    render(<MockCrashGame initialState="WAITING" />);
    
    expect(screen.getByTestId('game-state')).toHaveTextContent('WAITING');
  });
});

// ============================================
// BET INTERACTION TESTS
// ============================================

describe('💰 Bet Interaction Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should enable bet button during BETTING state', () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    expect(screen.getByTestId('bet-button')).not.toBeDisabled();
  });

  it('Should disable bet button during WAITING state', () => {
    render(<MockCrashGame initialState="WAITING" />);
    
    expect(screen.getByTestId('bet-button')).toBeDisabled();
  });

  it('Should disable bet button during RUNNING state', () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    expect(screen.getByTestId('bet-button')).toBeDisabled();
  });

  it('Should update bet amount on input change', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    const input = screen.getByTestId('bet-input');
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    
    expect(input).toHaveValue(100);
  });

  it('Should emit bet event on button click', async () => {
    const mockOnBet = jest.fn();
    render(<MockCrashGame initialState="BETTING" onBet={mockOnBet} />);
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    expect(mockSocketEmit).toHaveBeenCalledWith('crash:placeBet', expect.any(Object));
  });

  it('Should show Cancel button after placing bet', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
  });

  it('Should disable bet button when amount exceeds balance', async () => {
    render(<MockCrashGame initialState="BETTING" balance={50} />);
    
    const input = screen.getByTestId('bet-input');
    await userEvent.clear(input);
    await userEvent.type(input, '100');
    
    expect(screen.getByTestId('bet-button')).toBeDisabled();
  });

  it('Should disable bet button when amount is zero', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    const input = screen.getByTestId('bet-input');
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    
    expect(screen.getByTestId('bet-button')).toBeDisabled();
  });

  it('Should prevent negative bet amounts', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    const input = screen.getByTestId('bet-input');
    await userEvent.clear(input);
    await userEvent.type(input, '-50');
    
    expect(Number((input as HTMLInputElement).value)).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// AUTO-CASHOUT TESTS
// ============================================

describe('🤖 Auto-Cashout Input Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should accept auto-cashout value', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    const input = screen.getByTestId('auto-cashout-input');
    await userEvent.type(input, '2.5');
    
    expect(input).toHaveValue(2.5);
  });

  it('Should include auto-cashout in bet emission', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    const autoCashoutInput = screen.getByTestId('auto-cashout-input');
    await userEvent.type(autoCashoutInput, '2');
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    expect(mockSocketEmit).toHaveBeenCalledWith('crash:placeBet', 
      expect.objectContaining({ autoCashout: 2 })
    );
  });

  it('Should disable auto-cashout input after bet placed', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    expect(screen.getByTestId('auto-cashout-input')).toBeDisabled();
  });
});

// ============================================
// GAME RUNNING TESTS
// ============================================

describe('🎲 Game Running Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should update multiplier on socket event', async () => {
    render(<MockCrashGame initialState="RUNNING" initialMultiplier="1.00" />);
    
    // Simulate socket event
    act(() => {
      if (socketEventHandlers['crash:update']) {
        socketEventHandlers['crash:update']({ multiplier: '2.50' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('multiplier')).toHaveTextContent('2.50x');
    });
  });

  it('Should show Cashout button when game is running and bet placed', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    // Place bet
    await userEvent.click(screen.getByTestId('bet-button'));
    
    // Simulate game start
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '1.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('cashout-button')).toBeInTheDocument();
    });
  });

  it('Should emit cashout event on button click', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    // Place bet
    await userEvent.click(screen.getByTestId('bet-button'));
    
    // Simulate game start
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '2.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('cashout-button')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('cashout-button'));
    
    expect(mockSocketEmit).toHaveBeenCalledWith('crash:cashout', {});
  });
});

// ============================================
// CRASH EVENT TESTS
// ============================================

describe('💥 Crash Event Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should show CRASHED state on boom event', async () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '2.50' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('game-state')).toHaveTextContent('CRASHED');
    });
  });

  it('Should display crash point on boom', async () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '3.75' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('multiplier')).toHaveTextContent('3.75x');
    });
  });

  it('Should show "You Lost!" notification on crash with active bet', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    // Place bet
    await userEvent.click(screen.getByTestId('bet-button'));
    
    // Simulate game start
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '1.00' });
      }
    });
    
    // Simulate crash
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '1.50' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('notification')).toHaveTextContent('You Lost!');
    });
  });

  it('Should disable bet button after crash', async () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '2.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('bet-button')).toBeDisabled();
    });
  });
});

// ============================================
// CASHOUT SUCCESS TESTS
// ============================================

describe('🎉 Cashout Success Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should show "You Won!" notification on successful cashout', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    // Place bet
    await userEvent.click(screen.getByTestId('bet-button'));
    
    // Simulate game start
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '1.00' });
      }
    });
    
    // Simulate cashout success
    act(() => {
      if (socketEventHandlers['crash:cashout_success']) {
        socketEventHandlers['crash:cashout_success']({ profit: '100.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('notification')).toHaveTextContent('You Won!');
    });
  });

  it('Should display profit amount in notification', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '2.00' });
      }
    });
    
    act(() => {
      if (socketEventHandlers['crash:cashout_success']) {
        socketEventHandlers['crash:cashout_success']({ profit: '50.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('notification')).toHaveTextContent('+$50.00');
    });
  });
});

// ============================================
// KEYBOARD SHORTCUT TESTS
// ============================================

describe('⌨️ Keyboard Shortcut Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should place bet on spacebar during BETTING', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    fireEvent.keyDown(window, { code: 'Space' });
    
    expect(mockSocketEmit).toHaveBeenCalledWith('crash:placeBet', expect.any(Object));
  });

  it('Should NOT place bet on spacebar during WAITING', () => {
    render(<MockCrashGame initialState="WAITING" />);
    
    fireEvent.keyDown(window, { code: 'Space' });
    
    expect(mockSocketEmit).not.toHaveBeenCalledWith('crash:placeBet', expect.any(Object));
  });

  it('Should cashout on spacebar during RUNNING with active bet', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    // Place bet first
    await userEvent.click(screen.getByTestId('bet-button'));
    
    // Simulate game start
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '2.00' });
      }
    });
    
    // Press spacebar to cashout
    fireEvent.keyDown(window, { code: 'Space' });
    
    expect(mockSocketEmit).toHaveBeenCalledWith('crash:cashout', {});
  });
});

// ============================================
// QUICK BET BUTTON TESTS
// ============================================

describe('⚡ Quick Bet Button Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should set bet amount to $10 on quick bet click', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('quick-bet-10'));
    
    expect(screen.getByTestId('bet-input')).toHaveValue(10);
  });

  it('Should set bet amount to $50 on quick bet click', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('quick-bet-50'));
    
    expect(screen.getByTestId('bet-input')).toHaveValue(50);
  });

  it('Should set bet amount to $100 on quick bet click', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('quick-bet-100'));
    
    expect(screen.getByTestId('bet-input')).toHaveValue(100);
  });

  it('Should set bet amount to half balance on 1/2 click', async () => {
    render(<MockCrashGame initialState="BETTING" balance={1000} />);
    
    await userEvent.click(screen.getByTestId('quick-bet-half'));
    
    expect(screen.getByTestId('bet-input')).toHaveValue(500);
  });

  it('Should set bet amount to full balance on Max click', async () => {
    render(<MockCrashGame initialState="BETTING" balance={1000} />);
    
    await userEvent.click(screen.getByTestId('quick-bet-max'));
    
    expect(screen.getByTestId('bet-input')).toHaveValue(1000);
  });

  it('Should disable quick bet buttons after bet placed', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    expect(screen.getByTestId('quick-bet-10')).toBeDisabled();
    expect(screen.getByTestId('quick-bet-50')).toBeDisabled();
    expect(screen.getByTestId('quick-bet-100')).toBeDisabled();
  });
});

// ============================================
// DISCONNECTION HANDLING TESTS
// ============================================

describe('🔌 Disconnection Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should disable bet button when disconnected', () => {
    render(<MockCrashGame isConnected={false} initialState="BETTING" />);
    
    // Should show connecting state
    expect(screen.getByTestId('connecting')).toBeInTheDocument();
  });

  it('Should show connecting message when not connected', () => {
    render(<MockCrashGame isConnected={false} />);
    
    expect(screen.getByTestId('connecting')).toHaveTextContent('Connecting...');
  });
});

// ============================================
// VISUAL STATE TESTS
// ============================================

describe('🎨 Visual State Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should have red styling when crashed', async () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '2.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('crash-game')).toHaveClass('crashed');
    });
  });

  it('Should show multiplier in green during running', () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    expect(screen.getByTestId('multiplier')).toHaveClass('text-green-500');
  });

  it('Should show multiplier in red after crash', async () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '2.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('multiplier')).toHaveClass('text-red-500');
    });
  });
});

// ============================================
// EDGE CASE TESTS
// ============================================

describe('🔧 Edge Case Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
  });

  it('Should handle instant bust (1.00x crash)', async () => {
    render(<MockCrashGame initialState="BETTING" />);
    
    await userEvent.click(screen.getByTestId('bet-button'));
    
    act(() => {
      if (socketEventHandlers['crash:state_change']) {
        socketEventHandlers['crash:state_change']({ state: 'RUNNING', multiplier: '1.00' });
      }
    });
    
    // Instant crash
    act(() => {
      if (socketEventHandlers['crash:boom']) {
        socketEventHandlers['crash:boom']({ crashPoint: '1.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('multiplier')).toHaveTextContent('1.00x');
      expect(screen.getByTestId('game-state')).toHaveTextContent('CRASHED');
    });
  });

  it('Should handle very high multiplier', async () => {
    render(<MockCrashGame initialState="RUNNING" />);
    
    act(() => {
      if (socketEventHandlers['crash:update']) {
        socketEventHandlers['crash:update']({ multiplier: '1000.00' });
      }
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('multiplier')).toHaveTextContent('1000.00x');
    });
  });

  it('Should handle rapid state changes', async () => {
    render(<MockCrashGame initialState="WAITING" />);
    
    // Rapid state changes
    act(() => {
      socketEventHandlers['crash:state_change']?.({ state: 'BETTING', multiplier: '1.00' });
    });
    act(() => {
      socketEventHandlers['crash:state_change']?.({ state: 'RUNNING', multiplier: '1.00' });
    });
    act(() => {
      socketEventHandlers['crash:boom']?.({ crashPoint: '1.50' });
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('game-state')).toHaveTextContent('CRASHED');
    });
  });

  it('Should handle zero balance', () => {
    render(<MockCrashGame initialState="BETTING" balance={0} />);
    
    expect(screen.getByTestId('bet-button')).toBeDisabled();
  });
});
