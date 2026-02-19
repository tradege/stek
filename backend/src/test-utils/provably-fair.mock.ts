/**
 * PROVABLY FAIR TEST HELPER
 * Deterministic hash generation for predictable test outcomes
 */
import { createHmac } from 'crypto';

export class MockProvablyFair {
  static generateHash(serverSeed: string, clientSeed: string, nonce: number): string {
    return createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  }

  static getFloatFromHash(hash: string): number {
    return parseInt(hash.slice(0, 8), 16) / 0x100000000;
  }

  static getFloat(serverSeed: string, clientSeed: string, nonce: number): number {
    return this.getFloatFromHash(this.generateHash(serverSeed, clientSeed, nonce));
  }

  static getDiceRoll(serverSeed: string, clientSeed: string, nonce: number): number {
    return Math.floor(this.getFloat(serverSeed, clientSeed, nonce) * 10000) / 100;
  }

  static getServerSeedMock(overrides: any = {}) {
    return {
      id: overrides.id || 'seed-id-1',
      userId: overrides.userId || 'user-1',
      seed: overrides.seed || 'test-server-seed',
      seedHash: overrides.seedHash || createHmac('sha256', 'test-server-seed').update('').digest('hex'),
      clientSeed: overrides.clientSeed || 'test-client-seed',
      nonce: overrides.nonce ?? 0,
      isActive: overrides.isActive ?? true,
      createdAt: new Date(),
    };
  }
}

export function createMockPrisma() {
  return {
    serverSeed: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    wallet: { findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    gameBet: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    siteConfiguration: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    riskLimit: { findFirst: jest.fn() },
    $transaction: jest.fn((cb) => cb({
      wallet: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', balance: 1000, currency: 'USD' }), update: jest.fn().mockResolvedValue({ id: 'w1', balance: 990, currency: 'USD' }) },
      gameBet: { create: jest.fn().mockResolvedValue({ id: 'bet-1' }) },
      user: { update: jest.fn() },
      serverSeed: { findFirst: jest.fn(), update: jest.fn() },
    })),
  };
}
