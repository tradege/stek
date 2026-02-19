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
  // Verification Modal
  isVerificationOpen: boolean;
  verificationEmail: string;
  verificationPassword: string;
  openVerification: (email: string, password: string) => void;
  closeVerification: () => void;
  // Wallet Modal
  isWalletOpen: boolean;
  openWallet: (tab?: 'deposit' | 'withdraw') => void;
  closeWallet: () => void;
  walletDefaultTab: 'deposit' | 'withdraw';
  // Profile Modal
  isProfileOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
  // Statistics Modal
  isStatisticsOpen: boolean;
  openStatistics: () => void;
  closeStatistics: () => void;
  // VIP Program Modal
  isVIPOpen: boolean;
  openVIP: () => void;
  closeVIP: () => void;
  // Promotions Modal
  isPromotionsOpen: boolean;
  openPromotions: () => void;
  closePromotions: () => void;
  // Network Overview Modal
  isNetworkOpen: boolean;
  openNetwork: () => void;
  closeNetwork: () => void;
  // Wager Races Modal
  isWagerRacesOpen: boolean;
  openWagerRaces: () => void;
  closeWagerRaces: () => void;
  // Settings Modal
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  // Fairness Modal
  isFairnessOpen: boolean;
  openFairness: () => void;
  closeFairness: () => void;
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
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationPassword, setVerificationPassword] = useState('');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletDefaultTab, setWalletDefaultTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [isVIPOpen, setIsVIPOpen] = useState(false);
  const [isPromotionsOpen, setIsPromotionsOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isWagerRacesOpen, setIsWagerRacesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFairnessOpen, setIsFairnessOpen] = useState(false);

  // Helper to close all modals
  const closeAll = useCallback(() => {
    setIsLoginOpen(false);
    setIsRegisterOpen(false);
    setIsWalletOpen(false);
    setIsVerificationOpen(false);
    setIsProfileOpen(false);
    setIsStatisticsOpen(false);
    setIsVIPOpen(false);
    setIsPromotionsOpen(false);
    setIsNetworkOpen(false);
    setIsWagerRacesOpen(false);
    setIsSettingsOpen(false);
    setIsFairnessOpen(false);
  }, []);

  // Login
  const openLogin = useCallback(() => { closeAll(); setIsLoginOpen(true); }, [closeAll]);
  const closeLogin = useCallback(() => { setIsLoginOpen(false); }, []);

  // Register
  const openRegister = useCallback(() => { closeAll(); setIsRegisterOpen(true); }, [closeAll]);
  const closeRegister = useCallback(() => { setIsRegisterOpen(false); }, []);

  // Verification
  const openVerification = useCallback((email: string, password: string) => {
    closeAll();
    setVerificationEmail(email);
    setVerificationPassword(password);
    setIsVerificationOpen(true);
  }, [closeAll]);
  const closeVerification = useCallback(() => {
    setIsVerificationOpen(false);
    setVerificationEmail('');
    setVerificationPassword('');
  }, []);

  // Wallet
  const openWallet = useCallback((tab: 'deposit' | 'withdraw' = 'deposit') => {
    closeAll();
    setWalletDefaultTab(tab);
    setIsWalletOpen(true);
  }, [closeAll]);
  const closeWallet = useCallback(() => { setIsWalletOpen(false); }, []);

  // Profile
  const openProfile = useCallback(() => { closeAll(); setIsProfileOpen(true); }, [closeAll]);
  const closeProfile = useCallback(() => { setIsProfileOpen(false); }, []);

  // Statistics
  const openStatistics = useCallback(() => { closeAll(); setIsStatisticsOpen(true); }, [closeAll]);
  const closeStatistics = useCallback(() => { setIsStatisticsOpen(false); }, []);

  // VIP
  const openVIP = useCallback(() => { closeAll(); setIsVIPOpen(true); }, [closeAll]);
  const closeVIP = useCallback(() => { setIsVIPOpen(false); }, []);

  // Promotions
  const openPromotions = useCallback(() => { closeAll(); setIsPromotionsOpen(true); }, [closeAll]);
  const closePromotions = useCallback(() => { setIsPromotionsOpen(false); }, []);

  // Network
  const openNetwork = useCallback(() => { closeAll(); setIsNetworkOpen(true); }, [closeAll]);
  const closeNetwork = useCallback(() => { setIsNetworkOpen(false); }, []);

  // Wager Races
  const openWagerRaces = useCallback(() => { closeAll(); setIsWagerRacesOpen(true); }, [closeAll]);
  const closeWagerRaces = useCallback(() => { setIsWagerRacesOpen(false); }, []);

  // Settings
  const openSettings = useCallback(() => { closeAll(); setIsSettingsOpen(true); }, [closeAll]);
  const closeSettings = useCallback(() => { setIsSettingsOpen(false); }, []);

  // Fairness
  const openFairness = useCallback(() => { closeAll(); setIsFairnessOpen(true); }, [closeAll]);
  const closeFairness = useCallback(() => { setIsFairnessOpen(false); }, []);

  // Switch helpers
  const switchToRegister = useCallback(() => { setIsLoginOpen(false); setIsRegisterOpen(true); }, []);
  const switchToLogin = useCallback(() => { setIsRegisterOpen(false); setIsLoginOpen(true); }, []);

  return (
    <ModalContext.Provider
      value={{
        isLoginOpen, openLogin, closeLogin,
        isRegisterOpen, openRegister, closeRegister,
        isVerificationOpen, verificationEmail, verificationPassword, openVerification, closeVerification,
        isWalletOpen, openWallet, closeWallet, walletDefaultTab,
        isProfileOpen, openProfile, closeProfile,
        isStatisticsOpen, openStatistics, closeStatistics,
        isVIPOpen, openVIP, closeVIP,
        isPromotionsOpen, openPromotions, closePromotions,
        isNetworkOpen, openNetwork, closeNetwork,
        isWagerRacesOpen, openWagerRaces, closeWagerRaces,
        isSettingsOpen, openSettings, closeSettings,
        isFairnessOpen, openFairness, closeFairness,
        switchToRegister, switchToLogin,
        isFairnessOpen, openFairness, closeFairness,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export default ModalContext;
