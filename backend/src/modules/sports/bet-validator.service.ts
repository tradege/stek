import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AI Betting Guard & Odds Validator
 * 
 * 7-Layer Protection System:
 * 1. Arbitrage Detection (Mathematical)
 * 2. AI Anomaly Detection (OpenAI GPT)
 * 3. 7-Second Live Buffer (In-Play protection)
 * 4. Global Win Limits ($25K per ticket)
 * 5. Daily Payout Cap ($100K per day)
 * 6. Rate Limiting (anti-spam)
 * 7. Stake Pattern Detection (suspicious behavior)
 */

interface ValidationResult {
  approved: boolean;
  reason?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  checks: ValidationCheck[];
  requiresManualReview?: boolean;
  pendingValidation?: boolean; // 7-second buffer
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  details: string;
  duration?: number;
}

interface MarketOutcomes {
  home: number;
  away: number;
  draw?: number;
}

@Injectable()
export class BetValidatorService {
  private readonly logger = new Logger(BetValidatorService.name);
  
  // In-memory rate limiting store (userId -> timestamps[])
  private rateLimitStore: Map<string, number[]> = new Map();
  
  // In-memory stake pattern store (userId -> recent stakes[])
  private stakePatternStore: Map<string, { amount: number; selection: string; eventId: string; timestamp: number }[]> = new Map();

  // Configuration (loaded from env)
  private get MAX_PAYOUT_PER_TICKET(): number {
    return parseFloat(process.env.SPORTS_MAX_PAYOUT_TICKET || '25000');
  }
  private get MAX_PAYOUT_PER_DAY(): number {
    return parseFloat(process.env.SPORTS_MAX_PAYOUT_DAY || '100000');
  }
  private get MAX_BETS_PER_MINUTE(): number {
    return parseInt(process.env.SPORTS_RATE_LIMIT_PER_MIN || '5');
  }
  private get MAX_BETS_PER_HOUR(): number {
    return parseInt(process.env.SPORTS_RATE_LIMIT_PER_HOUR || '50');
  }
  private get LIVE_BUFFER_SECONDS(): number {
    return parseInt(process.env.SPORTS_LIVE_BUFFER_SECONDS || '7');
  }
  private get ODDS_CHANGE_THRESHOLD(): number {
    return parseFloat(process.env.SPORTS_ODDS_CHANGE_THRESHOLD || '0.10'); // 10%
  }
  private get AI_VALIDATION_ENABLED(): boolean {
    return process.env.SPORTS_AI_VALIDATION !== 'false';
  }
  private get DISCORD_WEBHOOK_URL(): string {
    return process.env.DISCORD_WEBHOOK_URL || '';
  }

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main validation pipeline - runs all checks in sequence
   */
  async validateBet(
    userId: string,
    eventId: string,
    selection: string,
    stake: number,
    odds: number,
    potentialWin: number,
    event: any,
    market: any,
  ): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    const startTime = Date.now();

    this.logger.log(`🔍 Validating bet: User ${userId}, ${event.homeTeam} vs ${event.awayTeam}, ${selection} @ ${odds}, stake: ${stake}`);

    // ═══════════════════════════════════════════
    // CHECK 1: Rate Limiting (Anti-Spam)
    // ═══════════════════════════════════════════
    const rateLimitCheck = this.checkRateLimit(userId);
    checks.push(rateLimitCheck);
    if (!rateLimitCheck.passed) {
      await this.notifyAdmin('RATE_LIMIT', userId, event, selection, odds, stake, rateLimitCheck.details);
      return { approved: false, reason: rateLimitCheck.details, riskLevel: 'HIGH', checks };
    }

