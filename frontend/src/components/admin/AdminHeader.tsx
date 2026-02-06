'use client';

import { useAuth } from '@/hooks/useAuth';
import { Bell, LogOut, User } from 'lucide-react';

export default function AdminHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-[#1a2c38] border-b border-[#2f4553] px-6 py-4 mb-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1475e1]">Admin Control Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your casino platform</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 hover:bg-[#2f4553] rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Info */}
          <div className="flex items-center gap-3 px-4 py-2 bg-[#0f212e] rounded-lg border border-[#2f4553]">
            <div className="w-8 h-8 bg-[#1475e1] rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-[#0f212e]" />
            </div>
            <div className="text-sm">
              <p className="text-white font-medium">{user?.username || 'Admin'}</p>
              <p className="text-[#1475e1] text-xs">{user?.role || 'ADMIN'}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
