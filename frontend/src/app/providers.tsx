'use client';
import { ReactNode } from 'react';
import { SocketProvider } from '@/contexts/SocketContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SoundProvider } from '@/contexts/SoundContext';
interface ProvidersProps {
  children: ReactNode;
}
export function Providers({ children }: ProvidersProps) {
  return (
    <SocketProvider>
      <AuthProvider>
        <SoundProvider>
          {children}
        </SoundProvider>
      </AuthProvider>
    </SocketProvider>
  );
}
