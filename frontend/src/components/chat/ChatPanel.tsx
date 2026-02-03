'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  role: 'ADMIN' | 'MODERATOR' | 'VIP' | 'USER';
  message: string;
  timestamp: Date;
}

interface ChatPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isVisible = true, onClose }) => {
  const { socket, isConnected } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Role colors
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'text-red-500';
      case 'MODERATOR':
        return 'text-purple-500';
      case 'VIP':
        return 'text-yellow-500';
      default:
        return 'text-white';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded mr-1">ADMIN</span>;
      case 'MODERATOR':
        return <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded mr-1">MOD</span>;
      case 'VIP':
        return <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded mr-1">VIP</span>;
      default:
        return null;
    }
  };

  // Join chat room on mount
  useEffect(() => {
    if (socket && isConnected && !isJoined) {
      socket.emit('chat:join', { room: 'global' });
      setIsJoined(true);

      // Request chat history
      socket.emit('chat:history', { room: 'global', limit: 50 });
    }
  }, [socket, isConnected, isJoined]);

  // Listen for chat events
  useEffect(() => {
    if (!socket) return;

    // New message received
    const handleMessage = (data: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), { ...data, timestamp: new Date(data.timestamp) }]);
    };

    // Chat history received
    const handleHistory = (data: { messages: ChatMessage[] }) => {
      setMessages(data.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
    };

    // System message
    const handleSystem = (data: { message: string }) => {
      setMessages((prev) => [
        ...prev.slice(-99),
        {
          id: `sys-${Date.now()}`,
          userId: 'system',
          username: 'System',
          role: 'ADMIN',
          message: data.message,
          timestamp: new Date(),
        },
      ]);
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:history', handleHistory);
    socket.on('chat:system', handleSystem);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:history', handleHistory);
      socket.off('chat:system', handleSystem);
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMessage = () => {
    if (!inputValue.trim() || !socket || !isAuthenticated) return;

    socket.emit('chat:send', {
      room: 'global',
      message: inputValue.trim(),
    });

    setInputValue('');
    inputRef.current?.focus();
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full bg-bg-card rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-semibold text-white">Live Chat</h3>
          <span className="text-xs text-text-secondary">({messages.length})</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors lg:hidden"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
        {messages.length === 0 ? (
          <div className="text-center text-text-secondary text-sm py-8">
            No messages yet. Be the first to chat!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`group ${msg.userId === user?.id ? 'text-right' : ''}`}
            >
              <div
                className={`inline-block max-w-[85%] ${
                  msg.userId === 'system'
                    ? 'bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-center w-full'
                    : msg.userId === user?.id
                    ? 'bg-accent-primary/20 text-white'
                    : 'bg-white/5 text-white'
                } rounded-lg px-3 py-2`}
              >
                {msg.userId !== 'system' && (
                  <div className="flex items-center gap-1 mb-1">
                    {getRoleBadge(msg.role)}
                    <span className={`text-xs font-medium ${getRoleColor(msg.role)}`}>
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )}
                <p className="text-sm break-words">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        {isAuthenticated ? (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              maxLength={200}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || !isConnected}
              className="px-4 py-2 bg-accent-primary text-black font-medium rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-glow-cyan-sm hover:shadow-glow-cyan"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <a href="/login" className="text-accent-primary text-sm hover:underline">
              Login to chat
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
