import React, { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

/**
 * MainLayout - The primary layout wrapper for the casino
 * Includes: Sidebar (left), Header (top), Main Content Area
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-main">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="ml-64">
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <main className="pt-16 min-h-screen">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
