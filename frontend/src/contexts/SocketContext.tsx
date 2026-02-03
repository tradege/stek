'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Socket.io server URL
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const SOCKET_NAMESPACE = '/casino';

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

  const connect = (token?: string) => {
    // Get token from parameter or localStorage
    const authToken = token || localStorage.getItem('auth_token');
    
    if (socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    console.log('[Socket] Connecting to:', SOCKET_URL + SOCKET_NAMESPACE);

    const newSocket = io(SOCKET_URL + SOCKET_NAMESPACE, {
      transports: ['websocket', 'polling'],
      auth: authToken ? { token: authToken } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('[Socket] Connected! ID:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      
      // Join the crash game room
      newSocket.emit('join:room', { room: 'crash' });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Authentication response
    newSocket.on('auth:success', (data) => {
      console.log('[Socket] Authenticated:', data);
      setIsAuthenticated(true);
    });

    newSocket.on('auth:error', (error) => {
      console.error('[Socket] Auth error:', error);
      setIsAuthenticated(false);
      setConnectionError(error.message || 'Authentication failed');
    });

    // Room join confirmation
    newSocket.on('room:joined', (data) => {
      console.log('[Socket] Joined room:', data.room);
    });

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socket) {
      console.log('[Socket] Disconnecting...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setIsAuthenticated(false);
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
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
