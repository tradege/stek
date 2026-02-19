/**
 * AFFILIATE SERVICE UNIT TESTS
 */
import { Test, TestingModule } from "@nestjs/testing";
import { AffiliateService } from "./affiliate.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { CommissionProcessorService } from './commission-processor.service';


const mockCommissionProcessor = {
  processCommission: jest.fn().mockResolvedValue(undefined),
};

describe("AffiliateService - Unit Tests", () => {
  let service: AffiliateService;
  let prisma: PrismaService;

  const mockUser = {
    id: "user-123",
    username: "testuser",
    email: "test@example.com",
    parentId: null,
    hierarchyPath: "/",
    hierarchyLevel: 4,
    wallets: [{
      id: "wallet-123",
      currency: "USDT",
      balance: new Decimal(1000),
      lockedBalance: new Decimal(0),
    }],
    children: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
            },
            wallet: {
              findFirst: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn(),
              aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
            },
            bet: {
              aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
            },
            commission: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            $transaction: jest.fn(),
          },
        },
        { provide: CommissionProcessorService, useValue: mockCommissionProcessor },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getStats", () => {
    it("Should return affiliate stats for user", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, "count").mockResolvedValue(0);
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const result = await service.getStats("user-123");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("referralCode");
      expect(result).toHaveProperty("referralLink");
      expect(result).toHaveProperty("currentRank");
    });

    it("Should throw BadRequestException for non-existent user", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      await expect(service.getStats("non-existent"))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe("getNetwork", () => {
    it("Should return network details", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const result = await service.getNetwork("user-123");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("tiers");
      expect(result).toHaveProperty("totalUsers");
      expect(result).toHaveProperty("totalEarnings");
    });

    it("Should return empty network for non-existent user", async () => {
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const result = await service.getNetwork("non-existent");

      expect(result.totalUsers).toBe(0);
      expect(result.totalEarnings).toBe(0);
    });
  });

  describe("getHistory", () => {
    it("Should return commission history", async () => {
      (prisma.commission as any).findMany.mockResolvedValue([]);

      const result = await service.getHistory("user-123");

      expect(result).toBeDefined();
      expect(Array.isArray(result.history)).toBe(true);
    });
  });

  describe("claimCommission", () => {
    it("Should claim commission successfully", async () => {
      const mockCommissions = [
        { id: "comm-1", recipientId: "user-123", amount: new Decimal(100) },
        { id: "comm-2", recipientId: "user-123", amount: new Decimal(50) },
      ];
      (prisma.commission as any).findMany.mockResolvedValue(mockCommissions);
      jest.spyOn(prisma.wallet, "findFirst").mockResolvedValue({
        id: "wallet-123",
        userId: "user-123",
        currency: "USDT",
        balance: new Decimal(100),
        lockedBalance: new Decimal(0),
      } as any);
      jest.spyOn(prisma.wallet, "update").mockResolvedValue({} as any);
      jest.spyOn(prisma.transaction, "create").mockResolvedValue({} as any);

      const result = await service.claimCommission("user-123");

      expect(result).toBeDefined();
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    });

    it("Should throw BadRequestException for zero commission", async () => {
      (prisma.commission as any).findMany.mockResolvedValue([]);

      await expect(service.claimCommission("user-123"))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe("getLeaderboard", () => {
    it("Should return leaderboard", async () => {
      const topUsers = [
        { id: "user-1", username: "top1", commissionsEarned: [{ amount: new Decimal(100) }], children: [{ id: "c1" }] },
        { id: "user-2", username: "top2", commissionsEarned: [{ amount: new Decimal(80) }], children: [] },
      ];
      jest.spyOn(prisma.user, "findMany").mockResolvedValue(topUsers as any);

      const result = await service.getLeaderboard();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("leaderboard");
    });
  });

  describe("Rank System", () => {
    it("Should start at Bronze rank", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, "count").mockResolvedValue(0);
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const result = await service.getStats("user-123");

      expect(result.currentRank.name).toBe("Bronze");
    });
  });

  describe("Referral Link", () => {
    it("Should generate correct referral link", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, "count").mockResolvedValue(0);
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const result = await service.getStats("user-123");

      expect(result.referralLink).toContain("ref=");
      expect(result.referralLink).toContain(mockUser.username);
    });

    it("Should use username as referral code", async () => {
      jest.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.user, "count").mockResolvedValue(0);
      jest.spyOn(prisma.user, "findMany").mockResolvedValue([]);

      const result = await service.getStats("user-123");

      expect(result.referralCode).toBe(mockUser.username);
    });
  });
});
