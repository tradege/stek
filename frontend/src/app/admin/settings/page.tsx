'use client';

import { Settings } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure site settings and preferences</p>
      </div>

      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-12 text-center">
        <Settings className="w-16 h-16 text-[#1475e1] mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Site Configuration</h3>
        <p className="text-gray-400">Coming soon - Configure site settings and preferences</p>
      </div>
    </div>
  );
}
