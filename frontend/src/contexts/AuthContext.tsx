'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSocket } from './SocketContext';
import config from '@/config/api';

// API Base URL
const API_URL = config.apiUrl;

// User type
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  // VIP System
  vipLevel: number;
  totalWagered: string;
  xp: number;
}

export interface UserBalance {
  currency: string;
  available: string;
  locked: string;
}

export interface UserWithBalance extends User {
  balance: UserBalance[];
}

// Auth context type
interface AuthContextType {
  user: UserWithBalance | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginDirect: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => {},
  loginDirect: async () => {},
  register: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserWithBalance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { connect, disconnect } = useSocket();

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Reconnect socket when token changes
  useEffect(() => {
    if (token) {
      // Reconnect socket with new token
      disconnect();
      setTimeout(() => connect(token), 100);
    }
  }, [token, connect, disconnect]);

    // Listen for balance update events from socket - update balance in real-time
  useEffect(() => {
    const handleBalanceUpdate = (event: CustomEvent<{ change: string; reason: string; newBalance?: string }>) => {
      
      // Update balance directly in state for instant UI update
      setUser(prevUser => {
        if (!prevUser) return prevUser;
        
        const change = parseFloat(event.detail.change);
        if (isNaN(change)) return prevUser;
        
        // Update USDT balance
        const updatedBalance = prevUser.balance.map(b => {
          if (b.currency === 'USDT') {
            const currentBalance = parseFloat(b.available);
            const newBalance = event.detail.newBalance 
              ? event.detail.newBalance 
              : (currentBalance + change).toFixed(2);
            return { ...b, available: newBalance };
          }
          return b;
        });
        
        return { ...prevUser, balance: updatedBalance };
      });
    };
    window.addEventListener('balance:update', handleBalanceUpdate as EventListener);
    
    return () => {
      window.removeEventListener('balance:update', handleBalanceUpdate as EventListener);
    };
  }, []);

  /**
   * Fetch current user data
   */
  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const userData = await response.json();
      setUser(userData);
      setError(null);
    } catch (err) {
      // '[Auth] Failed to fetch user:', err);
      // Clear invalid token
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login with email and password
   * Throws with { pendingVerification: true, email } if user needs verification
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Check if user needs email verification
      if (data.pendingVerification) {
        const verificationError: any = new Error('PENDING_VERIFICATION');
        verificationError.pendingVerification = true;
        verificationError.email = data.email || email;
        throw verificationError;
      }

      // Save token
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      
      // Fetch full user data with balance
      await fetchUser(data.token);
      
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Direct login - used after email verification to auto-login
   * Same as login but without the verification check (user just verified)
   */
  const loginDirect = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        await fetchUser(data.token);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register new user - does NOT auto-login since user must verify email first
   */
  const register = useCallback(async (
    username: string,
    email: string,
    password: string,
    referralCode?: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, referralCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // DO NOT auto-login - user must verify email first
      // The register page will redirect to /verify-email?email=...
      
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    disconnect();
  }, [disconnect]);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token);
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        loginDirect,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
