'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isVIP: boolean;
}

interface ChatSidebarProps {
  isVisible: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ isVisible }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Join chat room and listen for messages
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join chat room
    socket.emit('join:chat');

    // Listen for chat messages
    const handleMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]); // Keep last 100 messages
    };

    const handleError = (err: { code: string; message: string }) => {
      if (err.code === 'RATE_LIMITED') {
        setError('Please wait before sending another message');
        setTimeout(() => setError(null), 2000);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('error', handleError);

    return () => {
      socket.emit('leave:chat');
      socket.off('chat:message', handleMessage);
      socket.off('error', handleError);
    };
  }, [socket, isConnected]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!socket || !newMessage.trim() || !isAuthenticated) return;
    
    socket.emit('chat:message', { message: newMessage.trim() });
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm">No messages yet</p>
            <p className="text-text-secondary/60 text-xs mt-1">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.userId === user?.id ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                msg.isVIP ? 'bg-accent-primary/20 text-accent-primary' : 'bg-white/10 text-text-secondary'
              }`}>
                {msg.username[0]?.toUpperCase()}
              </div>
              <div className={`max-w-[80%] ${msg.userId === user?.id ? 'text-right' : ''}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs font-medium ${msg.isVIP ? 'text-accent-primary' : 'text-text-secondary'}`}>
                    {msg.username}
                  </span>
                  {msg.isVIP && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                      VIP
                    </span>
                  )}
                  <span className="text-[10px] text-text-secondary/50">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="text-sm text-white/90 bg-white/5 rounded-lg px-2.5 py-1.5 inline-block">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-white/10">
        {isAuthenticated ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              maxLength={200}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-text-secondary/50 focus:outline-none focus:border-accent-primary/50 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-text-secondary text-xs">Login to chat</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
