'use client';
import React from 'react';
import LoginModal from './LoginModal';
import RegisterModal from './RegisterModal';
import VerificationModal from './VerificationModal';
import WalletModal from '@/components/wallet/WalletModal';
import ProfileModal from './ProfileModal';
import StatisticsModal from './StatisticsModal';
import VIPProgramModal from './VIPProgramModal';
import PromotionsModal from './PromotionsModal';
import NetworkOverviewModal from './NetworkOverviewModal';
import WagerRacesModal from './WagerRacesModal';
import SettingsModal from './SettingsModal';
import FairnessModal from './FairnessModal';
import { useModal } from '@/contexts/ModalContext';

const GlobalModals: React.FC = () => {
  const {
    isWalletOpen, closeWallet,
    isProfileOpen, closeProfile,
    isStatisticsOpen, closeStatistics,
    isVIPOpen, closeVIP,
    isPromotionsOpen, closePromotions,
    isNetworkOpen, closeNetwork,
    isWagerRacesOpen, closeWagerRaces,
    isSettingsOpen, closeSettings,
    isFairnessOpen, closeFairness,
  } = useModal();

  return (
    <>
      <LoginModal />
      <RegisterModal />
      <VerificationModal />
      <WalletModal isOpen={isWalletOpen} onClose={closeWallet} />
      <ProfileModal isOpen={isProfileOpen} onClose={closeProfile} />
      <StatisticsModal isOpen={isStatisticsOpen} onClose={closeStatistics} />
      <VIPProgramModal isOpen={isVIPOpen} onClose={closeVIP} />
      <PromotionsModal isOpen={isPromotionsOpen} onClose={closePromotions} />
      <NetworkOverviewModal isOpen={isNetworkOpen} onClose={closeNetwork} />
      <WagerRacesModal isOpen={isWagerRacesOpen} onClose={closeWagerRaces} />
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
      <FairnessModal isOpen={isFairnessOpen} onClose={closeFairness} />
    </>
  );
};

export default GlobalModals;
