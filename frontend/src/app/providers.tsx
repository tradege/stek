'use client';
import { ReactNode } from 'react';
import { SocketProvider } from '@/contexts/SocketContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SoundProvider } from '@/contexts/SoundContext';
import { BrandingProvider } from '@/contexts/BrandingContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <BrandingProvider>
      <SocketProvider>
        <AuthProvider>
          <SoundProvider>
            {children}
          </SoundProvider>
        </AuthProvider>
      </SocketProvider>
    </BrandingProvider>
  );
}
