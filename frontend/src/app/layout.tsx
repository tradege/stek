import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from './providers';

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
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary-color: #00F0FF;
            --secondary-color: #131B2C;
            --accent-color: #00D46E;
            --danger-color: #FF385C;
            --bg-color: #0A0E17;
            --card-color: #131B2C;
            --primary-color-muted: rgba(0, 240, 255, 0.1);
            --danger-color-muted: rgba(255, 56, 92, 0.1);
            --accent-color-muted: rgba(0, 212, 110, 0.1);
            --glow-primary-sm: 0 0 10px rgba(0, 240, 255, 0.2);
            --glow-primary: 0 0 15px rgba(0, 240, 255, 0.3);
            --glow-primary-lg: 0 0 25px rgba(0, 240, 255, 0.4);
          }
        `}} />
      </head>
      <body className="bg-main text-text-accent-primary antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
