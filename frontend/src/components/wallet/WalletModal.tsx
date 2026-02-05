'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DepositAddress {
  currency: string;
  address: string;
  network: string;
  minDeposit: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000';

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { token, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Deposit state
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(null);
  const [txHash, setTxHash] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const currencies = ['USDT', 'BTC', 'ETH', 'SOL'];

  // Fetch deposit address when currency changes
  useEffect(() => {
    if (activeTab === 'deposit' && token) {
      fetchDepositAddress();
    }
  }, [selectedCurrency, activeTab, token]);

  const fetchDepositAddress = async () => {
    try {
      const response = await fetch(`${API_URL}/wallet/deposit-address/${selectedCurrency}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDepositAddress(data);
      }
    } catch (error) {
      console.error('Failed to fetch deposit address:', error);
    }
  };

  const handleDeposit = async () => {
    if (!txHash || !depositAmount) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/wallet/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          currency: selectedCurrency,
          txHash,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Deposit request submitted!' });
        setTxHash('');
        setDepositAmount('');
        refreshUser();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit deposit' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !walletAddress) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/wallet/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          currency: selectedCurrency,
          walletAddress,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Withdrawal request submitted!' });
        setWithdrawAmount('');
        setWalletAddress('');
        refreshUser();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit withdrawal' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setMessage({ type: 'success', text: '✓ Address copied to clipboard!' });
    setTimeout(() => {
      setMessage(null);
      setCopied(false);
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div data-testid="wallet-modal" className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        data-testid="wallet-backdrop"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-bg-card rounded-xl border border-white/10 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-bg-card z-10">
          <h2 data-testid="wallet-title" className="text-xl font-bold text-white">Wallet</h2>
          <button
            data-testid="wallet-close-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            data-testid="wallet-deposit-tab"
            onClick={() => { setActiveTab('deposit'); setMessage(null); }}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === 'deposit'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            Deposit
          </button>
          <button
            data-testid="wallet-withdraw-tab"
            onClick={() => { setActiveTab('withdraw'); setMessage(null); }}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === 'withdraw'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            Withdraw
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Currency Selector */}
          <div className="mb-6">
            <label className="block text-sm text-text-secondary mb-2">Select Currency</label>
            <div data-testid="currency-selector" className="flex gap-2">
              {currencies.map((currency) => (
                <button
                  key={currency}
                  data-testid={`currency-${currency.toLowerCase()}`}
                  onClick={() => setSelectedCurrency(currency)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                    selectedCurrency === currency
                      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary'
                      : 'bg-white/5 text-text-secondary border border-white/10 hover:border-white/30'
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div data-testid="wallet-message" className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {message.text}
            </div>
          )}

          {activeTab === 'deposit' ? (
            /* Deposit Tab */
            <div data-testid="deposit-content" className="space-y-4">
              {/* Deposit Address */}
              {depositAddress && (
                <div data-testid="deposit-address-section" className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-text-secondary">
                      {depositAddress.network} Address
                    </span>
                    <span data-testid="min-deposit" className="text-xs text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">
                      Min: {depositAddress.minDeposit} {selectedCurrency}
                    </span>
                  </div>
                  
                  {/* Real QR Code */}
                  <div data-testid="qr-code" className="flex justify-center mb-4">
                    <div className="p-3 bg-white rounded-xl shadow-lg">
                      <QRCodeSVG 
                        value={depositAddress.address} 
                        size={160} 
                        level="H"
                        includeMargin={true}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                  </div>
                  
                  {/* Address with Copy Button */}
                  <div className="space-y-2">
                    <label className="text-xs text-text-secondary">Deposit Address</label>
                    <div className="flex items-center gap-2 bg-bg-main p-3 rounded-lg border border-white/10">
                      <input
                        data-testid="deposit-address-input"
                        type="text"
                        value={depositAddress.address}
                        readOnly
                        className="flex-1 bg-transparent text-white font-mono text-sm outline-none truncate"
                      />
                      <button
                        data-testid="copy-address-btn"
                        onClick={() => copyToClipboard(depositAddress.address)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          copied 
                            ? 'bg-green-500 text-white' 
                            : 'bg-accent-primary text-black hover:bg-accent-primary/90'
                        }`}
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Network Warning */}
                  <div data-testid="network-warning" className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-400">
                      ⚠️ Only send <span className="font-bold">{selectedCurrency}</span> on the <span className="font-bold">{depositAddress.network}</span> network. Sending other assets may result in permanent loss.
                    </p>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Amount Sent</label>
                <input
                  data-testid="deposit-amount-input"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={`Enter ${selectedCurrency} amount`}
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* Transaction Hash Input */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Transaction Hash (TXID)</label>
                <input
                  data-testid="tx-hash-input"
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Paste your transaction hash here"
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none font-mono text-sm"
                />
              </div>

              {/* Submit Button */}
              <button
                data-testid="deposit-submit-btn"
                onClick={handleDeposit}
                disabled={isLoading || !txHash || !depositAmount}
                className="w-full py-4 bg-accent-primary text-black font-bold rounded-lg hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-cyan"
              >
                {isLoading ? 'Submitting...' : 'I Have Sent The Funds'}
              </button>

              <p className="text-xs text-text-secondary text-center">
                Deposits are verified manually and typically credited within 10 minutes.
              </p>
            </div>
          ) : (
            /* Withdraw Tab */
            <div data-testid="withdraw-content" className="space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Amount</label>
                <input
                  data-testid="withdraw-amount-input"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Enter ${selectedCurrency} amount`}
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Minimum withdrawal: {selectedCurrency === 'USDT' ? '20' : selectedCurrency === 'BTC' ? '0.001' : selectedCurrency === 'ETH' ? '0.01' : '0.5'} {selectedCurrency}
                </p>
              </div>

              {/* Wallet Address Input */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Your {selectedCurrency} Wallet Address</label>
                <input
                  data-testid="wallet-address-input"
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder={`Enter your ${selectedCurrency} address`}
                  className="w-full bg-bg-main px-4 py-3 rounded-lg text-white border border-white/10 focus:border-accent-primary focus:outline-none font-mono text-sm"
                />
              </div>

              {/* Network Info */}
              <div data-testid="withdraw-network-warning" className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  ⚠️ Make sure you're using the correct network:
                  <br />
                  <span className="font-bold">
                    {selectedCurrency === 'USDT' ? 'TRC20 (Tron)' : 
                     selectedCurrency === 'BTC' ? 'Bitcoin Network' :
                     selectedCurrency === 'ETH' ? 'ERC20 (Ethereum)' : 'Solana Network'}
                  </span>
                </p>
              </div>

              {/* Submit Button */}
              <button
                data-testid="withdraw-submit-btn"
                onClick={handleWithdraw}
                disabled={isLoading || !withdrawAmount || !walletAddress}
                className="w-full py-4 bg-accent-danger text-white font-bold rounded-lg hover:bg-accent-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Request Withdrawal'}
              </button>

              <p className="text-xs text-text-secondary text-center">
                Withdrawals are processed manually within 24 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
