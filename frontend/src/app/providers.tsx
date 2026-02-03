'use client';

import { ReactNode } from 'react';
import { SocketProvider } from '@/contexts/SocketContext';
import { AuthProvider } from '@/contexts/AuthContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SocketProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SocketProvider>
  );
}
