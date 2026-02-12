'use client';

import React from 'react';
import LoginModal from '@/components/modals/LoginModal';
import RegisterModal from '@/components/modals/RegisterModal';
import WalletModal from '@/components/wallet/WalletModal';
import { useModal } from '@/contexts/ModalContext';

/**
 * GlobalModals - Renders all global modals (Login, Register, Wallet)
 * Must be placed inside ModalProvider and AuthProvider
 */
const GlobalModals: React.FC = () => {
  const { isWalletOpen, closeWallet } = useModal();

  return (
    <>
      <LoginModal />
      <RegisterModal />
      <WalletModal isOpen={isWalletOpen} onClose={closeWallet} />
    </>
  );
};

export default GlobalModals;
