/**
 * EmailService Unit Tests
 * Tests the Brevo-based email service
 */
import * as https from 'https';
import { EventEmitter } from 'events';

// Mock https module
const mockRequest = jest.fn();
jest.mock('https', () => ({
  request: (...args: any[]) => mockRequest(...args),
}));

import { EmailService } from './email.service';

const mockPrisma = {
  siteConfiguration: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
} as any;

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_FROM_EMAIL = 'test@betworkss.com';
    process.env.BREVO_FROM_NAME = 'Betworkss';

    // Setup mock https.request to simulate successful Brevo API response
    mockRequest.mockImplementation((options: any, callback: any) => {
      const res = new EventEmitter() as any;
      res.statusCode = 201;
      // Call callback async
      setTimeout(() => {
        callback(res);
        res.emit('data', '{"messageId":"test-123"}');
        res.emit('end');
      }, 0);
      const req = new EventEmitter() as any;
      req.write = jest.fn();
      req.end = jest.fn();
      req.setTimeout = jest.fn();
      req.destroy = jest.fn();
      return req;
    });

    service = new EmailService(mockPrisma);
  });

  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_FROM_EMAIL;
    delete process.env.BREVO_FROM_NAME;
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with code', async () => {
      const result = await service.sendVerificationEmail('user@example.com', 'ABC123');
      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      const callOptions = mockRequest.mock.calls[0][0];
      expect(callOptions.hostname).toBe('api.brevo.com');
      expect(callOptions.path).toBe('/v3/smtp/email');
      expect(callOptions.method).toBe('POST');
    });

    it('should include verification code in email payload', async () => {
      await service.sendVerificationEmail('user@example.com', 'VERIFY-TOKEN-XYZ');
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.to[0].email).toBe('user@example.com');
      expect(payload.subject).toContain('Verify');
      expect(payload.htmlContent).toContain('VERIFY-TOKEN-XYZ');
    });

    it('should use custom brand name when siteId provided', async () => {
      mockPrisma.siteConfiguration.findUnique.mockResolvedValueOnce({
        brandName: 'MyBrand',
        logoUrl: null,
        primaryColor: '#FF0000',
      });
      await service.sendVerificationEmail('user@example.com', 'CODE', 'site-1');
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.subject).toContain('MyBrand');
    });

    it('should default to Betworkss brand name', async () => {
      await service.sendVerificationEmail('user@example.com', 'CODE');
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.subject).toContain('Betworkss');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with reset code', async () => {
      const result = await service.sendPasswordResetEmail('user@example.com', 'RESET-CODE-789');
      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.to[0].email).toBe('user@example.com');
      expect(payload.subject).toContain('Password Reset');
      expect(payload.htmlContent).toContain('RESET-CODE-789');
    });

    it('should include expiry information in the email', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'CODE');
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.htmlContent).toContain('15 minutes');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with username', async () => {
      const result = await service.sendWelcomeEmail('user@example.com', 'testuser');
      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.to[0].email).toBe('user@example.com');
      expect(payload.subject).toContain('Welcome');
      expect(payload.htmlContent).toContain('testuser');
    });
  });

  describe('sendDepositConfirmationEmail', () => {
    it('should send deposit confirmation with amount and currency', async () => {
      const result = await service.sendDepositConfirmationEmail('user@example.com', '100.00', 'USDT');
      expect(result).toBe(true);
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.to[0].email).toBe('user@example.com');
      expect(payload.subject).toContain('Deposit Confirmed');
      expect(payload.htmlContent).toContain('100.00');
      expect(payload.htmlContent).toContain('USDT');
    });
  });

  describe('error handling', () => {
    it('should return false when Brevo API key is not set', async () => {
      delete process.env.BREVO_API_KEY;
      const svc = new EmailService(mockPrisma);
      const result = await svc.sendVerificationEmail('user@example.com', 'CODE');
      expect(result).toBe(false);
    });

    it('should return false when Brevo API returns error', async () => {
      mockRequest.mockImplementation((options: any, callback: any) => {
        const res = new EventEmitter() as any;
        res.statusCode = 400;
        setTimeout(() => {
          callback(res);
          res.emit('data', '{"message":"Bad Request"}');
          res.emit('end');
        }, 0);
        const req = new EventEmitter() as any;
        req.write = jest.fn();
        req.end = jest.fn();
        req.setTimeout = jest.fn();
        req.destroy = jest.fn();
        return req;
      });
      const result = await service.sendVerificationEmail('user@example.com', 'CODE');
      expect(result).toBe(false);
    });

    it('should return false when request errors', async () => {
      mockRequest.mockImplementation((options: any, callback: any) => {
        const req = new EventEmitter() as any;
        req.write = jest.fn();
        req.end = jest.fn();
        req.setTimeout = jest.fn();
        req.destroy = jest.fn();
        setTimeout(() => {
          req.emit('error', new Error('Connection refused'));
        }, 0);
        return req;
      });
      const result = await service.sendPasswordResetEmail('user@example.com', 'CODE');
      expect(result).toBe(false);
    });
  });

  describe('HTML template generation', () => {
    it('should generate valid HTML with styling', async () => {
      await service.sendVerificationEmail('user@example.com', 'CODE');
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.htmlContent).toContain('<!DOCTYPE html>');
      expect(payload.htmlContent).toContain('</html>');
      expect(payload.htmlContent).toContain('style=');
    });

    it('should include brand styling in email', async () => {
      await service.sendVerificationEmail('a@test.com', 'CODE');
      const req = mockRequest.mock.results[0].value;
      const payload = JSON.parse(req.write.mock.calls[0][0]);
      expect(payload.htmlContent).toContain('background');
    });
  });
});
