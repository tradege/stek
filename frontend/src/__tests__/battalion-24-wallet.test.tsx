/**
 * ============================================================
 * BATTALION 24 — CORE SYSTEM COVERAGE (Part B)
 * ============================================================
 * Section 3: WalletModal — The Wallet
 * ============================================================
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================
// MOCKS
// ============================================================

jest.mock('@/config/api', () => ({
  __esModule: true,
  default: {
    apiUrl: 'http://localhost:3000',
    socketUrl: 'http://localhost:3000',
  },
  config: {
    apiUrl: 'http://localhost:3000',
    socketUrl: 'http://localhost:3000',
  },
}));

const mockRefreshUser = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    refreshUser: mockRefreshUser,
  }),
}));

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code-svg" data-value={value}>QR:{value}</div>
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// ============================================================
// SECTION 3: WalletModal — THE WALLET
// ============================================================

describe('💰 Section 3: WalletModal — The Wallet', () => {
  let WalletModal: any;

  beforeAll(() => {
    WalletModal = require('@/components/wallet/WalletModal').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockRefreshUser.mockReset();
  });

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  const mockDepositAddress = (currency = 'USDT', address = 'TRC20-addr-123') => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currency,
        address,
        network: currency === 'USDT' ? 'TRC20' : currency,
        minDeposit: currency === 'USDT' ? 20 : 0.001,
      }),
    });
  };

  describe('3.1 Modal Visibility', () => {
    test('should render when isOpen=true', () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      expect(screen.getByTestId('wallet-modal')).toBeInTheDocument();
    });

    test('should NOT render when isOpen=false', () => {
      render(<WalletModal isOpen={false} onClose={jest.fn()} />);
      expect(screen.queryByTestId('wallet-modal')).not.toBeInTheDocument();
    });

    test('should display "Wallet" title', () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      expect(screen.getByTestId('wallet-title')).toHaveTextContent('Wallet');
    });

    test('should call onClose when close button clicked', () => {
      mockDepositAddress();
      const onClose = jest.fn();
      render(<WalletModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('wallet-close-btn'));
      expect(onClose).toHaveBeenCalled();
    });

    test('should call onClose when backdrop clicked', () => {
      mockDepositAddress();
      const onClose = jest.fn();
      render(<WalletModal isOpen={true} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('wallet-backdrop'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('3.2 Tab Switching', () => {
    test('should start on Deposit tab by default', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('deposit-content')).toBeInTheDocument();
      });
    });

    test('should switch to Withdraw tab when clicked', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
    });

    test('should switch back to Deposit tab', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
      mockDepositAddress();
      fireEvent.click(screen.getByTestId('wallet-deposit-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('deposit-content')).toBeInTheDocument();
      });
    });
  });

  describe('3.3 Currency Selection', () => {
    test('should display all 4 currencies: USDT, BTC, ETH, SOL', () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      expect(screen.getByTestId('currency-usdt')).toBeInTheDocument();
      expect(screen.getByTestId('currency-btc')).toBeInTheDocument();
      expect(screen.getByTestId('currency-eth')).toBeInTheDocument();
      expect(screen.getByTestId('currency-sol')).toBeInTheDocument();
    });

    test('should fetch new deposit address when currency changes', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('deposit-content')).toBeInTheDocument();
      });
      mockDepositAddress('BTC', 'btc-address-123');
      fireEvent.click(screen.getByTestId('currency-btc'));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/wallet/deposit-address/BTC'),
          expect.any(Object)
        );
      });
    });
  });

  describe('3.4 Deposit Flow', () => {
    test('should display QR code when deposit address is loaded', async () => {
      mockDepositAddress('USDT', 'TRC20-deposit-addr');
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });
    });

    test('should show deposit address in read-only input', async () => {
      mockDepositAddress('USDT', 'TRC20-deposit-addr-xyz');
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        const addressInput = screen.getByTestId('deposit-address-input');
        expect(addressInput).toHaveValue('TRC20-deposit-addr-xyz');
      });
    });

    test('should copy address to clipboard when copy button clicked', async () => {
      mockDepositAddress('USDT', 'TRC20-copy-me');
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('copy-address-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('copy-address-btn'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TRC20-copy-me');
    });

    test('should have deposit submit button disabled when fields are empty', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('deposit-submit-btn')).toBeInTheDocument();
      });
      expect(screen.getByTestId('deposit-submit-btn')).toBeDisabled();
    });

    test('should show network warning on deposit tab', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('network-warning')).toBeInTheDocument();
      });
    });
  });

  describe('3.5 Withdraw Flow', () => {
    test('should show address input and amount input on withdraw tab', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
      expect(screen.getByTestId('withdraw-amount-input')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-address-input')).toBeInTheDocument();
    });

    test('should have withdraw submit button disabled when fields are empty', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-submit-btn')).toBeInTheDocument();
      });
      expect(screen.getByTestId('withdraw-submit-btn')).toBeDisabled();
    });

    test('should submit withdrawal with correct data', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('withdraw-amount-input'), { target: { value: '50' } });
      fireEvent.change(screen.getByTestId('wallet-address-input'), { target: { value: 'TRC20-my-wallet' } });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Withdrawal request submitted!' }),
      });
      fireEvent.click(screen.getByTestId('withdraw-submit-btn'));
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/wallet/withdraw',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              amount: 50,
              currency: 'USDT',
              walletAddress: 'TRC20-my-wallet',
            }),
          })
        );
      });
    });

    test('should show success message after successful withdrawal', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('withdraw-amount-input'), { target: { value: '100' } });
      fireEvent.change(screen.getByTestId('wallet-address-input'), { target: { value: 'wallet-addr' } });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Withdrawal submitted successfully!' }),
      });
      fireEvent.click(screen.getByTestId('withdraw-submit-btn'));
      await waitFor(() => {
        const msg = screen.getByTestId('wallet-message');
        expect(msg.textContent).toContain('submitted');
      });
      expect(mockRefreshUser).toHaveBeenCalled();
    });

    test('should show error message when withdrawal fails', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('withdraw-amount-input'), { target: { value: '999999' } });
      fireEvent.change(screen.getByTestId('wallet-address-input'), { target: { value: 'addr' } });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Insufficient balance' }),
      });
      fireEvent.click(screen.getByTestId('withdraw-submit-btn'));
      await waitFor(() => {
        const msg = screen.getByTestId('wallet-message');
        expect(msg).toHaveTextContent('Insufficient balance');
      });
    });

    test('should show network warning on withdraw tab', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-network-warning')).toBeInTheDocument();
      });
    });
  });

  describe('3.6 Message Clearing', () => {
    test('should clear message when switching tabs', async () => {
      mockDepositAddress();
      render(<WalletModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('wallet-withdraw-tab'));
      await waitFor(() => {
        expect(screen.getByTestId('withdraw-content')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('withdraw-amount-input'), { target: { value: '100' } });
      fireEvent.change(screen.getByTestId('wallet-address-input'), { target: { value: 'addr' } });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Error occurred' }),
      });
      fireEvent.click(screen.getByTestId('withdraw-submit-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('wallet-message')).toBeInTheDocument();
      });
      mockDepositAddress();
      fireEvent.click(screen.getByTestId('wallet-deposit-tab'));
      await waitFor(() => {
        expect(screen.queryByTestId('wallet-message')).not.toBeInTheDocument();
      });
    });
  });
});
