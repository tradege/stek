'use client';

import { Gamepad2 } from 'lucide-react';

export default function AdminGames() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Game Control</h1>
        <p className="text-gray-400">Manage games, RTP, and house edge settings</p>
      </div>

      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-12 text-center">
        <Gamepad2 className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Game Control Panel</h3>
        <p className="text-gray-400">Coming soon - Manage game settings, RTP, and house edge</p>
      </div>
    </div>
  );
}
