'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';

export function useProtectedNav() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { openLogin } = useModal();

  const handleProtectedNav = (path: string, onClose?: () => void) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    router.push(path);
    if (onClose) onClose();
  };

  return { handleProtectedNav };
}
