#!/bin/bash
# ============================================
# Add VIP + RewardPool integration to all games
# ============================================
cd /var/www/stek/backend/src/modules

# ============================================
# FUNCTION: Add VIP to a game service
# ============================================
add_vip_integration() {
  local game=$1
  local service_file=$2
  local game_type=$3
  local class_name=$4
  
  echo "=== Processing $game ==="
  
  # Check if already has VipService import
  if grep -q "VipService" "$service_file" && grep -q "RewardPoolService" "$service_file"; then
    echo "  Already has VIP + RewardPool integration, skipping"
    return
  fi
  
  # 1. Add imports at the top of the file
  if ! grep -q "VipService" "$service_file"; then
    sed -i "1i import { VipService } from '../vip/vip.service';" "$service_file"
    echo "  Added VipService import"
  fi
  
  if ! grep -q "RewardPoolService" "$service_file"; then
    sed -i "1i import { RewardPoolService } from '../reward-pool/reward-pool.service';" "$service_file"
    echo "  Added RewardPoolService import"
  fi
  
  if ! grep -q "CommissionProcessorService" "$service_file"; then
    sed -i "1i import { CommissionProcessorService } from '../affiliate/commission-processor.service';" "$service_file"
    echo "  Added CommissionProcessorService import"
  fi
  
  # 2. Add to constructor
  if grep -q "constructor(private prisma: PrismaService)" "$service_file"; then
    sed -i "s/constructor(private prisma: PrismaService)/constructor(\n    private prisma: PrismaService,\n    private readonly vipService: VipService,\n    private readonly rewardPoolService: RewardPoolService,\n    private readonly commissionProcessor: CommissionProcessorService,\n  )/" "$service_file"
    echo "  Updated constructor"
  elif grep -q "constructor(private readonly prisma: PrismaService)" "$service_file"; then
    sed -i "s/constructor(private readonly prisma: PrismaService)/constructor(\n    private readonly prisma: PrismaService,\n    private readonly vipService: VipService,\n    private readonly rewardPoolService: RewardPoolService,\n    private readonly commissionProcessor: CommissionProcessorService,\n  )/" "$service_file"
    echo "  Updated constructor (readonly)"
  fi
  
  # 3. Add postBetProcessing method at end of class (before last closing brace)
  if ! grep -q "postBetProcessing" "$service_file"; then
    # Find the last closing brace of the class and insert before it
    cat >> "$service_file" << ENDMETHOD

  // ============================================
  // POST-BET PROCESSING: VIP + RewardPool + Affiliate
  // ============================================
  private async postBetProcessing(
    userId: string,
    betId: string | null,
    betAmount: number,
    payout: number,
    houseEdge: number,
    siteId: string,
  ): Promise<void> {
    try {
      // 1. Update user stats (totalWagered + totalBets)
      await this.vipService.updateUserStats(userId, betAmount);

      // 2. Check VIP level up
      await this.vipService.checkLevelUp(userId);

      // 3. Process rakeback (betAmount × houseEdge × VIP rate)
      await this.vipService.processRakeback(userId, betAmount, houseEdge);

      // 4. Contribute to reward pool (0.20% of bet)
      await this.rewardPoolService.contributeToPool(userId, betId, betAmount, houseEdge, '${game_type}');

      // 5. Process affiliate commission
      await this.commissionProcessor.processCommission(
        betId || '',
        userId,
        betAmount,
        payout,
        '${game_type}' as any,
        siteId,
      );
    } catch (error) {
      // Fire-and-forget: don't block the game
      console.error('Post-bet processing error:', error?.message);
    }
  }
ENDMETHOD
    echo "  Added postBetProcessing method"
  fi
  
  echo "  Done!"
}

# ============================================
# FUNCTION: Update module to import VipModule + RewardPoolModule + AffiliateModule
# ============================================
update_module() {
  local module_file=$1
  local game=$2
  
  echo "  Updating module: $module_file"
  
  if ! grep -q "VipModule" "$module_file"; then
    sed -i "1i import { VipModule } from '../vip/vip.module';" "$module_file"
    sed -i "/imports: \[PrismaModule\]/s/PrismaModule/PrismaModule, VipModule/" "$module_file"
    echo "    Added VipModule"
  fi
  
  if ! grep -q "RewardPoolModule" "$module_file"; then
    sed -i "1i import { RewardPoolModule } from '../reward-pool/reward-pool.module';" "$module_file"
    sed -i "/imports: \[PrismaModule, VipModule\]/s/VipModule/VipModule, RewardPoolModule/" "$module_file"
    echo "    Added RewardPoolModule"
  fi
  
  if ! grep -q "AffiliateModule" "$module_file"; then
    sed -i "1i import { AffiliateModule } from '../affiliate/affiliate.module';" "$module_file"
    sed -i "/imports: \[PrismaModule, VipModule, RewardPoolModule\]/s/RewardPoolModule/RewardPoolModule, AffiliateModule/" "$module_file"
    echo "    Added AffiliateModule"
  fi
}

# ============================================
# Process each game
# ============================================

# LIMBO
add_vip_integration "limbo" "limbo/limbo.service.ts" "LIMBO" "LimboService"
update_module "limbo/limbo.module.ts" "limbo"

# CARD-RUSH
add_vip_integration "card-rush" "card-rush/card-rush.service.ts" "CARD_RUSH" "CardRushService"
update_module "card-rush/card-rush.module.ts" "card-rush"

# OLYMPUS
add_vip_integration "olympus" "olympus/olympus.service.ts" "OLYMPUS" "OlympusService"
update_module "olympus/olympus.module.ts" "olympus"

# PENALTY
add_vip_integration "penalty" "penalty/penalty.service.ts" "PENALTY_SHOOTOUT" "PenaltyService"
update_module "penalty/penalty.module.ts" "penalty"

echo ""
echo "=== All games updated! ==="
