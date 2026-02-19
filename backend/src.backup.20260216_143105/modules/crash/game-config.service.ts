import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface GameConfig {
  houseEdge: number;        // 0.01 to 0.10 (1% to 10%)
  instantBust: number;      // 0 to 0.05 (0% to 5%)
  botsEnabled: boolean;
  maxBotBet: number;        // Max bet amount for bots
  minBotBet: number;        // Min bet amount for bots
  maxBotsPerRound: number;  // Max bots per round
}

@Injectable()
export class GameConfigService {
  private readonly logger = new Logger(GameConfigService.name);
  
  private config: GameConfig = {
    houseEdge: 0.04,        // 4% default
    instantBust: 0.02,      // 2% default
    botsEnabled: true,
    maxBotBet: 500,
    minBotBet: 5,
    maxBotsPerRound: 25,
  };

  constructor(private eventEmitter: EventEmitter2) {
    this.logger.log('🎮 Game Config Service initialized');
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<GameConfig>): GameConfig {
    // Validate house edge (1% to 10%)
    if (updates.houseEdge !== undefined) {
      updates.houseEdge = Math.max(0.01, Math.min(0.10, updates.houseEdge));
    }
    
    // Validate instant bust (0% to 5%)
    if (updates.instantBust !== undefined) {
      updates.instantBust = Math.max(0, Math.min(0.05, updates.instantBust));
    }
    
    // Validate bot bet limits
    if (updates.maxBotBet !== undefined) {
      updates.maxBotBet = Math.max(1, Math.min(10000, updates.maxBotBet));
    }
    if (updates.minBotBet !== undefined) {
      updates.minBotBet = Math.max(1, Math.min(updates.maxBotBet || this.config.maxBotBet, updates.minBotBet));
    }
    
    // Validate max bots per round
    if (updates.maxBotsPerRound !== undefined) {
      updates.maxBotsPerRound = Math.max(0, Math.min(50, updates.maxBotsPerRound));
    }

    this.config = { ...this.config, ...updates };
    
    this.logger.log(`🎮 Game config updated: ${JSON.stringify(updates)}`);
    
    // Emit event for other services to react
    this.eventEmitter.emit('game.config_updated', this.config);
    
    return this.getConfig();
  }

  // Getters for specific values
  get houseEdge(): number {
    return this.config.houseEdge;
  }

  get instantBust(): number {
    return this.config.instantBust;
  }

  get botsEnabled(): boolean {
    return this.config.botsEnabled;
  }

  get maxBotBet(): number {
    return this.config.maxBotBet;
  }

  get minBotBet(): number {
    return this.config.minBotBet;
  }

  get maxBotsPerRound(): number {
    return this.config.maxBotsPerRound;
  }
}
