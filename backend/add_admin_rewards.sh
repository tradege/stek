#!/bin/bash
cd /var/www/stek/backend/src/modules/admin

# 1. Add RewardPoolService import to admin module
if ! grep -q 'RewardPoolModule' admin.module.ts; then
  sed -i "1i import { RewardPoolModule } from '../reward-pool/reward-pool.module';" admin.module.ts
  # Find imports array and add
  sed -i '/PrismaModule,/a\    RewardPoolModule,' admin.module.ts
  echo "Added RewardPoolModule to admin.module.ts"
fi

# 2. Add reward endpoints to admin controller (after getUserBets)
if ! grep -q 'getUserRewards' admin.controller.ts; then
  sed -i '/return this.adminService.getUserBets(id, limit ? parseInt(limit) : 20);/a\
  }\
\
  @Get("users/:id/rewards")\
  @ApiOperation({ summary: "Get user reward history" })\
  async getUserRewards(@Param("id") id: string) {\
    return this.adminService.getUserRewards(id);\
  }\
\
  @Get("users/:id/bonus-stats")\
  @ApiOperation({ summary: "Get user bonus stats" })\
  async getUserBonusStats(@Param("id") id: string) {\
    return this.adminService.getUserBonusStats(id);\
  }\
\
  @Get("reward-pool/status")\
  @ApiOperation({ summary: "Get reward pool status" })\
  async getRewardPoolStatus() {\
    return this.adminService.getRewardPoolStatus();\
  }\
\
  @Post("reward-pool/distribute-weekly")\
  @ApiOperation({ summary: "Trigger weekly reward distribution" })\
  async distributeWeekly() {\
    return this.adminService.distributeWeekly();\
  }\
\
  @Post("reward-pool/distribute-monthly")\
  @ApiOperation({ summary: "Trigger monthly reward distribution" })\
  async distributeMonthly() {\
    return this.adminService.distributeMonthly();' admin.controller.ts
  # Remove the duplicate closing brace that was added
  echo "Added reward endpoints to admin.controller.ts"
fi

# 3. Add reward methods to admin service
if ! grep -q 'getUserRewards' admin.service.ts; then
  # Add RewardPoolService import
  sed -i "1i import { RewardPoolService } from '../reward-pool/reward-pool.service';" admin.service.ts
  
  # Add to constructor
  if grep -q 'private readonly prisma: PrismaService,' admin.service.ts; then
    sed -i 's/private readonly prisma: PrismaService,/private readonly prisma: PrismaService,\n    private readonly rewardPoolService: RewardPoolService,/' admin.service.ts
  fi
  
  # Add methods before the last closing brace of the class
  cat >> admin.service.ts << 'METHODS'

  // ============================================
  // REWARD POOL ADMIN METHODS
  // ============================================

  async getUserRewards(userId: string) {
    return this.rewardPoolService.getUserRewardHistory(userId);
  }

  async getUserBonusStats(userId: string) {
    return this.rewardPoolService.getUserBonusStats(userId);
  }

  async getRewardPoolStatus() {
    return this.rewardPoolService.getPoolStatus();
  }

  async distributeWeekly() {
    return this.rewardPoolService.distributeWeeklyBonus();
  }

  async distributeMonthly() {
    return this.rewardPoolService.distributeMonthlyBonus();
  }
METHODS
  echo "Added reward methods to admin.service.ts"
fi

# 4. Update getUserDetail to include bonusBalance
if ! grep -q 'bonusBalance' admin.service.ts; then
  # Add bonusBalance to wallet select
  sed -i 's/wallets: { select: { id: true, balance: true, currency: true } },/wallets: { select: { id: true, balance: true, bonusBalance: true, currency: true } },/' admin.service.ts
  echo "Added bonusBalance to getUserDetail"
fi

echo "Done!"
