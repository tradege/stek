import { Injectable, Logger } from '@nestjs/common';

/**
 * Stub Bonus Service
 * This is a placeholder service for the bonus system.
 * Currently returns "Coming Soon" responses to prevent 500 errors
 * when the frontend calls bonus-related endpoints.
 * 
 * TODO: Implement full bonus logic with:
 * - Deposit match bonuses (100% up to $1,000)
 * - Wager requirements (30x)
 * - Max bet limits during bonus ($5)
 * - Bonus expiration (30 days)
 * - Anti-abuse (1 bonus per user per promotion)
 */
@Injectable()
export class BonusService {
  private readonly logger = new Logger(BonusService.name);

  async claimDepositBonus(userId: string, depositAmount: number): Promise<{
    success: boolean;
    bonus: number;
    message: string;
    wagerRequirement?: number;
    maxBet?: number;
    expiresIn?: string;
  }> {
    this.logger.log(`Bonus claim attempt by user ${userId} for deposit $${depositAmount}`);
    
    return {
      success: true,
      bonus: 0,
      message: 'Coming Soon - Bonus system is under development',
      wagerRequirement: 30,
      maxBet: 5,
      expiresIn: '30 days',
    };
  }

  async claimWeeklyReload(userId: string, depositAmount: number): Promise<{
    success: boolean;
    bonus: number;
    message: string;
  }> {
    this.logger.log(`Weekly reload claim attempt by user ${userId}`);
    
    return {
      success: true,
      bonus: 0,
      message: 'Coming Soon - Weekly reload bonus is under development',
    };
  }

  async claimCashback(userId: string): Promise<{
    success: boolean;
    cashback: number;
    message: string;
  }> {
    this.logger.log(`Cashback claim attempt by user ${userId}`);
    
    return {
      success: true,
      cashback: 0,
      message: 'Coming Soon - Cashback system is under development',
    };
  }

  async getBonusStatus(userId: string): Promise<{
    hasActiveBonus: boolean;
    bonusBalance: number;
    wagerProgress: number;
    wagerRequired: number;
    message: string;
  }> {
    return {
      hasActiveBonus: false,
      bonusBalance: 0,
      wagerProgress: 0,
      wagerRequired: 0,
      message: 'No active bonus - Bonus system coming soon',
    };
  }
}
