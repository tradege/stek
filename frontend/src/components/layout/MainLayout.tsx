'use client';
import React, { useState, useEffect, ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import ChatPanel from '@/components/chat/ChatPanel';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * MainLayout - The primary layout wrapper for the casino
 * Includes: Sidebar (left), Header (top), Main Content Area, Chat (right)
 * Fully responsive with mobile hamburger menu and chat toggle
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
        setIsChatOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar/chat when clicking outside on mobile
  const handleOverlayClick = () => {
    setIsSidebarOpen(false);
    setIsChatOpen(false);
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-primary">
      {/* Mobile Overlay */}
      {(isSidebarOpen || isChatOpen) && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={handleOverlayClick}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-bg-card border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </aside>

      {/* Main Content Area */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          onChatClick={() => setIsChatOpen(true)}
          isMobile={isMobile}
        />

        {/* Content + Chat */}
        <div className="flex-1 flex">
          {/* Main Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>

          {/* Chat Panel - Desktop (toggleable) */}
          <aside className={`hidden lg:block w-80 border-l border-white/10 p-4 transition-all duration-300 ${isChatOpen ? 'opacity-100' : 'lg:hidden'}`}>
            <ChatPanel />
          </aside>
        </div>
      </div>

      {/* Chat Panel - Mobile Slide-in */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-bg-card z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ChatPanel isVisible={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-bg-card border-t border-white/10 z-30 lg:hidden safe-area-bottom">
          <div className="flex items-center justify-around py-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex flex-col items-center gap-1 p-2 text-text-secondary hover:text-accent-primary transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-xs">Menu</span>
            </button>

            <button className="flex flex-col items-center gap-1 p-2 text-accent-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs">Crash</span>
            </button>

            <button className="flex flex-col items-center gap-1 p-2 text-text-secondary hover:text-accent-primary transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs">Wallet</span>
            </button>

            <button
              onClick={() => setIsChatOpen(true)}
              className="flex flex-col items-center gap-1 p-2 text-text-secondary hover:text-accent-primary transition-colors relative"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-xs">Chat</span>
              {/* Notification dot */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full" />
            </button>
          </div>
        </nav>
      )}

      {/* Add padding for mobile bottom nav */}
      {isMobile && <div className="h-16" />}
    </div>
  );
};

export default MainLayout;
