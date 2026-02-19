'use client';

import { useAuth } from '@/hooks/useAuth';
import { Bell, LogOut, User } from 'lucide-react';

export default function AdminHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-bg-card border-b border-white/10 px-6 py-4 mb-6 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent-primary">Admin Control Panel</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your casino platform</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-text-secondary" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Info */}
          <div className="flex items-center gap-3 px-4 py-2 bg-bg-main rounded-lg border border-white/10">
            <div className="w-8 h-8 bg-accent-primary rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-black" />
            </div>
            <div className="text-sm">
              <p className="text-white font-medium">{user?.username || 'Admin'}</p>
              <p className="text-accent-primary text-xs">{user?.role || 'ADMIN'}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-text-secondary group-hover:text-red-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
