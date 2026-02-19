import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Service for validating HMAC signatures from game providers.
 * Different providers use different signature algorithms and formats.
 */
@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  /**
   * Validate HMAC-SHA256 signature (most common)
   */
  validateHmacSha256(
    payload: string | object,
    signature: string,
    secret: string
  ): boolean {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('hex');
      
      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase()),
        Buffer.from(expectedSignature.toLowerCase())
      );
    } catch (error) {
      this.logger.error(`HMAC-SHA256 validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate HMAC-SHA512 signature
   */
  validateHmacSha512(
    payload: string | object,
    signature: string,
    secret: string
  ): boolean {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha512', secret)
        .update(data)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase()),
        Buffer.from(expectedSignature.toLowerCase())
      );
    } catch (error) {
      this.logger.error(`HMAC-SHA512 validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate MD5 hash (legacy providers)
   */
  validateMd5(
    payload: string | object,
    signature: string,
    secret: string
  ): boolean {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = crypto
        .createHash('md5')
        .update(data + secret)
        .digest('hex');
      
      return signature.toLowerCase() === expectedSignature.toLowerCase();
    } catch (error) {
      this.logger.error(`MD5 validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate signature based on provider type
   */
  validateSignature(
    payload: string | object,
    signature: string,
    secret: string,
    algorithm: 'sha256' | 'sha512' | 'md5' = 'sha256'
  ): boolean {
    switch (algorithm) {
      case 'sha256':
        return this.validateHmacSha256(payload, signature, secret);
      case 'sha512':
        return this.validateHmacSha512(payload, signature, secret);
      case 'md5':
        return this.validateMd5(payload, signature, secret);
      default:
        this.logger.warn(`Unknown signature algorithm: ${algorithm}`);
        return false;
    }
  }

  /**
   * Generate HMAC-SHA256 signature (for outgoing requests)
   */
  generateHmacSha256(payload: string | object, secret: string): string {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate a random API key
   */
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a random API secret
   */
  generateApiSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }
}
