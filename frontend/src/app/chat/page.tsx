'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  isSystem: boolean;
  createdAt: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch chat messages from API
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/messages`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        const sentMessage = await response.json();
        setMessages([...messages, sentMessage]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">💬 Live Chat</h1>
          <p className="text-slate-400">Connect with other players</p>
        </div>

        {/* Chat Container */}
        <div className="bg-slate-800/50 rounded-2xl backdrop-blur overflow-hidden flex flex-col h-[calc(100vh-250px)]">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="text-center text-slate-400 py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-lg">No messages yet</p>
                <p className="text-sm mt-2">Be the first to say something!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${
                    msg.isSystem ? 'justify-center' : msg.userId === user?.id ? 'flex-row-reverse' : ''
                  }`}
                >
                  {msg.isSystem ? (
                    <div className="bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-lg text-sm">
                      🔔 {msg.message}
                    </div>
                  ) : (
                    <>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        msg.userId === user?.id ? 'bg-cyan-500' : 'bg-purple-500'
                      }`}>
                        {msg.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className={`flex-1 max-w-md ${msg.userId === user?.id ? 'text-right' : ''}`}>
                        <div className="text-slate-400 text-xs mb-1">
                          {msg.username} • {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                        <div className={`rounded-lg px-4 py-2 inline-block ${
                          msg.userId === user?.id 
                            ? 'bg-cyan-500 text-white' 
                            : 'bg-slate-700 text-white'
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-700 p-4">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-cyan-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send 📤
              </button>
            </form>
            <div className="text-slate-500 text-xs mt-2">
              {newMessage.length}/500 characters
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
