'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ModalContextType {
  // Login Modal
  isLoginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  // Register Modal
  isRegisterOpen: boolean;
  openRegister: () => void;
  closeRegister: () => void;
  // Wallet Modal
  isWalletOpen: boolean;
  openWallet: (tab?: 'deposit' | 'withdraw') => void;
  closeWallet: () => void;
  walletDefaultTab: 'deposit' | 'withdraw';
  // Switch between Login <-> Register
  switchToRegister: () => void;
  switchToLogin: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletDefaultTab, setWalletDefaultTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Login
  const openLogin = useCallback(() => {
    setIsRegisterOpen(false);
    setIsWalletOpen(false);
    setIsLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setIsLoginOpen(false);
  }, []);

  // Register
  const openRegister = useCallback(() => {
    setIsLoginOpen(false);
    setIsWalletOpen(false);
    setIsRegisterOpen(true);
  }, []);

  const closeRegister = useCallback(() => {
    setIsRegisterOpen(false);
  }, []);

  // Wallet
  const openWallet = useCallback((tab: 'deposit' | 'withdraw' = 'deposit') => {
    setIsLoginOpen(false);
    setIsRegisterOpen(false);
    setWalletDefaultTab(tab);
    setIsWalletOpen(true);
  }, []);

  const closeWallet = useCallback(() => {
    setIsWalletOpen(false);
  }, []);

  // Switch helpers
  const switchToRegister = useCallback(() => {
    setIsLoginOpen(false);
    setIsRegisterOpen(true);
  }, []);

  const switchToLogin = useCallback(() => {
    setIsRegisterOpen(false);
    setIsLoginOpen(true);
  }, []);

  return (
    <ModalContext.Provider
      value={{
        isLoginOpen,
        openLogin,
        closeLogin,
        isRegisterOpen,
        openRegister,
        closeRegister,
        isWalletOpen,
        openWallet,
        closeWallet,
        walletDefaultTab,
        switchToRegister,
        switchToLogin,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export default ModalContext;
