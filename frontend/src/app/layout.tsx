import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { SocketProvider } from '@/contexts/SocketContext';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'StakePro - Crypto Casino',
  description: 'The ultimate crypto casino experience with provably fair games',
  keywords: ['crypto', 'casino', 'crash', 'bitcoin', 'gambling'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-main text-text-primary antialiased">
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
