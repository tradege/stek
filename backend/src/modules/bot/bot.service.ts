/**
 * ============================================
 * BOT SERVICE - Ghost Protocol (Multi-Tenant)
 * ============================================
 * Traffic Bot System for simulating a lively casino.
 * Now tenant-aware: each site/brand has its own bot pool,
 * chat messages, and bet behavior.
 * 
 * Features:
 * - Auto-creates bots per siteId based on BotConfig
 * - Simulates betting behavior during WAITING state (per site)
 * - Simulates cashout behavior during RUNNING state (per site)
 * - Sends chat messages periodically (isolated per site)
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
  siteId: string;
  currentBet: number | null;
  targetCashout: number | null;
}

interface SiteBotPool {
  siteId: string;
  bots: BotUser[];
  activeBets: Map<string, { amount: number; targetCashout: number }>;
  chatInterval: NodeJS.Timeout | null;
  isEnabled: boolean;
  config: {
    botCount: number;
    minBetAmount: number;
    maxBetAmount: number;
    chatEnabled: boolean;
    chatIntervalMin: number;
    chatIntervalMax: number;
    botNamePrefix: string;
    customChatMessages: string[] | null;
  };
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

// Default chat messages
const DEFAULT_CHAT_MESSAGES = [
  'LFG! 🚀', 'Rigged...', 'Nice win!', 'Rekt 💀', 'To the moon 🌙',
  'Admin??', 'gg', 'Ez money', 'I knew it!', 'One more...',
  'This is the one', 'Paper hands smh', 'Diamond hands only 💎',
  'Whale alert 🐋', 'Lets goooo', 'RIP', 'Cashout now!',
  'Hold hold hold', 'Too early...', 'Perfect timing', 'Lucky!',
  'Unlucky...', 'Im done', 'One more round', 'All in next',
  'Playing safe now', 'Degen mode activated', 'This game is fire 🔥',
  'Who else got rekt?', 'Easy 2x', 'Going for 10x',
  'Scared money dont make money', 'Trust the process',
  'Variance is real', 'House always wins... or not',
];

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);

  // Map of siteId -> SiteBotPool (each brand has its own bot pool)
  private sitePools: Map<string, SiteBotPool> = new Map();

  private currentGameState: 'WAITING' | 'STARTING' | 'RUNNING' | 'CRASHED' = 'WAITING';
  private currentMultiplier = 1.0;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('🤖 Initializing Multi-Tenant Bot Service (Ghost Protocol)...');
    await this.initializeAllSiteBots();
    this.logger.log(`🤖 Bot Service ready for ${this.sitePools.size} site(s)`);
  }

  /**
   * Initialize bot pools for all active sites
   */
  private async initializeAllSiteBots() {
    // Get all active sites with their bot configs
    const sites = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      include: { bots: true },
    });

    for (const site of sites) {
      const botConfig = site.bots[0]; // One BotConfig per site (@@unique([siteId]))
      if (botConfig && botConfig.enabled) {
        await this.initializeSiteBots(site.id, {
          botCount: botConfig.botCount,
          minBetAmount: Number(botConfig.minBetAmount),
          maxBetAmount: Number(botConfig.maxBetAmount),
          chatEnabled: botConfig.chatEnabled,
          chatIntervalMin: botConfig.chatIntervalMin,
          chatIntervalMax: botConfig.chatIntervalMax,
          botNamePrefix: botConfig.botNamePrefix,
          customChatMessages: botConfig.customChatMessages as string[] | null,
        });
      }
    }
  }

  /**
   * Initialize bots for a specific site
   */
  private async initializeSiteBots(siteId: string, config: SiteBotPool['config']) {
    const { botCount, botNamePrefix } = config;

    // Check existing bot users for this site
    const existingBots = await this.prisma.user.findMany({
      where: {
        siteId,
        isBot: true,
      },
      select: {
        id: true,
        username: true,
      },
    });

    this.logger.log(`[${siteId}] Found ${existingBots.length} existing bots`);

    // Create missing bots
    const existingCount = existingBots.length;
    if (existingCount < botCount) {
      const toCreate = botCount - existingCount;
      this.logger.log(`[${siteId}] Creating ${toCreate} new bot users...`);

      const hashedPassword = await argon2.hash('BotPassword123!');

      for (let i = existingCount; i < botCount; i++) {
        const baseName = BOT_NAMES[i % BOT_NAMES.length] || `Bot_${i}`;
        const botName = botNamePrefix ? `${botNamePrefix}${baseName}` : baseName;
        // Ensure unique email per site
        const email = `bot_${siteId.substring(0, 8)}_${i}@system.local`;

        try {
          const user = await this.prisma.user.create({
            data: {
              email,
              username: `${botName}_${siteId.substring(0, 4)}`,
              passwordHash: hashedPassword,
              role: 'USER',
              status: 'ACTIVE',
              isBot: true,
              siteId,
              wallets: {
                create: {
                  currency: 'USDT',
                  balance: 1000000,
                  lockedBalance: 0,
                  siteId,
                },
              },
            },
          });

          existingBots.push({ id: user.id, username: user.username });
        } catch (error) {
          this.logger.warn(`[${siteId}] Could not create bot ${botName}: ${error.message}`);
        }
      }
    }

    // Create the site pool
    const pool: SiteBotPool = {
      siteId,
      bots: existingBots.map((bot) => ({
        id: bot.id,
        username: bot.username,
        personality: this.assignPersonality(),
        siteId,
        currentBet: null,
        targetCashout: null,
      })),
      activeBets: new Map(),
      chatInterval: null,
      isEnabled: true,
      config,
    };

    this.sitePools.set(siteId, pool);

    // Start chat loop for this site
    if (config.chatEnabled) {
      this.startSiteChatLoop(siteId);
    }

    this.logger.log(`🤖 [${siteId}] Bot pool initialized with ${pool.bots.length} bots`);
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
        return 1.01 + Math.random() * 0.29;
      case 'NORMAL':
        return 1.50 + Math.random() * 1.50;
      case 'DEGEN':
        return 5.00 + Math.random() * 15.00;
      default:
        return 2.00;
    }
  }

  /**
   * Get random bet amount based on personality and site config
   */
  private getBetAmount(personality: BotPersonality, config: SiteBotPool['config']): number {
    const min = Number(config.minBetAmount);
    const max = Number(config.maxBetAmount);
    const range = max - min;

    switch (personality) {
      case 'CAUTIOUS':
        return Math.floor(min + Math.random() * (range * 0.2));
      case 'NORMAL':
        return Math.floor(min + range * 0.1 + Math.random() * (range * 0.4));
      case 'DEGEN':
        return Math.floor(min + range * 0.5 + Math.random() * (range * 0.5));
      default:
        return Math.floor(min + range * 0.25);
    }
  }

  /**
   * Handle game state changes - dispatch to all site pools
   */
  @OnEvent('crash.state_change')
  handleGameStateChange(data: { state: string; multiplier?: number }) {
    this.currentGameState = data.state as any;

    switch (data.state) {
      case 'WAITING':
      case 'STARTING':
        // Place bets for each active site pool
        for (const [siteId, pool] of this.sitePools.entries()) {
          if (pool.isEnabled) {
            this.placeSiteBotBets(siteId);
          }
        }
        break;
      case 'CRASHED':
        for (const [siteId, pool] of this.sitePools.entries()) {
          if (pool.isEnabled) {
            this.handleSiteCrash(siteId);
          }
        }
        break;
    }
  }

  /**
   * Handle tick events for cashout decisions - dispatch to all site pools
   */
  @OnEvent('crash.tick')
  handleTick(data: { multiplier: string | number }) {
    this.currentMultiplier = typeof data.multiplier === 'string'
      ? parseFloat(data.multiplier)
      : data.multiplier;

    for (const [siteId, pool] of this.sitePools.entries()) {
      if (pool.isEnabled) {
        this.checkSiteBotCashouts(siteId, this.currentMultiplier);
      }
    }
  }

  /**
   * Place bets for a specific site's bot pool
   */
  private async placeSiteBotBets(siteId: string) {
    const pool = this.sitePools.get(siteId);
    if (!pool || !pool.isEnabled || pool.bots.length === 0) return;

    const numBots = Math.floor(Math.max(5, pool.bots.length * 0.2) + Math.random() * (pool.bots.length * 0.3));
    const shuffled = [...pool.bots].sort(() => Math.random() - 0.5);
    const selectedBots = shuffled.slice(0, Math.min(numBots, pool.bots.length));

    this.logger.debug(`🎲 [${siteId}] ${selectedBots.length} bots placing bets...`);

    for (const bot of selectedBots) {
      const delay = Math.random() * 3000;

      setTimeout(async () => {
        if (this.currentGameState !== 'WAITING' && this.currentGameState !== 'STARTING') {
          return;
        }

        const amount = this.getBetAmount(bot.personality, pool.config);
        const targetCashout = this.getTargetCashout(bot.personality);

        pool.activeBets.set(bot.id, { amount, targetCashout });

        // Emit bet event with siteId for isolation
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
          siteId, // *** TENANT ISOLATION ***
        });

        this.logger.debug(`🤖 [${siteId}] ${bot.username} bet $${amount} (target: ${targetCashout.toFixed(2)}x)`);
      }, delay);
    }
  }

  /**
   * Check if any bots should cashout at current multiplier (per site)
   */
  private checkSiteBotCashouts(siteId: string, multiplier: number) {
    const pool = this.sitePools.get(siteId);
    if (!pool) return;

    for (const [botId, bet] of pool.activeBets.entries()) {
      const variance = 0.95 + Math.random() * 0.1;
      const adjustedTarget = bet.targetCashout * variance;

      if (multiplier >= adjustedTarget) {
        const bot = pool.bots.find(b => b.id === botId);
        if (!bot) continue;

        const profit = bet.amount * (multiplier - 1);

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
          siteId, // *** TENANT ISOLATION ***
        });

        this.logger.debug(`💰 [${siteId}] ${bot.username} cashed out at ${multiplier.toFixed(2)}x (+$${profit.toFixed(2)})`);
        pool.activeBets.delete(botId);
      }
    }
  }

  /**
   * Handle crash - clear remaining bets for a specific site
   */
  private handleSiteCrash(siteId: string) {
    const pool = this.sitePools.get(siteId);
    if (!pool) return;

    const lostBots = pool.activeBets.size;

    for (const [botId, bet] of pool.activeBets.entries()) {
      const bot = pool.bots.find(b => b.id === botId);
      if (bot) {
        this.logger.debug(`💀 [${siteId}] ${bot.username} lost $${bet.amount}`);
      }
    }

    if (lostBots > 0) {
      this.logger.debug(`💥 [${siteId}] ${lostBots} bots got rekt`);
    }

    pool.activeBets.clear();
  }

  /**
   * Start chat message loop for a specific site
   */
  private startSiteChatLoop(siteId: string) {
    const pool = this.sitePools.get(siteId);
    if (!pool) return;

    if (pool.chatInterval) {
      clearTimeout(pool.chatInterval);
    }

    const chatMessages = pool.config.customChatMessages && pool.config.customChatMessages.length > 0
      ? pool.config.customChatMessages
      : DEFAULT_CHAT_MESSAGES;

    const sendChatMessage = () => {
      if (!pool.isEnabled || pool.bots.length === 0) return;

      const bot = pool.bots[Math.floor(Math.random() * pool.bots.length)];
      const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];

      this.eventEmitter.emit('bot:chat_message', {
        oddsId: bot.id,
        oddsNumber: 0,
        userId: bot.id,
        username: bot.username,
        message,
        timestamp: new Date().toISOString(),
        isBot: true,
        siteId, // *** TENANT ISOLATION ***
      });

      this.logger.debug(`💬 [${siteId}] ${bot.username}: ${message}`);
    };

    const scheduleNext = () => {
      const minMs = pool.config.chatIntervalMin * 1000;
      const maxMs = pool.config.chatIntervalMax * 1000;
      const delay = minMs + Math.random() * (maxMs - minMs);

      pool.chatInterval = setTimeout(() => {
        sendChatMessage();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  /**
   * Toggle bot system on/off for a specific site
   */
  toggleSite(siteId: string, enable: boolean): { enabled: boolean; botCount: number } {
    const pool = this.sitePools.get(siteId);
    if (!pool) {
      return { enabled: false, botCount: 0 };
    }

    pool.isEnabled = enable;

    if (enable) {
      if (pool.config.chatEnabled) {
        this.startSiteChatLoop(siteId);
      }
      this.logger.log(`🤖 [${siteId}] Bot system ENABLED`);
    } else {
      if (pool.chatInterval) {
        clearTimeout(pool.chatInterval);
        pool.chatInterval = null;
      }
      pool.activeBets.clear();
      this.logger.log(`🤖 [${siteId}] Bot system DISABLED`);
    }

    return {
      enabled: pool.isEnabled,
      botCount: pool.bots.length,
    };
  }

  /**
   * Legacy toggle (for backward compatibility) - toggles all sites
   */
  toggle(enable: boolean): { enabled: boolean; botCount: number } {
    let totalBots = 0;
    for (const [siteId, pool] of this.sitePools.entries()) {
      const result = this.toggleSite(siteId, enable);
      totalBots += result.botCount;
    }
    return { enabled: enable, botCount: totalBots };
  }

  /**
   * Get bot system status for a specific site
   */
  getSiteStatus(siteId: string) {
    const pool = this.sitePools.get(siteId);
    if (!pool) {
      return {
        siteId,
        enabled: false,
        botCount: 0,
        activeBets: 0,
        currentGameState: this.currentGameState,
        personalities: { cautious: 0, normal: 0, degen: 0 },
      };
    }

    return {
      siteId,
      enabled: pool.isEnabled,
      botCount: pool.bots.length,
      activeBets: pool.activeBets.size,
      currentGameState: this.currentGameState,
      personalities: {
        cautious: pool.bots.filter(b => b.personality === 'CAUTIOUS').length,
        normal: pool.bots.filter(b => b.personality === 'NORMAL').length,
        degen: pool.bots.filter(b => b.personality === 'DEGEN').length,
      },
    };
  }

  /**
   * Legacy getStatus (backward compatibility) - returns aggregate
   */
  getStatus() {
    let totalBots = 0;
    let totalActiveBets = 0;
    let allEnabled = true;

    for (const pool of this.sitePools.values()) {
      totalBots += pool.bots.length;
      totalActiveBets += pool.activeBets.size;
      if (!pool.isEnabled) allEnabled = false;
    }

    return {
      enabled: allEnabled,
      botCount: totalBots,
      activeBets: totalActiveBets,
      currentGameState: this.currentGameState,
      siteCount: this.sitePools.size,
    };
  }

  /**
   * Reload bot config for a specific site (after admin changes)
   */
  async reloadSiteConfig(siteId: string) {
    // Stop existing pool
    const existingPool = this.sitePools.get(siteId);
    if (existingPool) {
      if (existingPool.chatInterval) {
        clearTimeout(existingPool.chatInterval);
      }
      existingPool.activeBets.clear();
      this.sitePools.delete(siteId);
    }

    // Reload from DB
    const botConfig = await this.prisma.botConfig.findUnique({
      where: { siteId },
    });

    if (botConfig && botConfig.enabled) {
      await this.initializeSiteBots(siteId, {
        botCount: botConfig.botCount,
        minBetAmount: Number(botConfig.minBetAmount),
        maxBetAmount: Number(botConfig.maxBetAmount),
        chatEnabled: botConfig.chatEnabled,
        chatIntervalMin: botConfig.chatIntervalMin,
        chatIntervalMax: botConfig.chatIntervalMax,
        botNamePrefix: botConfig.botNamePrefix,
        customChatMessages: botConfig.customChatMessages as string[] | null,
      });
    }

    return { siteId, reloaded: true };
  }

  /**
   * Manually trigger bot bets for a specific site (for testing)
   */
  async triggerBets(siteId?: string) {
    if (siteId) {
      await this.placeSiteBotBets(siteId);
      return { message: `Bot bets triggered for site ${siteId}` };
    }
    // Trigger for all sites
    for (const sid of this.sitePools.keys()) {
      await this.placeSiteBotBets(sid);
    }
    return { message: 'Bot bets triggered for all sites' };
  }

  /**
   * Manually trigger chat message for a specific site (for testing)
   */
  triggerChat(siteId?: string) {
    const targetSites = siteId
      ? [siteId]
      : Array.from(this.sitePools.keys());

    for (const sid of targetSites) {
      const pool = this.sitePools.get(sid);
      if (!pool || pool.bots.length === 0) continue;

      const bot = pool.bots[Math.floor(Math.random() * pool.bots.length)];
      const chatMessages = pool.config.customChatMessages && pool.config.customChatMessages.length > 0
        ? pool.config.customChatMessages
        : DEFAULT_CHAT_MESSAGES;
      const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];

      this.eventEmitter.emit('bot:chat_message', {
        userId: bot.id,
        username: bot.username,
        message,
        timestamp: new Date().toISOString(),
        isBot: true,
        siteId: sid,
      });
    }

    return { message: `Chat triggered for ${targetSites.length} site(s)` };
  }
}
