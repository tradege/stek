'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import ChatPanel from '@/components/chat/ChatPanel';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * MainLayout - The primary layout wrapper for the casino
 * Includes: Sidebar (left), Header (top), Main Content Area, Footer, Chat (right)
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
    <div className="min-h-screen bg-bg-main text-text-accent-primary">
      {/* Overlay for Sidebar (mobile) or Chat (all viewports) */}
      {((isSidebarOpen && isMobile) || isChatOpen) && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
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
        <div className="flex-1 flex flex-col">
          {/* Main Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>

          {/* Footer - only on desktop */}
          <div className="hidden lg:block">
            <Footer />
          </div>
        </div>
      </div>

      {/* Chat Panel - Slide-in from Right (all viewports) */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-bg-card border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ChatPanel isVisible={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>


    </div>
  );
};

export default MainLayout;