    // ═══════════════════════════════════════════
    // CHECK 2: Global Win Limit ($25K per ticket)
    // ═══════════════════════════════════════════
    const winLimitCheck = this.checkWinLimit(potentialWin);
    checks.push(winLimitCheck);
    if (!winLimitCheck.passed) {
      await this.notifyAdmin('WIN_LIMIT', userId, event, selection, odds, stake, winLimitCheck.details);
      return { approved: false, reason: winLimitCheck.details, riskLevel: 'HIGH', checks };
    }

    // ═══════════════════════════════════════════
    // CHECK 3: Daily Payout Cap ($100K per day)
    // ═══════════════════════════════════════════
    const dailyCapCheck = await this.checkDailyPayoutCap(userId, potentialWin);
    checks.push(dailyCapCheck);
    if (!dailyCapCheck.passed) {
      await this.notifyAdmin('DAILY_CAP', userId, event, selection, odds, stake, dailyCapCheck.details);
      return { approved: false, reason: dailyCapCheck.details, riskLevel: 'HIGH', checks };
    }

    // ═══════════════════════════════════════════
    // CHECK 4: Arbitrage Detection (Mathematical)
    // ═══════════════════════════════════════════
    const outcomes = market.outcomes as MarketOutcomes;
    const arbitrageCheck = this.checkArbitrage(outcomes);
    checks.push(arbitrageCheck);
    if (!arbitrageCheck.passed) {
      riskLevel = 'CRITICAL';
      await this.notifyAdmin('ARBITRAGE', userId, event, selection, odds, stake, arbitrageCheck.details);
      return { approved: false, reason: arbitrageCheck.details, riskLevel, checks };
    }

    // ═══════════════════════════════════════════
    // CHECK 5: Stake Pattern Detection
    // ═══════════════════════════════════════════
    const patternCheck = this.checkStakePattern(userId, stake, selection, eventId);
    checks.push(patternCheck);
    if (!patternCheck.passed) {
      riskLevel = 'HIGH';
      await this.notifyAdmin('SUSPICIOUS_PATTERN', userId, event, selection, odds, stake, patternCheck.details);
      return { approved: false, reason: patternCheck.details, riskLevel, checks, requiresManualReview: true };
    }

    // ═══════════════════════════════════════════
    // CHECK 6: AI Anomaly Detection (OpenAI)
    // ═══════════════════════════════════════════
    if (this.AI_VALIDATION_ENABLED && event.status === 'LIVE') {
      const aiCheck = await this.checkAIAnomaly(event, selection, odds, stake);
      checks.push(aiCheck);
      if (!aiCheck.passed) {
        riskLevel = 'HIGH';
        await this.notifyAdmin('AI_ANOMALY', userId, event, selection, odds, stake, aiCheck.details);
        return { approved: false, reason: aiCheck.details, riskLevel, checks, requiresManualReview: true };
      }
    } else {
      checks.push({
        name: 'AI Anomaly Detection',
        passed: true,
        details: event.status === 'LIVE' ? 'AI validation skipped (disabled)' : 'AI validation not required for pre-match bets',
      });
    }

    // ═══════════════════════════════════════════
    // CHECK 7: 7-Second Live Buffer (In-Play)
    // ═══════════════════════════════════════════
    if (event.status === 'LIVE') {
      const bufferCheck: ValidationCheck = {
        name: '7-Second Live Buffer',
        passed: true,
        details: `In-play bet will be held for ${this.LIVE_BUFFER_SECONDS}s validation`,
      };
      checks.push(bufferCheck);
      
      const totalDuration = Date.now() - startTime;
      this.logger.log(`✅ Pre-validation passed in ${totalDuration}ms. Entering ${this.LIVE_BUFFER_SECONDS}s live buffer...`);
      
      return {
        approved: true,
        riskLevel: riskLevel === 'LOW' ? 'MEDIUM' : riskLevel,
        checks,
        pendingValidation: true, // Signal to hold the bet
      };
    }

    // Record the bet in rate limit and pattern stores
    this.recordBet(userId, stake, selection, eventId);

