/**
 * ============================================================
 * BATTALION 24 — CORE SYSTEM COVERAGE (Part A)
 * ============================================================
 * Section 1: AuthContext & useAuth — The Heart
 * Section 2: SocketContext & useSocket — The Nervous System
 *
 * Total: ~27 tests
 * ============================================================
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================
// GLOBAL MOCKS
// ============================================================

jest.mock('@/config/api', () => ({
  __esModule: true,
  default: {
    apiUrl: 'http://localhost:3000',
    socketUrl: 'http://localhost:3000',
  },
  config: {
    apiUrl: 'http://localhost:3000',
    socketUrl: 'http://localhost:3000',
  },
}));

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
  connected: false,
  id: 'mock-socket-id',
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((i: number) => Object.keys(store)[i] || null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ============================================================
// SECTION 1: AuthContext & useAuth — THE HEART
// ============================================================

describe('🫀 Section 1: AuthContext & useAuth — The Heart', () => {
  let AuthProvider: any;
  let useAuth: any;
  let SocketProvider: any;

  beforeAll(() => {
    const authModule = require('@/contexts/AuthContext');
    AuthProvider = authModule.AuthProvider;
    useAuth = authModule.useAuth;
    const socketModule = require('@/contexts/SocketContext');
    SocketProvider = socketModule.SocketProvider;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  const TestConsumer = () => {
    const auth = useAuth();
    return (
      <div>
        <span data-testid="is-authenticated">{String(auth.isAuthenticated)}</span>
        <span data-testid="is-loading">{String(auth.isLoading)}</span>
        <span data-testid="user-email">{auth.user?.email || 'none'}</span>
        <span data-testid="user-role">{auth.user?.role || 'none'}</span>
        <span data-testid="token">{auth.token || 'none'}</span>
        <span data-testid="error">{auth.error || 'none'}</span>
        <button data-testid="login-btn" onClick={() => auth.login('test@test.com', 'password123').catch(() => {})}>Login</button>
        <button data-testid="register-btn" onClick={() => auth.register('testuser', 'test@test.com', 'password123', 'REF123').catch(() => {})}>Register</button>
        <button data-testid="logout-btn" onClick={() => auth.logout()}>Logout</button>
        <button data-testid="refresh-btn" onClick={() => auth.refreshUser()}>Refresh</button>
      </div>
    );
  };

  const renderWithProviders = () => {
    return render(
      <SocketProvider>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </SocketProvider>
    );
  };

  const mockUserResponse = (overrides = {}) => ({
    id: 'user-1',
    username: 'testuser',
    email: 'test@test.com',
    role: 'PLAYER',
    status: 'ACTIVE',
    displayName: null,
    avatarUrl: null,
    createdAt: '2025-01-01',
    vipLevel: 0,
    totalWagered: '0',
    xp: 0,
    balance: [{ currency: 'USDT', available: '100.00', locked: '0' }],
    ...overrides,
  });

  describe('1.1 Initial State', () => {
    test('should start with unauthenticated state when no token in localStorage', async () => {
      // No token in localStorage => no fetch on mount
      localStorageMock.getItem.mockReturnValue(null);
      renderWithProviders();
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      });
      expect(screen.getByTestId('user-email').textContent).toBe('none');
      expect(screen.getByTestId('token').textContent).toBe('none');
    });

    test('should auto-fetch user when token exists in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('existing-token');
      // This mock will be consumed by the useEffect on mount calling fetchUser
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse(),
      });
      renderWithProviders();
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });
      expect(screen.getByTestId('user-email').textContent).toBe('test@test.com');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/auth/me',
        expect.objectContaining({
          headers: { Authorization: 'Bearer existing-token' },
        })
      );
    });

    test('should clear invalid token when /auth/me fails', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });
      renderWithProviders();
      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('1.2 Login Flow', () => {
    test('should login successfully and store token', async () => {
      // No token on mount => no initial fetch
      localStorageMock.getItem.mockReturnValue(null);

      // Use mockImplementation to handle sequential calls properly
      let callCount = 0;
      mockFetch.mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/auth/login')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ token: 'new-jwt-token', user: { id: 'user-1' } }),
          });
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse({ vipLevel: 2 }),
          });
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      renderWithProviders();

      // Wait for initial load to complete (no token, so isLoading becomes false quickly)
      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      // Click login
      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
      });

      // Wait for login + fetchUser to complete
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      }, { timeout: 5000 });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-jwt-token');
      expect(screen.getByTestId('user-email').textContent).toBe('test@test.com');
    });

    test('should handle login failure and set error', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/auth/login')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ message: 'Invalid credentials' }),
          });
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).not.toBe('none');
      }, { timeout: 3000 });
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    test('should handle network error during login', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/auth/login')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Network error');
      }, { timeout: 3000 });
    });
  });

  describe('1.3 Register Flow', () => {
    test('should register successfully with referral code', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/auth/register')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ token: 'register-token' }),
          });
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse({ id: 'new-user' }),
          });
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('register-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      }, { timeout: 5000 });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'register-token');
    });

    test('should handle registration failure', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/auth/register')) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ message: 'Email already exists' }),
          });
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('register-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).not.toBe('none');
      }, { timeout: 3000 });
    });
  });

  describe('1.4 Logout Flow', () => {
    test('should logout: clear token, reset user, disconnect socket', async () => {
      localStorageMock.getItem.mockReturnValue('existing-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse(),
      });
      renderWithProviders();
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });
      act(() => {
        fireEvent.click(screen.getByTestId('logout-btn'));
      });
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(screen.getByTestId('user-email').textContent).toBe('none');
      expect(screen.getByTestId('token').textContent).toBe('none');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('1.5 Refresh User', () => {
    test('should refresh user data when token exists', async () => {
      localStorageMock.getItem.mockReturnValue('existing-token');

      let fetchCallCount = 0;
      mockFetch.mockImplementation((url: string) => {
        fetchCallCount++;
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockUserResponse({ vipLevel: fetchCallCount > 1 ? 1 : 0 }),
          });
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('refresh-btn'));
      });

      expect(fetchCallCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('1.6 isAuthenticated Derived State', () => {
    test('isAuthenticated is true when user object exists', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse(),
      });
      renderWithProviders();
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });
    });

    test('isAuthenticated is false when user is null', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      renderWithProviders();
      await waitFor(() => {
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });
  });
});

// ============================================================
// SECTION 2: SocketContext & useSocket — THE NERVOUS SYSTEM
// ============================================================

describe('🧠 Section 2: SocketContext & useSocket — The Nervous System', () => {
  let SocketProvider: any;
  let useSocket: any;
  const { io: mockIo } = require('socket.io-client');

  beforeAll(() => {
    const socketModule = require('@/contexts/SocketContext');
    SocketProvider = socketModule.SocketProvider;
    useSocket = socketModule.useSocket;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockSocket.connected = false;
    mockSocket.on.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.disconnect.mockReset();
    mockSocket.removeAllListeners.mockReset();
    mockIo.mockReturnValue(mockSocket);
  });

  const TestSocketConsumer = () => {
    const { socket, isConnected, isAuthenticated, connectionError, connect, disconnect, reconnectWithToken } = useSocket();
    return (
      <div>
        <span data-testid="socket-connected">{String(isConnected)}</span>
        <span data-testid="socket-authenticated">{String(isAuthenticated)}</span>
        <span data-testid="socket-error">{connectionError || 'none'}</span>
        <span data-testid="socket-exists">{String(!!socket)}</span>
        <button data-testid="connect-btn" onClick={() => connect('test-token')}>Connect</button>
        <button data-testid="disconnect-btn" onClick={() => disconnect()}>Disconnect</button>
        <button data-testid="reconnect-btn" onClick={() => reconnectWithToken('new-token')}>Reconnect</button>
      </div>
    );
  };

  describe('2.1 Connection Lifecycle', () => {
    test('should auto-connect on mount', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      expect(mockIo).toHaveBeenCalled();
      expect(screen.getByTestId('socket-exists').textContent).toBe('true');
    });

    test('should connect with correct namespace /casino', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const callArgs = mockIo.mock.calls[0];
      expect(callArgs[0]).toContain('/casino');
    });

    test('should register connect, disconnect, and error event handlers', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const registeredEvents = mockSocket.on.mock.calls.map((c: any[]) => c[0]);
      expect(registeredEvents).toContain('connect');
      expect(registeredEvents).toContain('disconnect');
      expect(registeredEvents).toContain('connect_error');
    });

    test('should register auth:success and auth:error handlers', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const registeredEvents = mockSocket.on.mock.calls.map((c: any[]) => c[0]);
      expect(registeredEvents).toContain('auth:success');
      expect(registeredEvents).toContain('auth:error');
      expect(registeredEvents).toContain('auth:guest');
    });

    test('should set isConnected=true when connect event fires', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const connectCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'connect');
      act(() => { connectCall[1](); });
      expect(screen.getByTestId('socket-connected').textContent).toBe('true');
    });

    test('should set isConnected=false when disconnect event fires', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const connectCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'connect');
      act(() => { connectCall[1](); });
      const disconnectCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'disconnect');
      act(() => { disconnectCall[1]('io client disconnect'); });
      expect(screen.getByTestId('socket-connected').textContent).toBe('false');
    });

    test('should emit crash:join on connect', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const connectCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'connect');
      act(() => { connectCall[1](); });
      expect(mockSocket.emit).toHaveBeenCalledWith('crash:join', { room: 'crash' });
    });
  });

  describe('2.2 Authentication Events', () => {
    test('should set isAuthenticated=true on auth:success', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const authSuccessCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'auth:success');
      act(() => { authSuccessCall[1]({ userId: 'user-1' }); });
      expect(screen.getByTestId('socket-authenticated').textContent).toBe('true');
    });

    test('should set isAuthenticated=false on auth:error', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const authErrorCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'auth:error');
      act(() => { authErrorCall[1]({ message: 'Invalid token' }); });
      expect(screen.getByTestId('socket-authenticated').textContent).toBe('false');
    });

    test('should set isAuthenticated=false on auth:guest', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const authGuestCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'auth:guest');
      act(() => { authGuestCall[1](); });
      expect(screen.getByTestId('socket-authenticated').textContent).toBe('false');
    });
  });

  describe('2.3 Connection Error Handling', () => {
    test('should set connectionError on connect_error', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const errorCall = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'connect_error');
      act(() => { errorCall[1]({ message: 'Connection refused' }); });
      expect(screen.getByTestId('socket-error').textContent).toBe('Connection refused');
      expect(screen.getByTestId('socket-connected').textContent).toBe('false');
    });
  });

  describe('2.4 Disconnect & Cleanup', () => {
    test('should disconnect socket on manual disconnect', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      act(() => { fireEvent.click(screen.getByTestId('disconnect-btn')); });
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('2.5 Reconnect with Token', () => {
    test('should disconnect old socket and create new one on reconnectWithToken', () => {
      jest.useFakeTimers();
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const initialCallCount = mockIo.mock.calls.length;
      act(() => { fireEvent.click(screen.getByTestId('reconnect-btn')); });
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(200); });
      expect(mockIo.mock.calls.length).toBeGreaterThan(initialCallCount);
      jest.useRealTimers();
    });
  });

  describe('2.6 Socket Configuration', () => {
    test('should use correct transport options', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const callArgs = mockIo.mock.calls[0];
      const options = callArgs[1];
      expect(options.transports).toEqual(['polling', 'websocket']);
      expect(options.reconnection).toBe(true);
      expect(options.forceNew).toBe(true);
    });

    test('should include siteId in auth payload', () => {
      render(<SocketProvider><TestSocketConsumer /></SocketProvider>);
      const callArgs = mockIo.mock.calls[0];
      const options = callArgs[1];
      expect(options.auth).toBeDefined();
      expect(options.auth.siteId).toBeDefined();
    });
  });
});
