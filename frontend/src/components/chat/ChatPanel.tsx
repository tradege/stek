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
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded border border-red-500/30">ADMIN</span>;
      case 'MODERATOR':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-accent-primary/20 text-accent-primary rounded border border-accent-primary/30">MOD</span>;
      case 'VIP':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">VIP</span>;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'text-red-400';
      case 'MODERATOR':
        return 'text-accent-primary';
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
    <div className="flex flex-col h-full">
      {/* Header - Same style as Sidebar header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Chat icon box - same as Sidebar "S" logo box */}
          <div className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shadow-glow-cyan-sm">
            <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm tracking-tight">Live Chat</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-text-secondary">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-all duration-200 group"
            aria-label="Close chat"
          >
            <svg className="w-4 h-4 text-text-secondary group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Online Users Bar - Same style as Sidebar section headers */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/5">
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Chat Room</span>
      </div>

      {/* Messages Area - with custom scrollbar */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 mb-3 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/80 font-medium text-sm mb-1">No messages yet</p>
            <p className="text-text-secondary text-xs">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="group hover:bg-white/5 px-2.5 py-2 rounded-lg transition-all duration-150">
              <div className="flex items-start gap-2.5">
                {/* Avatar - same rounded style as sidebar nav icons */}
                <div className="w-7 h-7 rounded-lg bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center text-accent-primary text-xs font-bold flex-shrink-0">
                  {msg.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {getRoleBadge(msg.role)}
                    <span className={`font-semibold text-xs ${getRoleColor(msg.role)}`}>
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-text-secondary/50 ml-auto">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-white/80 text-[13px] leading-relaxed break-words">{msg.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Same border style as sidebar bottom */}
      <div className="flex-shrink-0 p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-text-secondary/40 focus:outline-none focus:ring-1 focus:ring-accent-primary/50 focus:border-accent-primary/30 transition-all duration-200"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="px-3 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-black rounded-lg font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
