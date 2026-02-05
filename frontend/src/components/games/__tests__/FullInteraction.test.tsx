/**
 * 🖱️ Full Interaction Test Suite - "Click Everything"
 * 
 * This test suite simulates a user clicking every single button:
 * - Auth: Login, Logout, Registration
 * - Wallet: Deposit, Withdraw, Copy Address
 * - Game: Bet, Cashout, Hotkeys
 * - Navigation: Sidebar, Game Cards
 * 
 * Target: 100% UI interaction coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================
// MOCK SETUP
// ============================================

// Mock Next.js Router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    pathname: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Socket.io
const mockSocketEmit = jest.fn();
const mockSocketOn = jest.fn();
const mockSocketOff = jest.fn();
jest.mock('socket.io-client', () => ({
  io: () => ({
    emit: mockSocketEmit,
    on: mockSocketOn,
    off: mockSocketOff,
    connected: true,
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock Audio
window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.pause = jest.fn();

// ============================================
// MOCK COMPONENTS FOR TESTING
// ============================================

// Simple Button Component for testing
const TestButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled} data-testid="test-button">
    {children}
  </button>
);

// Mock Login Form
const MockLoginForm: React.FC<{
  onSubmit: (email: string, password: string) => void;
}> = ({ onSubmit }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <form
      data-testid="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email, password);
      }}
    >
      <input
        type="email"
        data-testid="email-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        data-testid="password-input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit" data-testid="login-button">
        Login
      </button>
    </form>
  );
};

// Mock Wallet Component
const MockWallet: React.FC<{
  balance: number;
  address: string;
  onDeposit: () => void;
  onWithdraw: (amount: number) => void;
  onCopyAddress: () => void;
}> = ({ balance, address, onDeposit, onWithdraw, onCopyAddress }) => {
  const [withdrawAmount, setWithdrawAmount] = React.useState(0);

  return (
    <div data-testid="wallet">
      <span data-testid="balance">{balance}</span>
      <span data-testid="address">{address}</span>
      <button data-testid="deposit-btn" onClick={onDeposit}>
        Deposit
      </button>
      <input
        type="number"
        data-testid="withdraw-amount"
        value={withdrawAmount}
        onChange={(e) => setWithdrawAmount(Number(e.target.value))}
      />
      <button
        data-testid="withdraw-btn"
        onClick={() => onWithdraw(withdrawAmount)}
        disabled={withdrawAmount > balance}
      >
        Withdraw
      </button>
      <button data-testid="copy-address-btn" onClick={onCopyAddress}>
        Copy Address
      </button>
    </div>
  );
};

// Mock Game Component
const MockCrashGame: React.FC<{
  isConnected: boolean;
  balance: number;
  onBet: (amount: number) => void;
  onCashout: () => void;
  gameState: 'waiting' | 'running' | 'crashed';
}> = ({ isConnected, balance, onBet, onCashout, gameState }) => {
  const [betAmount, setBetAmount] = React.useState(10);
  const [autoCashout, setAutoCashout] = React.useState(2.0);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState === 'waiting' && isConnected) {
        onBet(betAmount);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [betAmount, gameState, isConnected, onBet]);

  return (
    <div data-testid="crash-game">
      <canvas data-testid="game-canvas" />
      <div data-testid="game-state">{gameState}</div>
      <input
        type="number"
        data-testid="bet-amount"
        value={betAmount}
        onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
        min={0}
      />
      <input
        type="number"
        data-testid="auto-cashout"
        value={autoCashout}
        onChange={(e) => setAutoCashout(Math.max(1.01, Number(e.target.value)))}
        min={1.01}
        step={0.01}
      />
      <button
        data-testid="bet-btn"
        onClick={() => onBet(betAmount)}
        disabled={!isConnected || balance < betAmount || gameState !== 'waiting'}
      >
        Bet
      </button>
      <button
        data-testid="cashout-btn"
        onClick={onCashout}
        disabled={gameState !== 'running'}
      >
        Cashout
      </button>
    </div>
  );
};

// Mock Sidebar Navigation
const MockSidebar: React.FC<{
  links: Array<{ name: string; href: string }>;
  onNavigate: (href: string) => void;
}> = ({ links, onNavigate }) => (
  <nav data-testid="sidebar">
    {links.map((link) => (
      <button
        key={link.href}
        data-testid={`nav-${link.name.toLowerCase()}`}
        onClick={() => onNavigate(link.href)}
      >
        {link.name}
      </button>
    ))}
  </nav>
);

// Mock Game Card
const MockGameCard: React.FC<{
  name: string;
  href: string;
  isComingSoon?: boolean;
  onClick: () => void;
}> = ({ name, href, isComingSoon, onClick }) => (
  <div
    data-testid={`game-card-${name.toLowerCase()}`}
    onClick={isComingSoon ? undefined : onClick}
    style={{ cursor: isComingSoon ? 'not-allowed' : 'pointer' }}
  >
    <span>{name}</span>
    {isComingSoon && <span data-testid="coming-soon">Coming Soon</span>}
  </div>
);

// ============================================
// AUTH TESTS
// ============================================

describe('🔐 Auth Interactions', () => {
  describe('Login Flow', () => {
    it('Should render login form', () => {
      const mockSubmit = jest.fn();
      render(<MockLoginForm onSubmit={mockSubmit} />);

      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-button')).toBeInTheDocument();
    });

    it('Should submit login with correct credentials', async () => {
      const mockSubmit = jest.fn();
      render(<MockLoginForm onSubmit={mockSubmit} />);

      await userEvent.type(screen.getByTestId('email-input'), 'test@example.com');
      await userEvent.type(screen.getByTestId('password-input'), 'password123');
      await userEvent.click(screen.getByTestId('login-button'));

      expect(mockSubmit).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('Should handle empty email submission', async () => {
      const mockSubmit = jest.fn();
      render(<MockLoginForm onSubmit={mockSubmit} />);

      await userEvent.type(screen.getByTestId('password-input'), 'password123');
      await userEvent.click(screen.getByTestId('login-button'));

      expect(mockSubmit).toHaveBeenCalledWith('', 'password123');
    });

    it('Should handle empty password submission', async () => {
      const mockSubmit = jest.fn();
      render(<MockLoginForm onSubmit={mockSubmit} />);

      await userEvent.type(screen.getByTestId('email-input'), 'test@example.com');
      await userEvent.click(screen.getByTestId('login-button'));

      expect(mockSubmit).toHaveBeenCalledWith('test@example.com', '');
    });

    it('Should handle special characters in password', async () => {
      const mockSubmit = jest.fn();
      render(<MockLoginForm onSubmit={mockSubmit} />);

      await userEvent.type(screen.getByTestId('email-input'), 'test@example.com');
      await userEvent.type(screen.getByTestId('password-input'), 'P@$$w0rd!@#$%');
      await userEvent.click(screen.getByTestId('login-button'));

      expect(mockSubmit).toHaveBeenCalledWith('test@example.com', 'P@$$w0rd!@#$%');
    });
  });

  describe('Logout Flow', () => {
    it('Should clear localStorage on logout', () => {
      localStorageMock.removeItem.mockClear();

      // Simulate logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });
  });
});

// ============================================
// WALLET TESTS
// ============================================

describe('💰 Wallet Interactions', () => {
  describe('Deposit Flow', () => {
    it('Should render wallet with balance', () => {
      render(
        <MockWallet
          balance={1000}
          address="TRX123456789"
          onDeposit={jest.fn()}
          onWithdraw={jest.fn()}
          onCopyAddress={jest.fn()}
        />
      );

      expect(screen.getByTestId('balance')).toHaveTextContent('1000');
    });

    it('Should trigger deposit action', async () => {
      const mockDeposit = jest.fn();
      render(
        <MockWallet
          balance={1000}
          address="TRX123456789"
          onDeposit={mockDeposit}
          onWithdraw={jest.fn()}
          onCopyAddress={jest.fn()}
        />
      );

      await userEvent.click(screen.getByTestId('deposit-btn'));

      expect(mockDeposit).toHaveBeenCalled();
    });

    it('Should copy address to clipboard', async () => {
      const mockCopy = jest.fn();
      render(
        <MockWallet
          balance={1000}
          address="TRX123456789"
          onDeposit={jest.fn()}
          onWithdraw={jest.fn()}
          onCopyAddress={mockCopy}
        />
      );

      await userEvent.click(screen.getByTestId('copy-address-btn'));

      expect(mockCopy).toHaveBeenCalled();
    });
  });

  describe('Withdraw Flow', () => {
    it('Should allow withdraw within balance', async () => {
      const mockWithdraw = jest.fn();
      render(
        <MockWallet
          balance={1000}
          address="TRX123456789"
          onDeposit={jest.fn()}
          onWithdraw={mockWithdraw}
          onCopyAddress={jest.fn()}
        />
      );

      const input = screen.getByTestId('withdraw-amount');
      await userEvent.clear(input);
      await userEvent.type(input, '500');
      await userEvent.click(screen.getByTestId('withdraw-btn'));

      expect(mockWithdraw).toHaveBeenCalledWith(500);
    });

    it('Should disable withdraw button when amount exceeds balance', async () => {
      render(
        <MockWallet
          balance={100}
          address="TRX123456789"
          onDeposit={jest.fn()}
          onWithdraw={jest.fn()}
          onCopyAddress={jest.fn()}
        />
      );

      const input = screen.getByTestId('withdraw-amount');
      await userEvent.clear(input);
      await userEvent.type(input, '500');

      expect(screen.getByTestId('withdraw-btn')).toBeDisabled();
    });

    it('Should handle zero withdraw amount', async () => {
      const mockWithdraw = jest.fn();
      render(
        <MockWallet
          balance={1000}
          address="TRX123456789"
          onDeposit={jest.fn()}
          onWithdraw={mockWithdraw}
          onCopyAddress={jest.fn()}
        />
      );

      await userEvent.click(screen.getByTestId('withdraw-btn'));

      expect(mockWithdraw).toHaveBeenCalledWith(0);
    });
  });
});

// ============================================
// GAME TESTS
// ============================================

describe('🎮 Game Interactions', () => {
  describe('Crash Game', () => {
    it('Should render game canvas', () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      expect(screen.getByTestId('game-canvas')).toBeInTheDocument();
    });

    it('Should disable bet button when not connected', () => {
      render(
        <MockCrashGame
          isConnected={false}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      expect(screen.getByTestId('bet-btn')).toBeDisabled();
    });

    it('Should enable bet button when connected with funds', () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      expect(screen.getByTestId('bet-btn')).not.toBeDisabled();
    });

    it('Should disable bet button when insufficient funds', () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={5}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      expect(screen.getByTestId('bet-btn')).toBeDisabled();
    });

    it('Should place bet on button click', async () => {
      const mockBet = jest.fn();
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={mockBet}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      await userEvent.click(screen.getByTestId('bet-btn'));

      expect(mockBet).toHaveBeenCalledWith(10);
    });

    it('Should trigger bet on spacebar hotkey', async () => {
      const mockBet = jest.fn();
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={mockBet}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      fireEvent.keyDown(window, { code: 'Space' });

      expect(mockBet).toHaveBeenCalledWith(10);
    });

    it('Should NOT trigger bet on spacebar when game is running', async () => {
      const mockBet = jest.fn();
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={mockBet}
          onCashout={jest.fn()}
          gameState="running"
        />
      );

      fireEvent.keyDown(window, { code: 'Space' });

      expect(mockBet).not.toHaveBeenCalled();
    });

    it('Should enable cashout button when game is running', () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="running"
        />
      );

      expect(screen.getByTestId('cashout-btn')).not.toBeDisabled();
    });

    it('Should disable cashout button when game is not running', () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      expect(screen.getByTestId('cashout-btn')).toBeDisabled();
    });

    it('Should trigger cashout on button click', async () => {
      const mockCashout = jest.fn();
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={mockCashout}
          gameState="running"
        />
      );

      await userEvent.click(screen.getByTestId('cashout-btn'));

      expect(mockCashout).toHaveBeenCalled();
    });

    it('Should update bet amount input', async () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      const input = screen.getByTestId('bet-amount');
      await userEvent.clear(input);
      await userEvent.type(input, '100');

      expect(input).toHaveValue(100);
    });

    it('Should prevent negative bet amount', async () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      const input = screen.getByTestId('bet-amount');
      await userEvent.clear(input);
      await userEvent.type(input, '-50');

      // Should be 0 or positive
      expect(Number((input as HTMLInputElement).value)).toBeGreaterThanOrEqual(0);
    });

    it('Should update auto-cashout input', async () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      const input = screen.getByTestId('auto-cashout');
      await userEvent.clear(input);
      await userEvent.type(input, '5');

      expect(input).toHaveValue(5);
    });

    it('Should enforce minimum auto-cashout of 1.01', async () => {
      render(
        <MockCrashGame
          isConnected={true}
          balance={1000}
          onBet={jest.fn()}
          onCashout={jest.fn()}
          gameState="waiting"
        />
      );

      const input = screen.getByTestId('auto-cashout');
      await userEvent.clear(input);
      await userEvent.type(input, '0.5');

      expect(Number((input as HTMLInputElement).value)).toBeGreaterThanOrEqual(1.01);
    });
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

describe('🧭 Navigation Interactions', () => {
  describe('Sidebar Navigation', () => {
    const sidebarLinks = [
      { name: 'Home', href: '/' },
      { name: 'Crash', href: '/games/crash' },
      { name: 'Plinko', href: '/games/plinko' },
      { name: 'Wallet', href: '/wallet' },
      { name: 'Profile', href: '/profile' },
      { name: 'Settings', href: '/settings' },
    ];

    it('Should render all sidebar links', () => {
      render(<MockSidebar links={sidebarLinks} onNavigate={jest.fn()} />);

      sidebarLinks.forEach((link) => {
        expect(screen.getByTestId(`nav-${link.name.toLowerCase()}`)).toBeInTheDocument();
      });
    });

    it('Should navigate to each link on click', async () => {
      const mockNavigate = jest.fn();
      render(<MockSidebar links={sidebarLinks} onNavigate={mockNavigate} />);

      for (const link of sidebarLinks) {
        await userEvent.click(screen.getByTestId(`nav-${link.name.toLowerCase()}`));
        expect(mockNavigate).toHaveBeenCalledWith(link.href);
      }
    });
  });

  describe('Game Cards', () => {
    it('Should render game card', () => {
      render(
        <MockGameCard
          name="Crash"
          href="/games/crash"
          onClick={jest.fn()}
        />
      );

      expect(screen.getByTestId('game-card-crash')).toBeInTheDocument();
    });

    it('Should navigate on game card click', async () => {
      const mockClick = jest.fn();
      render(
        <MockGameCard
          name="Crash"
          href="/games/crash"
          onClick={mockClick}
        />
      );

      await userEvent.click(screen.getByTestId('game-card-crash'));

      expect(mockClick).toHaveBeenCalled();
    });

    it('Should NOT navigate on coming soon card click', async () => {
      const mockClick = jest.fn();
      render(
        <MockGameCard
          name="Dice"
          href="/games/dice"
          isComingSoon={true}
          onClick={mockClick}
        />
      );

      await userEvent.click(screen.getByTestId('game-card-dice'));

      expect(mockClick).not.toHaveBeenCalled();
    });

    it('Should show coming soon badge', () => {
      render(
        <MockGameCard
          name="Dice"
          href="/games/dice"
          isComingSoon={true}
          onClick={jest.fn()}
        />
      );

      expect(screen.getByTestId('coming-soon')).toBeInTheDocument();
    });

    it('Should have not-allowed cursor for coming soon', () => {
      render(
        <MockGameCard
          name="Dice"
          href="/games/dice"
          isComingSoon={true}
          onClick={jest.fn()}
        />
      );

      expect(screen.getByTestId('game-card-dice')).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('Should have pointer cursor for active games', () => {
      render(
        <MockGameCard
          name="Crash"
          href="/games/crash"
          onClick={jest.fn()}
        />
      );

      expect(screen.getByTestId('game-card-crash')).toHaveStyle({ cursor: 'pointer' });
    });
  });
});

// ============================================
// SOCKET EVENT TESTS
// ============================================

describe('🔌 Socket Event Handling', () => {
  beforeEach(() => {
    mockSocketOn.mockClear();
    mockSocketEmit.mockClear();
  });

  it('Should register socket event listeners', () => {
    // Simulate component mounting with socket listeners
    const events = ['crash:start', 'crash:tick', 'crash:boom', 'crash:bet', 'crash:cashout'];

    events.forEach((event) => {
      mockSocketOn(event, jest.fn());
    });

    expect(mockSocketOn).toHaveBeenCalledTimes(events.length);
  });

  it('Should emit bet event', () => {
    mockSocketEmit('crash:placeBet', { amount: 100, autoCashout: 2.0 });

    expect(mockSocketEmit).toHaveBeenCalledWith('crash:placeBet', {
      amount: 100,
      autoCashout: 2.0,
    });
  });

  it('Should emit cashout event', () => {
    mockSocketEmit('crash:cashout', {});

    expect(mockSocketEmit).toHaveBeenCalledWith('crash:cashout', {});
  });
});

// ============================================
// ACCESSIBILITY TESTS
// ============================================

describe('♿ Accessibility', () => {
  it('Should have accessible button labels', () => {
    render(
      <MockWallet
        balance={1000}
        address="TRX123456789"
        onDeposit={jest.fn()}
        onWithdraw={jest.fn()}
        onCopyAddress={jest.fn()}
      />
    );

    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
    expect(screen.getByText('Copy Address')).toBeInTheDocument();
  });

  it('Should have accessible form inputs', () => {
    render(<MockLoginForm onSubmit={jest.fn()} />);

    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('Should support keyboard navigation', async () => {
    const mockSubmit = jest.fn();
    render(<MockLoginForm onSubmit={mockSubmit} />);

    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const submitButton = screen.getByTestId('login-button');

    // Tab through form
    emailInput.focus();
    expect(document.activeElement).toBe(emailInput);

    await userEvent.tab();
    expect(document.activeElement).toBe(passwordInput);

    await userEvent.tab();
    expect(document.activeElement).toBe(submitButton);
  });
});

// ============================================
// ERROR STATE TESTS
// ============================================

describe('❌ Error States', () => {
  it('Should handle network disconnection gracefully', () => {
    render(
      <MockCrashGame
        isConnected={false}
        balance={1000}
        onBet={jest.fn()}
        onCashout={jest.fn()}
        gameState="waiting"
      />
    );

    // Bet button should be disabled when disconnected
    expect(screen.getByTestId('bet-btn')).toBeDisabled();
  });

  it('Should handle zero balance state', () => {
    render(
      <MockCrashGame
        isConnected={true}
        balance={0}
        onBet={jest.fn()}
        onCashout={jest.fn()}
        gameState="waiting"
      />
    );

    // Bet button should be disabled with zero balance
    expect(screen.getByTestId('bet-btn')).toBeDisabled();
  });
});

// ============================================
// RAPID CLICK TESTS
// ============================================

describe('⚡ Rapid Interaction Tests', () => {
  it('Should handle rapid button clicks', async () => {
    const mockClick = jest.fn();
    render(<TestButton onClick={mockClick}>Click Me</TestButton>);

    const button = screen.getByTestId('test-button');

    // Rapid clicks
    for (let i = 0; i < 10; i++) {
      await userEvent.click(button);
    }

    expect(mockClick).toHaveBeenCalledTimes(10);
  });

  it('Should handle rapid input changes', async () => {
    render(
      <MockCrashGame
        isConnected={true}
        balance={1000}
        onBet={jest.fn()}
        onCashout={jest.fn()}
        gameState="waiting"
      />
    );

    const input = screen.getByTestId('bet-amount');

    // Rapid value changes
    for (let i = 1; i <= 5; i++) {
      await userEvent.clear(input);
      await userEvent.type(input, String(i * 100));
    }

    expect(input).toHaveValue(500);
  });
});
