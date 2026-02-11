'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import config from '@/config/api';

// Socket.io server URL
const SOCKET_URL = config.socketUrl;
const SOCKET_NAMESPACE = '/casino';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  connectionError: string | null;
  connect: (token?: string) => void;
  disconnect: () => void;
  reconnectWithToken: (token: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  connectionError: null,
  connect: () => {},
  disconnect: () => {},
  reconnectWithToken: () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Refs to prevent double connection in React Strict Mode
  const socketRef = useRef<Socket | null>(null);
  const connectingRef = useRef(false);
  const mountedRef = useRef(true);
  const currentTokenRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    connectingRef.current = false;
    
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    if (mountedRef.current) {
      setSocket(null);
      setIsConnected(false);
      setIsAuthenticated(false);
    }
  }, []);

  const connect = useCallback((token?: string) => {
    // Prevent double connection
    if (connectingRef.current) {
      return;
    }
    
    // Get token from parameter or localStorage
    const authToken = token || localStorage.getItem('auth_token');
    
    // If already connected with same token, skip
    if (socketRef.current?.connected && currentTokenRef.current === authToken) {
      return;
    }
    
    connectingRef.current = true;
    currentTokenRef.current = authToken;
    
    
    // Prepare auth payload - STANDARDIZED FORMAT with Bearer prefix
    const authPayload = authToken ? { token: `Bearer ${authToken}` } : undefined;
    
    const newSocket = io(SOCKET_URL + SOCKET_NAMESPACE, {
      transports: ['polling', 'websocket'], // Start with polling for reliability
      auth: authPayload,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: true, // Force new connection when token changes
    });
    
    socketRef.current = newSocket;

    // Connection events with DEBUG logging
    newSocket.on('connect', () => {
      
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
      }
      connectingRef.current = false;
      
      // Join the crash game room
      newSocket.emit('crash:join', { room: 'crash' });
    });

    newSocket.on('disconnect', (reason) => {
      
      if (mountedRef.current) {
        setIsConnected(false);
        // Don't reset isAuthenticated on temporary disconnect
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          setIsAuthenticated(false);
        }
      }
    });

    newSocket.on('connect_error', (error) => {
      // '[Socket] ⚠️ Connection error:', error.message);
      
      if (mountedRef.current) {
        setConnectionError(error.message);
        setIsConnected(false);
      }
      connectingRef.current = false;
    });

    // Authentication response - DEBUG
    newSocket.on('auth:success', (data) => {
      if (mountedRef.current) {
        setIsAuthenticated(true);
        setConnectionError(null);
      }
    });

    newSocket.on('auth:error', (error) => {
      // '[Socket] 🔐 Auth error:', error);
      // Don't disconnect on auth error - allow guest mode
      if (mountedRef.current) {
        setIsAuthenticated(false);
        // Only set error if it's critical
        if (error.critical) {
          setConnectionError(error.message || 'Authentication failed');
        }
      }
    });

    newSocket.on('auth:guest', () => {
      if (mountedRef.current) {
        setIsAuthenticated(false);
      }
    });

    // Room join confirmation
    newSocket.on('room:joined', (data) => {
    });
    // Game state events (debug listeners removed for production)
    if (mountedRef.current) {
      setSocket(newSocket);
    }
  }, []);

  // Reconnect with new token - FULL DISCONNECT AND RECONNECT
  const reconnectWithToken = useCallback((token: string) => {
    
    // Store new token
    currentTokenRef.current = token;
    
    // Full disconnect
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Reset state
    if (mountedRef.current) {
      setSocket(null);
      setIsConnected(false);
      setIsAuthenticated(false);
      setConnectionError(null);
    }
    
    // Reset connecting flag
    connectingRef.current = false;
    
    // Small delay before reconnecting
    setTimeout(() => {
      connect(token);
    }, 100);
  }, [connect]);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Listen for token changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          reconnectWithToken(e.newValue);
        } else {
          // Token removed - reconnect as guest
          disconnect();
          setTimeout(() => connect(), 100);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [reconnectWithToken, disconnect, connect]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isAuthenticated,
        connectionError,
        connect,
        disconnect,
        reconnectWithToken,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
