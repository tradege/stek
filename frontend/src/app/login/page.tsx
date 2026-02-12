'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModal } from '@/contexts/ModalContext';

export default function LoginPage() {
  const router = useRouter();
  const { openLogin } = useModal();

  useEffect(() => {
    // Redirect to home and open login modal
    router.replace('/');
    openLogin();
  }, [router, openLogin]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full" />
    </div>
  );
}