    const totalDuration = Date.now() - startTime;
    this.logger.log(`✅ All ${checks.length} validation checks passed in ${totalDuration}ms`);

    return { approved: true, riskLevel, checks };
  }

  /**
   * Live buffer validation - called after 7-second delay
   * Re-checks odds to detect significant movement
   */
  async validateLiveBuffer(
    eventId: string,
    selection: string,
    originalOdds: number,
    userId: string,
    stake: number,
  ): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    // Re-fetch current odds
    const event = await this.prisma.sportEvent.findUnique({
      where: { id: eventId },
      include: {
        markets: {
          where: { marketType: 'h2h' },
          orderBy: { lastUpdated: 'desc' },
          take: 1,
        },
      },
    });

    if (!event) {
      return { approved: false, reason: 'Event no longer available', riskLevel: 'HIGH', checks };
    }

    if (event.status === 'ENDED') {
      return { approved: false, reason: 'Event has ended during validation', riskLevel: 'HIGH', checks };
    }

    const market = event.markets[0];
    if (!market) {
      return { approved: false, reason: 'Market no longer available', riskLevel: 'HIGH', checks };
    }

    const currentOutcomes = market.outcomes as Record<string, number>;
    const currentOdds = currentOutcomes[selection];

    if (!currentOdds) {
      return { approved: false, reason: 'Selection no longer available', riskLevel: 'HIGH', checks };
    }

    // Check if odds dropped by more than threshold
    const oddsChange = (originalOdds - currentOdds) / originalOdds;
    const oddsDropped = oddsChange > this.ODDS_CHANGE_THRESHOLD;

    const bufferCheck: ValidationCheck = {
      name: 'Live Buffer Odds Check',
      passed: !oddsDropped,
      details: oddsDropped
        ? `Odds dropped ${(oddsChange * 100).toFixed(1)}% (${originalOdds} → ${currentOdds}). Threshold: ${this.ODDS_CHANGE_THRESHOLD * 100}%`
        : `Odds stable: ${originalOdds} → ${currentOdds} (change: ${(oddsChange * 100).toFixed(1)}%)`,
    };
    checks.push(bufferCheck);

    if (oddsDropped) {
      await this.notifyAdmin('ODDS_CHANGED', userId, event, selection, currentOdds, stake,
        `Odds dropped ${(oddsChange * 100).toFixed(1)}% during live buffer (${originalOdds} → ${currentOdds})`);
      return {
        approved: false,
        reason: `Odds changed significantly during validation. Original: ${originalOdds}, Current: ${currentOdds}`,
        riskLevel: 'MEDIUM',
        checks,
      };
    }

    // Record the bet
    this.recordBet(userId, stake, selection, eventId);

    return { approved: true, riskLevel: 'LOW', checks };
  }

  // ═══════════════════════════════════════════════════════
  // INDIVIDUAL CHECK IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════

  /**
   * CHECK 1: Rate Limiting
   * Prevents bet spam - max N bets per minute and per hour
   */
  private checkRateLimit(userId: string): ValidationCheck {
    const now = Date.now();
    const userBets = this.rateLimitStore.get(userId) || [];
    
    // Clean old entries (older than 1 hour)
    const recentBets = userBets.filter(t => now - t < 3600000);
    this.rateLimitStore.set(userId, recentBets);

    // Check per-minute limit
    const betsLastMinute = recentBets.filter(t => now - t < 60000).length;
    if (betsLastMinute >= this.MAX_BETS_PER_MINUTE) {
      return {
        name: 'Rate Limit',
        passed: false,
        details: `Too many bets. ${betsLastMinute}/${this.MAX_BETS_PER_MINUTE} bets in the last minute. Please wait.`,
      };
    }

    // Check per-hour limit
    if (recentBets.length >= this.MAX_BETS_PER_HOUR) {
      return {
        name: 'Rate Limit',
        passed: false,
        details: `Hourly bet limit reached. ${recentBets.length}/${this.MAX_BETS_PER_HOUR} bets in the last hour.`,
      };
    }

    return {
      name: 'Rate Limit',
      passed: true,
      details: `${betsLastMinute}/${this.MAX_BETS_PER_MINUTE} per minute, ${recentBets.length}/${this.MAX_BETS_PER_HOUR} per hour`,
    };
  }

  /**
   * CHECK 2: Global Win Limit
   * Max $25K potential payout per single ticket
   */
  private checkWinLimit(potentialWin: number): ValidationCheck {
    if (potentialWin > this.MAX_PAYOUT_PER_TICKET) {
      return {
        name: 'Win Limit',
        passed: false,
        details: `Potential win $${potentialWin.toFixed(2)} exceeds maximum payout of $${this.MAX_PAYOUT_PER_TICKET.toLocaleString()} per ticket.`,
      };
    }
    return {
      name: 'Win Limit',
      passed: true,
      details: `Potential win $${potentialWin.toFixed(2)} within $${this.MAX_PAYOUT_PER_TICKET.toLocaleString()} limit`,
    };
  }

  /**
   * CHECK 3: Daily Payout Cap
   * Max $100K total potential payouts per user per day
   */
  private async checkDailyPayoutCap(userId: string, potentialWin: number): Promise<ValidationCheck> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayBets = await this.prisma.sportBet.aggregate({
      where: {
        userId,
        createdAt: { gte: todayStart },
        status: { in: ['PENDING', 'WON'] },
      },
      _sum: { potentialWin: true },
    });

    const totalPotentialToday = Number(todayBets._sum.potentialWin || 0) + potentialWin;

    if (totalPotentialToday > this.MAX_PAYOUT_PER_DAY) {
      return {
        name: 'Daily Payout Cap',
        passed: false,
        details: `Daily potential payout $${totalPotentialToday.toFixed(2)} would exceed $${this.MAX_PAYOUT_PER_DAY.toLocaleString()} daily limit.`,
      };
    }

    return {
      name: 'Daily Payout Cap',
      passed: true,
      details: `Daily total: $${totalPotentialToday.toFixed(2)} / $${this.MAX_PAYOUT_PER_DAY.toLocaleString()}`,
    };
  }

  /**
   * CHECK 4: Arbitrage Detection
   * Calculates implied probability from all outcomes.
   * If combined margin < 0%, it means arbitrage opportunity exists (faulty odds).
   */
  private checkArbitrage(outcomes: MarketOutcomes): ValidationCheck {
    const impliedProbs: number[] = [];
    
    if (outcomes.home) impliedProbs.push(1 / outcomes.home);
    if (outcomes.away) impliedProbs.push(1 / outcomes.away);
    if (outcomes.draw) impliedProbs.push(1 / outcomes.draw);

    const totalImplied = impliedProbs.reduce((sum, p) => sum + p, 0);
    const margin = (totalImplied - 1) * 100; // Bookmaker margin in %

    if (margin < 0) {
      return {
        name: 'Arbitrage Detection',
        passed: false,
        details: `ARBITRAGE DETECTED! Market margin: ${margin.toFixed(2)}% (negative = guaranteed profit). Odds: Home=${outcomes.home}, Away=${outcomes.away}${outcomes.draw ? `, Draw=${outcomes.draw}` : ''}`,
      };
    }

    // Also flag suspiciously low margins (< 1%) as potential data errors
    if (margin < 1) {
      return {
        name: 'Arbitrage Detection',
        passed: false,
        details: `Suspiciously low margin: ${margin.toFixed(2)}%. Possible data error. Odds: Home=${outcomes.home}, Away=${outcomes.away}${outcomes.draw ? `, Draw=${outcomes.draw}` : ''}`,
      };
    }

    return {
      name: 'Arbitrage Detection',
      passed: true,
      details: `Market margin: ${margin.toFixed(2)}% (healthy). Total implied probability: ${(totalImplied * 100).toFixed(1)}%`,
    };
  }

  /**
   * CHECK 5: Stake Pattern Detection
   * Detects suspicious betting patterns:
   * - Same selection repeated 3+ times with increasing stakes
   * - Rapid-fire bets on same event
   * - Stake amounts that suggest insider knowledge
   */
  private checkStakePattern(userId: string, stake: number, selection: string, eventId: string): ValidationCheck {
    const now = Date.now();
    const userPatterns = this.stakePatternStore.get(userId) || [];
    
    // Clean entries older than 30 minutes
    const recentPatterns = userPatterns.filter(p => now - p.timestamp < 1800000);
    this.stakePatternStore.set(userId, recentPatterns);

    // Pattern 1: Same selection on same event 3+ times with increasing stakes
    const sameEventBets = recentPatterns.filter(p => p.eventId === eventId && p.selection === selection);
    if (sameEventBets.length >= 2) {
      const isIncreasing = sameEventBets.every((bet, i) => {
        if (i === 0) return true;
        return bet.amount <= sameEventBets[i - 1].amount * 0.8 ? false : true;
      }) && stake > sameEventBets[sameEventBets.length - 1].amount;

      if (isIncreasing && sameEventBets.length >= 2) {
        return {
          name: 'Stake Pattern Detection',
          passed: false,
          details: `Suspicious pattern: ${sameEventBets.length + 1} escalating bets on same outcome (${selection}). Stakes: ${sameEventBets.map(b => b.amount).join(' → ')} → ${stake}. Flagged for manual review.`,
        };
      }
    }

    // Pattern 2: Too many bets on same event (any selection) in short time
    const sameEventAllBets = recentPatterns.filter(p => p.eventId === eventId);
    if (sameEventAllBets.length >= 5) {
      return {
        name: 'Stake Pattern Detection',
        passed: false,
        details: `Too many bets on same event: ${sameEventAllBets.length + 1} bets in 30 minutes. Possible hedging or manipulation.`,
      };
    }

    // Pattern 3: Sudden large stake (10x user's average)
    if (recentPatterns.length >= 3) {
      const avgStake = recentPatterns.reduce((sum, p) => sum + p.amount, 0) / recentPatterns.length;
      if (stake > avgStake * 10 && stake > 500) {
        return {
          name: 'Stake Pattern Detection',
          passed: false,
          details: `Abnormal stake: $${stake} is ${(stake / avgStake).toFixed(1)}x the user's recent average ($${avgStake.toFixed(2)}). Flagged for review.`,
        };
      }
    }

    return {
      name: 'Stake Pattern Detection',
      passed: true,
      details: `No suspicious patterns detected. Recent bets: ${recentPatterns.length}`,
    };
  }

  /**
   * CHECK 6: AI Anomaly Detection
   * Uses OpenAI to evaluate if odds make sense given match context
   * Falls back to mathematical validation if API is unavailable
   */
  private async checkAIAnomaly(
    event: any,
    selection: string,
    odds: number,
    stake: number,
  ): Promise<ValidationCheck> {
    const startTime = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Fallback: mathematical-only validation
      return this.fallbackMathValidation(event, selection, odds, stake);
    }

    try {
      const homeScore = event.homeScore ?? '?';
      const awayScore = event.awayScore ?? '?';
      const minutesPlayed = event.minutePlayed ?? '?';
      
      const prompt = `You are a sports betting odds validator for a licensed sportsbook. Analyze this LIVE bet for anomalies.

Match: ${event.homeTeam} vs ${event.awayTeam}
Sport: ${event.sportKey}
Score: ${homeScore} - ${awayScore}
Time: ${minutesPlayed} minutes played
Status: ${event.status}

Bet Details:
- Selection: ${selection} (${selection === 'home' ? event.homeTeam : selection === 'away' ? event.awayTeam : 'Draw'})
- Odds offered: ${odds}
- Stake: $${stake}

Question: Are these odds LOGICAL given the current match state? Consider:
1. Does the score justify these odds?
2. Is the time remaining consistent with the odds?
3. Could this be a data feed error?

Respond with EXACTLY one word: LOGICAL or UNLOGICAL
Then on a new line, provide a brief reason (max 50 words).`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`⚠️ OpenAI API returned ${response.status}. Falling back to math validation.`);
        return this.fallbackMathValidation(event, selection, odds, stake);
      }

      const data = await response.json() as any;
      const aiResponse = data.choices?.[0]?.message?.content?.trim() || '';
      const duration = Date.now() - startTime;

      const isLogical = aiResponse.toUpperCase().startsWith('LOGICAL');
      const reason = aiResponse.split('\n').slice(1).join(' ').trim() || 'No reason provided';

      this.logger.log(`🤖 AI Validation (${duration}ms): ${isLogical ? 'LOGICAL' : 'UNLOGICAL'} - ${reason}`);

      return {
        name: 'AI Anomaly Detection',
        passed: isLogical,
        details: isLogical
          ? `AI approved (${duration}ms): ${reason}`
          : `AI FLAGGED (${duration}ms): ${reason}. Bet requires manual review.`,
        duration,
      };
    } catch (error) {
      this.logger.error(`❌ AI validation error: ${error.message}. Falling back to math validation.`);
      return this.fallbackMathValidation(event, selection, odds, stake);
    }
  }

  /**
   * Fallback validation when AI is unavailable
   * Uses mathematical rules to detect obvious anomalies
   */
  private fallbackMathValidation(event: any, selection: string, odds: number, stake: number): ValidationCheck {
    const issues: string[] = [];

    // Rule 1: Extremely high odds on a live match with significant score difference
    if (event.homeScore !== null && event.awayScore !== null) {
      const scoreDiff = Math.abs(event.homeScore - event.awayScore);
      const leadingTeam = event.homeScore > event.awayScore ? 'home' : 'away';
      
      // If leading team has very high odds (>5), something is wrong
      if (selection === leadingTeam && odds > 5) {
        issues.push(`Leading team has unusually high odds (${odds})`);
      }
      
      // If score is 3-0+ and losing team has odds < 2, suspicious
      if (scoreDiff >= 3 && selection !== leadingTeam && odds < 2) {
        issues.push(`Losing by ${scoreDiff} goals but odds are only ${odds}`);
      }
    }

    // Rule 2: Odds below 1.01 (essentially free money)
    if (odds < 1.01) {
      issues.push(`Odds ${odds} are below 1.01 - possible data error`);
    }

    // Rule 3: Odds above 100 (extremely unlikely but could be exploit)
    if (odds > 100 && stake > 100) {
      issues.push(`Very high odds (${odds}) with significant stake ($${stake})`);
    }

    if (issues.length > 0) {
      return {
        name: 'AI Anomaly Detection (Fallback)',
        passed: false,
        details: `Mathematical anomaly: ${issues.join('; ')}`,
      };
    }

    return {
      name: 'AI Anomaly Detection (Fallback)',
      passed: true,
      details: 'Mathematical validation passed (AI unavailable)',
    };
  }

  // ═══════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════

  /**
   * Record a bet in the rate limit and pattern stores
   */
  private recordBet(userId: string, stake: number, selection: string, eventId: string): void {
    const now = Date.now();
    
    // Rate limit store
    const userBets = this.rateLimitStore.get(userId) || [];
    userBets.push(now);
    this.rateLimitStore.set(userId, userBets);

    // Pattern store
    const userPatterns = this.stakePatternStore.get(userId) || [];
    userPatterns.push({ amount: stake, selection, eventId, timestamp: now });
    this.stakePatternStore.set(userId, userPatterns);
  }

  /**
   * Send notification to Discord webhook
   */
  async notifyAdmin(
    type: string,
    userId: string,
    event: any,
    selection: string,
    odds: number,
    stake: number,
    details: string,
  ): Promise<void> {
    const webhookUrl = this.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn(`⚠️ Discord webhook not configured. Alert: [${type}] ${details}`);
      
      // Also log to database for admin panel visibility
      try {
        await this.prisma.$executeRaw`
          INSERT INTO "BetAlert" (id, type, "userId", "eventId", selection, odds, stake, details, "createdAt")
          VALUES (gen_random_uuid(), ${type}, ${userId}, ${event.id}, ${selection}, ${odds}, ${stake}, ${details}, NOW())
        `;
      } catch (e) {
        // Table might not exist yet, just log
        this.logger.warn(`Could not save alert to DB: ${e.message}`);
      }
      return;
    }

    const colorMap: Record<string, number> = {
      RATE_LIMIT: 0xFFA500,     // Orange
      WIN_LIMIT: 0xFF0000,      // Red
      DAILY_CAP: 0xFF0000,      // Red
      ARBITRAGE: 0xFF0000,      // Red
      SUSPICIOUS_PATTERN: 0xFF6600, // Dark Orange
      AI_ANOMALY: 0xFF00FF,     // Purple
      ODDS_CHANGED: 0xFFFF00,   // Yellow
    };

    const embed = {
      embeds: [{
        title: `🚨 Bet Alert: ${type.replace(/_/g, ' ')}`,
        color: colorMap[type] || 0xFF0000,
        fields: [
          { name: '👤 User', value: userId.substring(0, 8) + '...', inline: true },
          { name: '⚽ Match', value: `${event.homeTeam} vs ${event.awayTeam}`, inline: true },
          { name: '🎯 Selection', value: selection, inline: true },
          { name: '📊 Odds', value: String(odds), inline: true },
          { name: '💰 Stake', value: `$${stake}`, inline: true },
          { name: '🏆 Potential Win', value: `$${(stake * odds).toFixed(2)}`, inline: true },
          { name: '📋 Details', value: details.substring(0, 1024) },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Betworkss AI Betting Guard' },
      }],
    };

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed),
      });
      this.logger.log(`📢 Discord alert sent: [${type}]`);
    } catch (error) {
      this.logger.error(`❌ Failed to send Discord alert: ${error.message}`);
    }
  }

  /**
   * Get validation stats for admin panel
   */
  async getValidationStats(): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let alertsToday = 0;
    try {
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM "BetAlert" WHERE "createdAt" >= ${todayStart}
      `;
      alertsToday = parseInt(result[0]?.count || '0');
    } catch (e) {
      // Table might not exist
    }

    return {
      config: {
        maxPayoutPerTicket: this.MAX_PAYOUT_PER_TICKET,
        maxPayoutPerDay: this.MAX_PAYOUT_PER_DAY,
        maxBetsPerMinute: this.MAX_BETS_PER_MINUTE,
        maxBetsPerHour: this.MAX_BETS_PER_HOUR,
        liveBufferSeconds: this.LIVE_BUFFER_SECONDS,
        oddsChangeThreshold: `${this.ODDS_CHANGE_THRESHOLD * 100}%`,
        aiValidationEnabled: this.AI_VALIDATION_ENABLED,
        discordWebhookConfigured: !!this.DISCORD_WEBHOOK_URL,
      },
      stats: {
        alertsToday,
        activeRateLimitUsers: this.rateLimitStore.size,
        trackedPatternUsers: this.stakePatternStore.size,
      },
    };
  }

  /**
   * Get recent alerts for admin panel
   */
  async getRecentAlerts(limit = 50): Promise<any[]> {
    try {
      return await this.prisma.$queryRaw<any[]>`
        SELECT * FROM "BetAlert" ORDER BY "createdAt" DESC LIMIT ${limit}
      `;
    } catch (e) {
      return [];
    }
  }
}
