import { NowPaymentsService } from './nowpayments.service';
import { createHmac } from 'crypto';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('NowPaymentsService', () => {
  let service: NowPaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOWPAYMENTS_API_KEY = 'test-api-key-123';
    process.env.NOWPAYMENTS_IPN_SECRET = 'test-ipn-secret-456';
    service = new NowPaymentsService();
  });

  afterEach(() => {
    delete process.env.NOWPAYMENTS_API_KEY;
    delete process.env.NOWPAYMENTS_IPN_SECRET;
  });

  describe('createPayment', () => {
    it('should create a payment successfully with correct API call', async () => {
      const mockResponse = {
        payment_id: 12345,
        payment_status: 'waiting',
        pay_address: '0xABC123DEF456',
        pay_amount: 0.05,
        pay_currency: 'btc',
        price_amount: 100,
        price_currency: 'usd',
        order_id: 'order-001',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.createPayment({
        priceAmount: 100,
        priceCurrency: 'usd',
        payCurrency: 'btc',
        orderId: 'order-001',
      });

      expect(result).toEqual(mockResponse);
      expect(result.payment_id).toBe(12345);
      expect(result.pay_address).toBe('0xABC123DEF456');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nowpayments.io/v1/payment',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key-123',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should include correct body parameters in the API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payment_id: 1 }),
      });

      await service.createPayment({
        priceAmount: 50,
        priceCurrency: 'usd',
        payCurrency: 'eth',
        orderId: 'order-eth-001',
        orderDescription: 'ETH deposit',
        ipnCallbackUrl: 'https://example.com/webhook',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.price_amount).toBe(50);
      expect(callBody.price_currency).toBe('usd');
      expect(callBody.pay_currency).toBe('eth');
      expect(callBody.order_id).toBe('order-eth-001');
      expect(callBody.order_description).toBe('ETH deposit');
      expect(callBody.ipn_callback_url).toBe('https://example.com/webhook');
    });

    it('should throw error when API returns non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid currency pair',
      });

      await expect(
        service.createPayment({
          priceAmount: 100,
          priceCurrency: 'usd',
          payCurrency: 'INVALID',
          orderId: 'order-fail',
        }),
      ).rejects.toThrow('NOWPayments API error: 400');
    });

    it('should use default IPN callback URL when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payment_id: 1 }),
      });

      await service.createPayment({
        priceAmount: 25,
        priceCurrency: 'usd',
        payCurrency: 'sol',
        orderId: 'order-sol-001',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.ipn_callback_url).toContain('webhooks/nowpayments');
    });

    it('should support BTC, ETH, SOL, USDT currencies', async () => {
      const currencies = ['btc', 'eth', 'sol', 'usdt'];
      
      for (const currency of currencies) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ payment_id: 1, pay_currency: currency }),
        });

        const result = await service.createPayment({
          priceAmount: 10,
          priceCurrency: 'usd',
          payCurrency: currency,
          orderId: `order-${currency}`,
        });

        expect(result.pay_currency).toBe(currency);
      }

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('getPaymentStatus', () => {
    it('should fetch payment status by ID', async () => {
      const mockStatus = {
        payment_id: 12345,
        payment_status: 'confirmed',
        pay_amount: 0.05,
        actually_paid: 0.05,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const result = await service.getPaymentStatus(12345);
      expect(result.payment_status).toBe('confirmed');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.nowpayments.io/v1/payment/12345',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-api-key': 'test-api-key-123' }),
        }),
      );
    });

    it('should throw error on failed status check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(service.getPaymentStatus(99999)).rejects.toThrow('NOWPayments status error: 404');
    });
  });

  describe('getMinimumAmount', () => {
    it('should return minimum amount for currency pair', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ min_amount: 0.001 }),
      });

      const result = await service.getMinimumAmount('btc', 'usd');
      expect(result).toBe(0.001);
    });

    it('should return 0 when API fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await service.getMinimumAmount('invalid');
      expect(result).toBe(0);
    });
  });

  describe('getEstimatedPrice', () => {
    it('should return estimated conversion amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ estimated_amount: 0.0025 }),
      });

      const result = await service.getEstimatedPrice(100, 'usd', 'btc');
      expect(result).toBe(0.0025);
    });

    it('should return 0 when API fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await service.getEstimatedPrice(100, 'usd', 'invalid');
      expect(result).toBe(0);
    });
  });

  describe('verifyIpnSignature', () => {
    it('should verify valid IPN signature', () => {
      const payload = { payment_id: 123, payment_status: 'confirmed', pay_amount: 0.05 };
      
      // Generate expected signature
      const sortedPayload = JSON.parse(JSON.stringify(payload, Object.keys(payload).sort()));
      const expectedSig = createHmac('sha512', 'test-ipn-secret-456')
        .update(JSON.stringify(sortedPayload))
        .digest('hex');

      const result = service.verifyIpnSignature(payload, expectedSig);
      expect(result).toBe(true);
    });

    it('should reject invalid IPN signature', () => {
      const payload = { payment_id: 123, payment_status: 'confirmed' };
      const result = service.verifyIpnSignature(payload, 'invalid-signature');
      expect(result).toBe(false);
    });

    it('should return false when IPN secret is not configured', () => {
      delete process.env.NOWPAYMENTS_IPN_SECRET;
      const freshService = new NowPaymentsService();
      
      const result = freshService.verifyIpnSignature({ payment_id: 1 }, 'any-sig');
      expect(result).toBe(false);
    });

    it('should sort payload keys alphabetically before hashing', () => {
      const payload = { z_field: 'last', a_field: 'first', m_field: 'middle' };
      
      // Manually compute expected signature with sorted keys
      const sorted = { a_field: 'first', m_field: 'middle', z_field: 'last' };
      const expectedSig = createHmac('sha512', 'test-ipn-secret-456')
        .update(JSON.stringify(sorted))
        .digest('hex');

      const result = service.verifyIpnSignature(payload, expectedSig);
      expect(result).toBe(true);
    });

    it('should handle nested objects in payload', () => {
      const payload = { 
        payment_id: 123, 
        outcome: { status: 'confirmed', amount: 0.05 } 
      };
      
      // Should not throw
      const result = service.verifyIpnSignature(payload, 'some-sig');
      expect(typeof result).toBe('boolean');
    });
  });
});
