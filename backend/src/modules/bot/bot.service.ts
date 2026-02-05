/**
 * ============================================
 * BOT SERVICE - Ghost Protocol
 * ============================================
 * Traffic Bot System for simulating a lively casino
 * 
 * Features:
 * - Auto-creates 50 bot users on startup
 * - Simulates betting behavior during WAITING state
 * - Simulates cashout behavior during RUNNING state
 * - Sends chat messages periodically
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';

// Bot personality types
type BotPersonality = 'CAUTIOUS' | 'NORMAL' | 'DEGEN';

interface BotUser {
  id: string;
  username: string;
  personality: BotPersonality;
  currentBet: number | null;
  targetCashout: number | null;
}

// Random bot names
const BOT_NAMES = [
  'MoonBoi', 'Whale_99', 'ElonMusk', 'CryptoKing', 'DiamondHands',
  'PaperHands', 'Satoshi', 'Vitalik', 'DeFiDegen', 'YieldFarmer',
  'LiquidityPro', 'GasGuzzler', 'TokenMaster', 'BlockchainBro', 'SmartMoney',
  'DumbMoney', 'BullRunner', 'BearSlayer', 'PumpChaser', 'DumpCatcher',
  'RektKing', 'GreenCandle', 'RedCandle', 'MoonShot', 'RugPuller',
  'ApeDegen', 'NFTFliper', 'MetaGamer', 'Web3Native', 'ZeroKnowledge',
  'LayerTwo', 'GasOptimizer', 'FlashLoan', 'Arbitrageur', 'MEVBot',
  'LiquidStaker', 'ValidatorNode', 'ConsensusKing', 'ForkMaster', 'ChainHopper',
  'BridgeRunner', 'OracleWatcher', 'PriceFeeder', 'VolatilityTrader', 'DeltaNeutral',
  'GammaScalper', 'ThetaGang', 'VegaHunter', 'IVCrusher', 'OptionsWhale'
];

// Chat messages dictionary
const CHAT_MESSAGES = [
  'LFG! 🚀',
  'Rigged...',
  'Nice win!',
  'Rekt 💀',
  'To the moon 🌙',
  'Admin??',
  'gg',
  'Ez money',
  'I knew it!',
  'One more...',
  'This is the one',
  'Paper hands smh',
  'Diamond hands only 💎',
  'Whale alert 🐋',
  'Lets goooo',
  'RIP',
  'Cashout now!',
  'Hold hold hold',
  'Too early...',
  'Perfect timing',
  'Lucky!',
  'Unlucky...',
  'Im done',
  'One more round',
  'All in next',
  'Playing safe now',
  'Degen mode activated',
  'This game is fire 🔥',
  'Who else got rekt?',
  'Easy 2x',
  'Going for 10x',
  'Scared money dont make money',
  'Trust the process',
  'Variance is real',
  'House always wins... or not',
];

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bots: BotUser[] = [];
  private isEnabled = true;
  private currentGameState: 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED' = 'WAITING';
  private currentMultiplier = 1.0;
  private chatInterval: NodeJS.Timeout | null = null;
  private activeBets: Map<string, { amount: number; targetCashout: number }> = new Map();

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('🤖 Initializing Bot Service (Ghost Protocol)...');
    await this.initializeBots();
    this.startChatLoop();
    this.logger.log(`🤖 Bot Service ready with ${this.bots.length} ghost players`);
  }

  /**
   * Initialize bot users - create if they don't exist
   */
  private async initializeBots() {
    const BOT_COUNT = 50;
    
    // Check existing bot users
    const existingBots = await this.prisma.user.findMany({
      where: {
        email: {
          endsWith: '@system.local',
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    this.logger.log(`Found ${existingBots.length} existing bot users`);

    // Create missing bots
    const existingCount = existingBots.length;
    if (existingCount < BOT_COUNT) {
      const toCreate = BOT_COUNT - existingCount;
      this.logger.log(`Creating ${toCreate} new bot users...`);

      const hashedPassword = await argon2.hash('BotPassword123!');

      for (let i = existingCount; i < BOT_COUNT; i++) {
        const botName = BOT_NAMES[i] || `Bot_${i}`;
        const email = `bot_${i}@system.local`;

        try {
          const user = await this.prisma.user.create({
            data: {
              email,
              username: botName,
              passwordHash: hashedPassword,
              role: 'USER',
              status: 'ACTIVE',
              // Bot user identified by email pattern @system.local
              wallets: {
                create: {
                  currency: 'USDT',
                  balance: 1000000, // Unlimited balance (1M)
                  lockedBalance: 0,
                },
              },
            },
          });

          existingBots.push({ id: user.id, username: user.username });
        } catch (error) {
          // Bot might already exist
          this.logger.warn(`Could not create bot ${botName}: ${error.message}`);
        }
      }
    }

    // Initialize bot objects with personalities
    this.bots = existingBots.map((bot) => ({
      id: bot.id,
      username: bot.username,
      personality: this.assignPersonality(),
      currentBet: null,
      targetCashout: null,
    }));
  }

  /**
   * Assign random personality to bot
   */
  private assignPersonality(): BotPersonality {
    const rand = Math.random();
    if (rand < 0.3) return 'CAUTIOUS';
    if (rand < 0.8) return 'NORMAL';
    return 'DEGEN';
  }

  /**
   * Get target cashout multiplier based on personality
   */
  private getTargetCashout(personality: BotPersonality): number {
    switch (personality) {
      case 'CAUTIOUS':
        return 1.01 + Math.random() * 0.29; // 1.01x - 1.30x
      case 'NORMAL':
        return 1.50 + Math.random() * 1.50; // 1.50x - 3.00x
      case 'DEGEN':
        return 5.00 + Math.random() * 15.00; // 5.00x - 20.00x
      default:
        return 2.00;
    }
  }

  /**
   * Get random bet amount based on personality
   */
  private getBetAmount(personality: BotPersonality): number {
    switch (personality) {
      case 'CAUTIOUS':
        return Math.floor(5 + Math.random() * 45); // $5 - $50
      case 'NORMAL':
        return Math.floor(20 + Math.random() * 180); // $20 - $200
      case 'DEGEN':
        return Math.floor(100 + Math.random() * 900); // $100 - $1000
      default:
        return 50;
    }
  }

  /**
   * Handle game state changes
   */
  @OnEvent('crash.state_change')
  handleGameStateChange(data: { state: string; multiplier?: number }) {
    if (!this.isEnabled) return;

    this.currentGameState = data.state as any;
    
    switch (data.state) {
      case 'WAITING':
      case 'STARTING':
        this.placeBotBets();
        break;
      case 'RUNNING':
        // Bots will cashout based on tick events
        break;
      case 'CRASHED':
        this.handleCrash();
        break;
    }
  }

  /**
   * Handle tick events for cashout decisions
   */
  @OnEvent('crash.tick')
  handleTick(data: { multiplier: string | number }) {
    if (!this.isEnabled) return;
    
    this.currentMultiplier = typeof data.multiplier === "string" ? parseFloat(data.multiplier) : data.multiplier;
    this.checkBotCashouts(this.currentMultiplier);
  }

  /**
   * Place bets for random selection of bots
   */
  private async placeBotBets() {
    if (!this.isEnabled || this.bots.length === 0) return;

    // Select 10-25 random bots
    const numBots = Math.floor(10 + Math.random() * 15);
    const shuffled = [...this.bots].sort(() => Math.random() - 0.5);
    const selectedBots = shuffled.slice(0, numBots);

    this.logger.debug(`🎲 ${selectedBots.length} bots placing bets...`);

    // Stagger bet placement for realism
    for (const bot of selectedBots) {
      const delay = Math.random() * 3000; // 0-3 seconds
      
      setTimeout(async () => {
        if (this.currentGameState !== 'WAITING' && this.currentGameState !== 'STARTING') {
          return; // Game already started
        }

        const amount = this.getBetAmount(bot.personality);
        const targetCashout = this.getTargetCashout(bot.personality);

        // Store active bet
        this.activeBets.set(bot.id, { amount, targetCashout });

        // Emit bet event (will be picked up by WebSocket gateway)
        this.eventEmitter.emit('bot:bet_placed', {
          betId: `bot_${bot.id}_${Date.now()}`,
          oddsId: bot.id,
          betAmount: amount,
          userId: bot.id,
          username: bot.username,
          amount,
          currency: 'USDT',
          isBot: true,
          targetCashout,
        });

        this.logger.debug(`🤖 ${bot.username} bet $${amount} (target: ${targetCashout.toFixed(2)}x)`);
      }, delay);
    }
  }

  /**
   * Check if any bots should cashout at current multiplier
   */
  private checkBotCashouts(multiplier: number) {
    for (const [botId, bet] of this.activeBets.entries()) {
      // Add some randomness to cashout timing
      const variance = 0.95 + Math.random() * 0.1; // 95% - 105% of target
      const adjustedTarget = bet.targetCashout * variance;

      if (multiplier >= adjustedTarget) {
        const bot = this.bots.find(b => b.id === botId);
        if (!bot) continue;

        const profit = bet.amount * (multiplier - 1);

        // Emit cashout event
        this.eventEmitter.emit('bot:cashout', {
          betId: `bot_${botId}_${Date.now()}`,
          oddsId: botId,
          cashoutMultiplier: multiplier,
          userId: botId,
          username: bot.username,
          multiplier,
          profit,
          amount: bet.amount,
          isBot: true,
        });

        this.logger.debug(`💰 ${bot.username} cashed out at ${multiplier.toFixed(2)}x (+$${profit.toFixed(2)})`);
        
        // Remove from active bets
        this.activeBets.delete(botId);
      }
    }
  }

  /**
   * Handle crash - clear remaining bets
   */
  private handleCrash() {
    const lostBots = this.activeBets.size;
    
    for (const [botId, bet] of this.activeBets.entries()) {
      const bot = this.bots.find(b => b.id === botId);
      if (bot) {
        this.logger.debug(`💀 ${bot.username} lost $${bet.amount}`);
      }
    }

    if (lostBots > 0) {
      this.logger.debug(`💥 ${lostBots} bots got rekt`);
    }

    this.activeBets.clear();
  }

  /**
   * Start chat message loop
   */
  private startChatLoop() {
    if (this.chatInterval) {
      clearInterval(this.chatInterval);
    }

    const sendChatMessage = () => {
      if (!this.isEnabled || this.bots.length === 0) return;

      const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
      const message = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];

      this.eventEmitter.emit('bot:chat_message', {
        oddsId: bot.id,
        oddsNumber: 0,
        userId: bot.id,
        username: bot.username,
        message,
        timestamp: new Date().toISOString(),
        isBot: true,
      });

      this.logger.debug(`💬 ${bot.username}: ${message}`);
    };

    // Send message every 5-15 seconds
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 10000;
      this.chatInterval = setTimeout(() => {
        sendChatMessage();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  /**
   * Toggle bot system on/off
   */
  toggle(enable: boolean): { enabled: boolean; botCount: number } {
    this.isEnabled = enable;
    
    if (enable) {
      this.startChatLoop();
      this.logger.log('🤖 Bot system ENABLED');
    } else {
      if (this.chatInterval) {
        clearTimeout(this.chatInterval);
        this.chatInterval = null;
      }
      this.activeBets.clear();
      this.logger.log('🤖 Bot system DISABLED');
    }

    return {
      enabled: this.isEnabled,
      botCount: this.bots.length,
    };
  }

  /**
   * Get bot system status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      botCount: this.bots.length,
      activeBets: this.activeBets.size,
      currentGameState: this.currentGameState,
      personalities: {
        cautious: this.bots.filter(b => b.personality === 'CAUTIOUS').length,
        normal: this.bots.filter(b => b.personality === 'NORMAL').length,
        degen: this.bots.filter(b => b.personality === 'DEGEN').length,
      },
    };
  }

  /**
   * Manually trigger bot bets (for testing)
   */
  async triggerBets() {
    await this.placeBotBets();
    return { message: 'Bot bets triggered' };
  }

  /**
   * Manually trigger chat message (for testing)
   */
  triggerChat() {
    if (this.bots.length === 0) return { message: 'No bots available' };

    const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
    const message = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];

    this.eventEmitter.emit('bot:chat_message', {
      userId: bot.id,
      username: bot.username,
      message,
      timestamp: new Date().toISOString(),
      isBot: true,
    });

    return { username: bot.username, message };
  }
}
