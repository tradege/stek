'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  username: string;
  role: 'ADMIN' | 'MODERATOR' | 'VIP' | 'USER';
  message: string;
  timestamp: Date;
}

interface ChatPanelProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded mr-1">ADMIN</span>;
      case 'MODERATOR':
        return <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-[#1475e1] rounded mr-1">MOD</span>;
      case 'VIP':
        return <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded mr-1">VIP</span>;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'text-red-400';
      case 'MODERATOR':
        return 'text-[#1475e1]';
      case 'VIP':
        return 'text-yellow-400';
      default:
        return 'text-text-secondary';
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      username: 'You',
      role: 'USER',
      message: newMessage,
      timestamp: new Date(),
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[700px] bg-[#1a2c38]/75 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden transition-all duration-300">
      {/* Header - Professional Glass */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
          </div>
          <h3 className="font-bold text-white text-lg tracking-tight">Live Chat</h3>
          <span className="text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-full backdrop-blur-sm">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 group backdrop-blur-sm"
            aria-label="Close chat"
          >
            <svg className="w-5 h-5 text-text-secondary group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages Area - Transparent with subtle gradient */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-transparent via-black/5 to-transparent">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-[#1475e1]/20 to-[#1475e1]/5 flex items-center justify-center backdrop-blur-xl border border-white/10">
              <svg className="w-8 h-8 text-[#1475e1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">No messages yet</p>
            <p className="text-text-secondary text-sm">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="group hover:bg-white/5 p-3 rounded-xl transition-all duration-200 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1475e1] to-[#1475e1]/60 flex items-center justify-center text-white text-sm font-bold shadow-lg flex-shrink-0">
                  {msg.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getRoleBadge(msg.role)}
                    <span className={`font-semibold text-sm ${getRoleColor(msg.role)}`}>
                      {msg.username}
                    </span>
                    <span className="text-xs text-text-secondary/60">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-white/90 text-sm leading-relaxed break-words">{msg.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Professional Glass */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-gradient-to-r from-transparent via-white/5 to-transparent backdrop-blur-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 text-white placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-[#1475e1]/50 focus:border-[#1475e1]/50 transition-all duration-200"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="px-5 py-3 bg-gradient-to-r from-[#1475e1] to-[#1475e1]/80 hover:from-[#1475e1]/90 hover:to-[#1475e1]/70 text-white rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-[#1475e1]/20 backdrop-blur-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
