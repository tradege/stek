import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class NowPaymentsService {
  private readonly logger = new Logger(NowPaymentsService.name);
  private readonly apiKey = process.env.NOWPAYMENTS_API_KEY;
  private readonly ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  private readonly baseUrl = 'https://api.nowpayments.io/v1';

  /**
   * Create a payment via NOWPayments API
   */
  async createPayment(params: {
    priceAmount: number;
    priceCurrency: string;
    payCurrency: string;
    orderId: string;
    orderDescription?: string;
    ipnCallbackUrl?: string;
  }): Promise<{
    payment_id: number;
    payment_status: string;
    pay_address: string;
    pay_amount: number;
    pay_currency: string;
    price_amount: number;
    price_currency: string;
    order_id: string;
  }> {
    const body = {
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency || 'usd',
      pay_currency: params.payCurrency || 'btc',
      order_id: params.orderId,
      order_description: params.orderDescription || `Deposit ${params.orderId}`,
      ipn_callback_url: params.ipnCallbackUrl || `http://167.172.174.75/api/webhooks/nowpayments`,
    };

    this.logger.log(`Creating NOWPayments payment: ${JSON.stringify(body)}`);

    const response = await fetch(`${this.baseUrl}/payment`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`NOWPayments API error: ${response.status} - ${errorText}`);
      throw new Error(`NOWPayments API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    this.logger.log(`NOWPayments payment created: ID=${data.payment_id}, address=${data.pay_address}`);
    return data;
  }

  /**
   * Get payment status from NOWPayments
   */
  async getPaymentStatus(paymentId: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/payment/${paymentId}`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`NOWPayments status error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get minimum payment amount for a currency pair
   */
  async getMinimumAmount(currencyFrom: string, currencyTo: string = 'btc'): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}`,
      {
        headers: { 'x-api-key': this.apiKey },
      },
    );

    if (!response.ok) return 0;
    const data = await response.json();
    return data.min_amount || 0;
  }

  /**
   * Get estimated price for a currency conversion
   */
  async getEstimatedPrice(amount: number, currencyFrom: string, currencyTo: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/estimate?amount=${amount}&currency_from=${currencyFrom}&currency_to=${currencyTo}`,
      {
        headers: { 'x-api-key': this.apiKey },
      },
    );

    if (!response.ok) return 0;
    const data = await response.json();
    return data.estimated_amount || 0;
  }

  /**
   * Verify IPN (Instant Payment Notification) signature
   */
  verifyIpnSignature(payload: any, receivedSignature: string): boolean {
    if (!this.ipnSecret) {
      this.logger.warn('IPN Secret not configured');
      return false;
    }

    // Sort payload keys alphabetically
    const sortedPayload = this.sortObject(payload);
    const payloadString = JSON.stringify(sortedPayload);

    const expectedSignature = createHmac('sha512', this.ipnSecret)
      .update(payloadString)
      .digest('hex');

    const isValid = expectedSignature === receivedSignature;
    if (!isValid) {
      this.logger.warn(`IPN signature mismatch. Expected: ${expectedSignature.substring(0, 20)}..., Received: ${receivedSignature?.substring(0, 20)}...`);
    }
    return isValid;
  }

  private sortObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));
    
    return Object.keys(obj)
      .sort()
      .reduce((sorted: any, key: string) => {
        sorted[key] = this.sortObject(obj[key]);
        return sorted;
      }, {});
  }
}
