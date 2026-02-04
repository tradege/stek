'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Socket.io server URL
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const SOCKET_NAMESPACE = '/crash';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  connectionError: string | null;
  connect: (token?: string) => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  connectionError: null,
  connect: () => {},
  disconnect: () => {},
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

  const connect = (token?: string) => {
    // Prevent double connection
    if (connectingRef.current) {
      console.log('[Socket] Already connecting, skipping...');
      return;
    }
    
    if (socketRef.current?.connected) {
      console.log('[Socket] Already connected');
      return;
    }
    
    connectingRef.current = true;
    
    // Get token from parameter or localStorage
    const authToken = token || localStorage.getItem('auth_token');
    
    console.log('[Socket] Connecting to:', SOCKET_URL + SOCKET_NAMESPACE);
    
    const newSocket = io(SOCKET_URL + SOCKET_NAMESPACE, {
      transports: ['websocket'],
      auth: authToken ? { token: authToken } : undefined,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      forceNew: false,
    });
    
    socketRef.current = newSocket;

    // Connection events
    newSocket.on('connect', () => {
      console.log('[Socket] Connected! ID:', newSocket.id);
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
      }
      connectingRef.current = false;
      
      // Join the crash game room
      newSocket.emit('join:room', { room: 'crash' });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      if (mountedRef.current) {
        setIsConnected(false);
        setIsAuthenticated(false);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      if (mountedRef.current) {
        setConnectionError(error.message);
        setIsConnected(false);
      }
      connectingRef.current = false;
    });

    // Authentication response
    newSocket.on('auth:success', (data) => {
      console.log('[Socket] Authenticated:', data);
      if (mountedRef.current) {
        setIsAuthenticated(true);
      }
    });

    newSocket.on('auth:error', (error) => {
      console.error('[Socket] Auth error:', error);
      if (mountedRef.current) {
        setIsAuthenticated(false);
        setConnectionError(error.message || 'Authentication failed');
      }
    });

    // Room join confirmation
    newSocket.on('room:joined', (data) => {
      console.log('[Socket] Joined room:', data.room);
    });

    if (mountedRef.current) {
      setSocket(newSocket);
    }
  };

  const disconnect = () => {
    connectingRef.current = false;
    if (socketRef.current) {
      console.log('[Socket] Disconnecting...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (mountedRef.current) {
      setSocket(null);
      setIsConnected(false);
      setIsAuthenticated(false);
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isAuthenticated,
        connectionError,
        connect,
        disconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
