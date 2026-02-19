'use client';
import { ReactNode } from 'react';
import { SocketProvider } from '@/contexts/SocketContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SoundProvider } from '@/contexts/SoundContext';
import { BrandingProvider, BrandConfig } from '@/contexts/BrandingContext';
import { ModalProvider } from '@/contexts/ModalContext';
import GlobalModals from '@/components/modals/GlobalModals';

interface ProvidersProps {
  children: ReactNode;
  initialBrandConfig?: BrandConfig | null;
}

export function Providers({ children, initialBrandConfig }: ProvidersProps) {
  return (
    <BrandingProvider initialConfig={initialBrandConfig || undefined}>
      <SocketProvider>
        <AuthProvider>
          <ModalProvider>
            <SoundProvider>
              {children}
              <GlobalModals />
            </SoundProvider>
          </ModalProvider>
        </AuthProvider>
      </SocketProvider>
    </BrandingProvider>
  );
}
