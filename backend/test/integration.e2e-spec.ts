/**
 * 🔥 OPERATION "REAL STEEL" - E2E Integration Tests
 * 
 * These tests verify the Seamless Wallet API with real HTTP requests
 * against the live database. This is the "Dragon Game Flow" scenario.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('🐉 OPERATION REAL STEEL - Integration API E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  // Test configuration
  const API_KEY = process.env.INTEGRATION_API_KEY || '1de51fcb05661780cd7f41a5313b9513042c837d5e88372be452851b8c45b657';
  const TEST_USER_ID = `e2e_test_user_${Date.now()}`;
  const TEST_EMAIL = `e2e_test_${Date.now()}@test.com`;
  const TEST_USERNAME = `e2e_user_${Date.now()}`;
  
  // Track created resources for cleanup
  let testUserId: string;
  let testWalletId: string;
  
  beforeAll(async () => {
    // Create the NestJS application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same pipes as production
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
    
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);
    
    // Create a test user in the database
    const testUser = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        username: TEST_USERNAME,
        passwordHash: 'test_hash_not_for_login',
        role: 'USER',
        status: 'ACTIVE',
        hierarchyLevel: 0,
        hierarchyPath: '/',
      },
    });
    testUserId = testUser.id;
    
    // Create a wallet for the test user with initial balance
    const testWallet = await prisma.wallet.create({
      data: {
        userId: testUserId,
        currency: 'USDT',
        balance: 1000.00,
        lockedBalance: 0,
      },
    });
    testWalletId = testWallet.id;
    
    console.log(`✅ Test user created: ${testUserId}`);
    console.log(`✅ Test wallet created: ${testWalletId} with balance: 1000 USDT`);
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    try {
      // Delete transactions first (foreign key constraint)
      await prisma.transaction.deleteMany({
        where: { userId: testUserId },
      });
      
      // Delete wallet
      await prisma.wallet.deleteMany({
        where: { userId: testUserId },
      });
      
      // Delete user
      await prisma.user.delete({
        where: { id: testUserId },
      });
      
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
    }
    
    await app.close();
  });

  describe('🔒 Security Tests', () => {
    it('1.1 - Should reject request without API key (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(401);
      
      expect(response.body.message).toContain('Missing X-API-KEY');
    });

    it('1.2 - Should reject request with invalid API key (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', 'invalid_key_12345')
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(401);
      
      expect(response.body.message).toContain('Invalid API key');
    });

    it('1.3 - Should accept request with valid API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/health')
        .set('X-API-KEY', API_KEY)
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('💰 Balance Endpoint Tests', () => {
    it('2.1 - Should return balance for existing user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.balance).toBe(1000);
      expect(response.body.currency).toBe('USDT');
    });

    it('2.2 - Should return error for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: 'non_existent_user_xyz', currency: 'USDT' })
        .expect(200); // API returns 200 with error status
      
      expect(response.body.status).toBe('ERROR');
      expect(response.body.error).toContain('User not found');
    });

    it('2.3 - Should default to USDT if currency not specified', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.currency).toBe('USDT');
    });
  });

  describe('🎮 The Dragon Game Flow - Transaction Tests', () => {
    const BET_TX_ID = `dragon_bet_${Date.now()}`;
    const WIN_TX_ID = `dragon_win_${Date.now()}`;
    let balanceAfterBet: number;
    let balanceAfterWin: number;

    it('3.1 - Place BET: Should deduct 50 USDT from balance', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/transaction')
        .set('X-API-KEY', API_KEY)
        .send({
          userId: testUserId,
          amount: 50.00,
          type: 'BET',
          gameId: 'dragon_crash',
          transactionId: BET_TX_ID,
          roundId: 'round_001',
        })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.newBalance).toBe(950); // 1000 - 50
      expect(response.body.txId).toBeDefined();
      
      balanceAfterBet = response.body.newBalance;
    });

    it('3.2 - Verify balance after BET', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(200);
      
      expect(response.body.balance).toBe(950);
    });

    it('3.3 - WIN: Should add 125 USDT to balance (2.5x multiplier)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/transaction')
        .set('X-API-KEY', API_KEY)
        .send({
          userId: testUserId,
          amount: 125.00,
          type: 'WIN',
          gameId: 'dragon_crash',
          transactionId: WIN_TX_ID,
          roundId: 'round_001',
        })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.newBalance).toBe(1075); // 950 + 125
      expect(response.body.txId).toBeDefined();
      
      balanceAfterWin = response.body.newBalance;
    });

    it('3.4 - Verify balance after WIN', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(200);
      
      expect(response.body.balance).toBe(1075);
    });

    it('3.5 - IDEMPOTENCY: Duplicate BET should return same result without changing balance', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/transaction')
        .set('X-API-KEY', API_KEY)
        .send({
          userId: testUserId,
          amount: 50.00,
          type: 'BET',
          gameId: 'dragon_crash',
          transactionId: BET_TX_ID, // Same transaction ID
          roundId: 'round_001',
        })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      // Balance should still be 1075 (not 1025)
      // The idempotent response returns the balance at time of original transaction
      expect(response.body.txId).toBeDefined();
    });

    it('3.6 - Verify balance unchanged after duplicate transaction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(200);
      
      // Balance should still be 1075, not affected by duplicate
      expect(response.body.balance).toBe(1075);
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('4.1 - Should reject BET with insufficient funds', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/transaction')
        .set('X-API-KEY', API_KEY)
        .send({
          userId: testUserId,
          amount: 10000.00, // More than balance
          type: 'BET',
          gameId: 'dragon_crash',
          transactionId: `insufficient_${Date.now()}`,
        })
        .expect(200);
      
      expect(response.body.status).toBe('ERROR');
      expect(response.body.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('4.2 - Should return error for non-existent user transaction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/transaction')
        .set('X-API-KEY', API_KEY)
        .send({
          userId: 'fake_user_xyz',
          amount: 10.00,
          type: 'BET',
          gameId: 'dragon_crash',
          transactionId: `fake_user_${Date.now()}`,
        })
        .expect(200);
      
      expect(response.body.status).toBe('ERROR');
      expect(response.body.errorCode).toBe('USER_NOT_FOUND');
    });
  });

  describe('🔄 Rollback Tests', () => {
    const ROLLBACK_BET_TX_ID = `rollback_bet_${Date.now()}`;
    let balanceBeforeRollbackBet: number;

    it('5.1 - Get balance before rollback test', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(200);
      
      balanceBeforeRollbackBet = response.body.balance;
    });

    it('5.2 - Place a BET to rollback', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/transaction')
        .set('X-API-KEY', API_KEY)
        .send({
          userId: testUserId,
          amount: 100.00,
          type: 'BET',
          gameId: 'dragon_crash',
          transactionId: ROLLBACK_BET_TX_ID,
        })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.newBalance).toBe(balanceBeforeRollbackBet - 100);
    });

    it('5.3 - Rollback the BET transaction', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/rollback')
        .set('X-API-KEY', API_KEY)
        .send({ transactionId: ROLLBACK_BET_TX_ID })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.newBalance).toBe(balanceBeforeRollbackBet);
    });

    it('5.4 - Verify balance restored after rollback', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' })
        .expect(200);
      
      expect(response.body.balance).toBe(balanceBeforeRollbackBet);
    });

    it('5.5 - Rollback non-existent transaction should return error', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integration/rollback')
        .set('X-API-KEY', API_KEY)
        .send({ transactionId: 'non_existent_tx_xyz' })
        .expect(200);
      
      expect(response.body.status).toBe('ERROR');
      expect(response.body.error).toContain('Transaction not found');
    });
  });

  describe('📊 Multiple Currency Tests', () => {
    it('6.1 - Should handle BTC currency', async () => {
      // Create BTC wallet for test user
      await prisma.wallet.create({
        data: {
          userId: testUserId,
          currency: 'BTC',
          balance: 0.5,
          lockedBalance: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'BTC' })
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.balance).toBe(0.5);
      expect(response.body.currency).toBe('BTC');
    });
  });

  describe('⚡ Performance Tests', () => {
    it('7.1 - Should handle rapid sequential requests', async () => {
      // Send 10 sequential requests (not parallel to avoid connection issues)
      for (let i = 0; i < 10; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/integration/balance')
          .set('X-API-KEY', API_KEY)
          .send({ userId: testUserId, currency: 'USDT' });
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
      }
    });

    it('7.2 - Should handle multiple transactions in sequence', async () => {
      // Get initial balance
      const initialResponse = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' });
      
      const initialBalance = initialResponse.body.balance;
      
      // Place 5 small bets
      for (let i = 0; i < 5; i++) {
        const betResponse = await request(app.getHttpServer())
          .post('/api/integration/transaction')
          .set('X-API-KEY', API_KEY)
          .send({
            userId: testUserId,
            amount: 1.00,
            type: 'BET',
            gameId: 'perf_test',
            transactionId: `perf_bet_${Date.now()}_${i}`,
          });
        
        expect(betResponse.body.status).toBe('OK');
      }
      
      // Verify balance decreased by 5
      const finalResponse = await request(app.getHttpServer())
        .post('/api/integration/balance')
        .set('X-API-KEY', API_KEY)
        .send({ userId: testUserId, currency: 'USDT' });
      
      expect(finalResponse.body.balance).toBe(initialBalance - 5);
    });
  });
});
