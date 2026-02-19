// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getGameConfig } from '../../common/helpers/game-tenant.helper';

/**
 * SPORTS ODDS SERVICE
 * Fetches odds from The Odds API and handles settlement.
 * 
 * Strategy: Aggressive Caching
 * - Fetch odds every 90 minutes (max ~480 calls/month on free tier of 500)
 * - Fetch scores every 2 hours for settlement
 * - Focus on high-traffic leagues: EPL, Champions League, NBA, Euroleague
 */

// Supported leagues with their API sport keys
const SUPPORTED_LEAGUES = [
  { key: 'soccer_epl', title: 'Premier League', icon: '⚽' },
  { key: 'soccer_uefa_champs_league', title: 'Champions League', icon: '⚽' },
  { key: 'basketball_nba', title: 'NBA', icon: '🏀' },
  { key: 'basketball_euroleague', title: 'Euroleague', icon: '🏀' },
];

const API_BASE = 'https://api.the-odds-api.com/v4/sports';

/**
 * Default sports margin (juice/vig) applied to bookmaker odds.
 * This reduces the decimal odds to ensure platform profitability.
 * Example: Bookmaker odds 2.00 with 5% margin -> 2.00 * 0.95 = 1.90
 * Can be overridden per-brand via SiteConfiguration.
 */
const DEFAULT_SPORTS_MARGIN = 0.05; // 5% margin

@Injectable()
export class SportsOddsService {
  private readonly logger = new Logger(SportsOddsService.name);
  private apiKey: string;
  private lastFetchTime: Date | null = null;
  private apiCallsThisMonth = 0;
  private readonly MAX_MONTHLY_CALLS = 480; // Safety margin under 500

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('ODDS_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('⚠️ ODDS_API_KEY not set - sports betting will use cached data only');
    }
  }

  // ============================================
  // CRON: Fetch Odds Every 90 Minutes
  // ============================================
  @Cron('0 */90 * * * *') // Every 90 minutes
  async fetchOddsCron() {
    this.logger.log('🏟️ [CRON] Starting odds fetch cycle...');
    await this.fetchAllLeagueOdds();
  }

  // ============================================
  // CRON: Settle Bets Every 2 Hours
  // ============================================
  @Cron('0 0 */2 * * *') // Every 2 hours
  async settleBetsCron() {
    this.logger.log('⚖️ [CRON] Starting bet settlement cycle...');
    await this.fetchScoresAndSettle();
  }

  // ============================================
  // FETCH ODDS FROM ALL LEAGUES
  // ============================================
  async fetchAllLeagueOdds(): Promise<{ fetched: number; errors: number }> {
    if (!this.apiKey) {
      this.logger.warn('No API key configured, skipping fetch');
      return { fetched: 0, errors: 0 };
    }

    // Safety check: don't exceed monthly limit
    if (this.apiCallsThisMonth >= this.MAX_MONTHLY_CALLS) {
      this.logger.warn(`⚠️ Monthly API call limit reached (${this.apiCallsThisMonth}/${this.MAX_MONTHLY_CALLS}). Skipping fetch.`);
      return { fetched: 0, errors: 0 };
    }

    let totalFetched = 0;
    let totalErrors = 0;

    for (const league of SUPPORTED_LEAGUES) {
      try {
        const count = await this.fetchLeagueOdds(league.key, league.title);
        totalFetched += count;
        this.apiCallsThisMonth++;
      } catch (error) {
        this.logger.error(`Failed to fetch odds for ${league.key}: ${error.message}`);
        totalErrors++;
      }
    }

    this.lastFetchTime = new Date();
    this.logger.log(`🏟️ Odds fetch complete: ${totalFetched} events updated, ${totalErrors} errors. API calls this month: ${this.apiCallsThisMonth}`);
    return { fetched: totalFetched, errors: totalErrors };
  }

  // ============================================
  // FETCH ODDS FOR A SINGLE LEAGUE
  // ============================================
  async fetchLeagueOdds(sportKey: string, sportTitle: string): Promise<number> {
    const url = `${API_BASE}/${sportKey}/odds/?apiKey=${this.apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;
    
    this.logger.log(`📡 Fetching odds for ${sportKey}...`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const events = await response.json();
    
    // Log remaining requests from headers
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    if (remaining) {
      this.logger.log(`📊 API quota: ${used} used, ${remaining} remaining`);
    }

    let upsertCount = 0;

    for (const event of events) {
      try {
        // Upsert the event
        const sportEvent = await this.prisma.sportEvent.upsert({
          where: { externalId: event.id },
          create: {
            externalId: event.id,
            sport: sportKey,
            sportKey: sportKey,
            sportTitle: sportTitle,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime: new Date(event.commence_time),
            status: new Date(event.commence_time) > new Date() ? 'UPCOMING' : 'LIVE',
          },
          update: {
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime: new Date(event.commence_time),
            status: new Date(event.commence_time) > new Date() ? 'UPCOMING' : 'LIVE',
          },
        });

        // Process bookmaker odds - pick the best available (prefer pinnacle)
        if (event.bookmakers && event.bookmakers.length > 0) {
          // Sort bookmakers: prefer pinnacle, then first available
          const sortedBookmakers = event.bookmakers.sort((a: any, b: any) => {
            if (a.key === 'pinnacle') return -1;
            if (b.key === 'pinnacle') return 1;
            return 0;
          });

          for (const bookmaker of sortedBookmakers.slice(0, 1)) { // Take best bookmaker only
            for (const market of bookmaker.markets) {
              if (market.key !== 'h2h') continue; // Only h2h for now

              // Build outcomes JSON with platform margin applied
              const marginFactor = 1 - DEFAULT_SPORTS_MARGIN; // e.g., 0.95
              const outcomes: Record<string, number> = {};
              const rawOutcomes: Record<string, number> = {}; // Keep raw for reference
              for (const outcome of market.outcomes) {
                if (outcome.name === event.home_team) {
                  rawOutcomes.home = outcome.price;
                  outcomes.home = parseFloat((outcome.price * marginFactor).toFixed(2));
                } else if (outcome.name === event.away_team) {
                  rawOutcomes.away = outcome.price;
                  outcomes.away = parseFloat((outcome.price * marginFactor).toFixed(2));
                } else if (outcome.name === 'Draw') {
                  rawOutcomes.draw = outcome.price;
                  outcomes.draw = parseFloat((outcome.price * marginFactor).toFixed(2));
                }
              }

              await this.prisma.sportMarket.upsert({
                where: {
                  eventId_bookmaker_marketType: {
                    eventId: sportEvent.id,
                    bookmaker: bookmaker.key,
                    marketType: market.key,
                  },
                },
                create: {
                  eventId: sportEvent.id,
                  bookmaker: bookmaker.key,
                  marketType: market.key,
                  type: market.key,
                  name: market.key,
                  odds: {},
                  outcomes: outcomes,
                  lastUpdated: new Date(bookmaker.last_update || Date.now()),
                },
                update: {
                  outcomes: outcomes,
                  lastUpdated: new Date(bookmaker.last_update || Date.now()),
                },
              });
            }
          }
        }

        upsertCount++;
      } catch (error) {
        this.logger.error(`Failed to upsert event ${event.id}: ${error.message}`);
      }
    }

    this.logger.log(`✅ ${sportKey}: ${upsertCount}/${events.length} events processed`);
    return upsertCount;
  }

  // ============================================
  // FETCH SCORES AND SETTLE BETS
  // ============================================
  async fetchScoresAndSettle(): Promise<{ settled: number; errors: number }> {
    if (!this.apiKey) {
      this.logger.warn('No API key configured, skipping settlement');
      return { settled: 0, errors: 0 };
    }

    if (this.apiCallsThisMonth >= this.MAX_MONTHLY_CALLS) {
      this.logger.warn('Monthly API call limit reached, skipping settlement');
      return { settled: 0, errors: 0 };
    }

    let totalSettled = 0;
    let totalErrors = 0;

    for (const league of SUPPORTED_LEAGUES) {
      try {
        const settled = await this.fetchLeagueScores(league.key);
        totalSettled += settled;
        this.apiCallsThisMonth++;
      } catch (error) {
        this.logger.error(`Failed to fetch scores for ${league.key}: ${error.message}`);
        totalErrors++;
      }
    }

    this.logger.log(`⚖️ Settlement complete: ${totalSettled} bets settled, ${totalErrors} errors`);
    return { settled: totalSettled, errors: totalErrors };
  }

  // ============================================
  // FETCH SCORES FOR A SINGLE LEAGUE
  // ============================================
  async fetchLeagueScores(sportKey: string): Promise<number> {
    const url = `${API_BASE}/${sportKey}/scores/?apiKey=${this.apiKey}&daysFrom=3`;
    
    this.logger.log(`📊 Fetching scores for ${sportKey}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Scores API error ${response.status}`);
    }

    const events = await response.json();
    let settledCount = 0;

    for (const event of events) {
      if (!event.completed) continue;

      try {
        // Find the event in our DB
        const sportEvent = await this.prisma.sportEvent.findUnique({
          where: { externalId: event.id },
        });

        if (!sportEvent || sportEvent.completed) continue;

        // Extract scores
        let homeScore: number | null = null;
        let awayScore: number | null = null;

        if (event.scores) {
          for (const score of event.scores) {
            if (score.name === event.home_team) {
              homeScore = parseInt(score.score);
            } else if (score.name === event.away_team) {
              awayScore = parseInt(score.score);
            }
          }
        }

        if (homeScore === null || awayScore === null) continue;

        // Update event with scores
        await this.prisma.sportEvent.update({
          where: { id: sportEvent.id },
          data: {
            homeScore,
            awayScore,
            completed: true,
            status: 'ENDED',
          },
        });

        // Determine winner
        let winner: string;
        if (homeScore > awayScore) {
          winner = 'home';
        } else if (awayScore > homeScore) {
          winner = 'away';
        } else {
          winner = 'draw';
        }

        // Settle all pending bets for this event
        const pendingBets = await this.prisma.sportBet.findMany({
          where: {
            eventId: sportEvent.id,
            status: 'PENDING',
          },
          include: { user: true },
        });

        for (const bet of pendingBets) {
          const isWin = bet.selection === winner;
          const profit = isWin
            ? Number(bet.potentialWin) - Number(bet.stake)
            : -Number(bet.stake);

          await this.prisma.$transaction(async (tx) => {
            // Update bet status
            await tx.sportBet.update({
              where: { id: bet.id },
              data: {
                status: isWin ? 'WON' : 'LOST',
                profit: profit,
                settledAt: new Date(),
              },
            });

            // If won, credit the user's wallet
            if (isWin) {
              const wallet = await tx.wallet.findFirst({
                where: {
                  userId: bet.userId,
                  currency: bet.currency as any,
                },
              });

              if (wallet) {
                const currentBalance = Number(wallet.balance);
                const newBalance = currentBalance + Number(bet.potentialWin);

                await tx.wallet.update({
                  where: { id: wallet.id },
                  data: { balance: newBalance },
                });

                await tx.transaction.create({
                  data: {
                    userId: bet.userId,
                    walletId: wallet.id,
                    type: 'WIN',
                    status: 'CONFIRMED',
                    amount: Number(bet.potentialWin),
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    confirmedAt: new Date(),
                    siteId: bet.siteId,
                    metadata: {
                      sportBetId: bet.id,
                      eventId: sportEvent.id,
                      selection: bet.selection,
                      odds: Number(bet.odds),
                      homeTeam: sportEvent.homeTeam,
                      awayTeam: sportEvent.awayTeam,
                      score: `${homeScore}-${awayScore}`,
                    },
                  },
                });
              }
            }
          });

          settledCount++;
        }

        this.logger.log(`🏆 Event ${sportEvent.homeTeam} vs ${sportEvent.awayTeam}: ${homeScore}-${awayScore} (${winner}). Settled ${pendingBets.length} bets.`);
      } catch (error) {
        this.logger.error(`Failed to settle event ${event.id}: ${error.message}`);
      }
    }

    return settledCount;
  }

  // ============================================
  // PUBLIC API METHODS
  // ============================================

  /**
   * Get all upcoming events grouped by league
   */
  async getUpcomingEvents(sportKey?: string) {
    const where: any = {
      status: { in: ['UPCOMING', 'LIVE'] },
      commenceTime: { gte: new Date() },
    };
    if (sportKey) {
      where.sportKey = sportKey;
    }

    const events = await this.prisma.sportEvent.findMany({
      where,
      include: {
        markets: {
          where: { marketType: 'h2h' },
          orderBy: { lastUpdated: 'desc' },
          take: 1,
        },
      },
      orderBy: { commenceTime: 'asc' },
    });

    // Group by sportKey
    const grouped: Record<string, any[]> = {};
    for (const event of events) {
      if (!grouped[event.sportKey]) {
        grouped[event.sportKey] = [];
      }
      grouped[event.sportKey].push({
        id: event.id,
        externalId: event.externalId,
        sportKey: event.sportKey,
        sportTitle: event.sportTitle,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        commenceTime: event.commenceTime,
        status: event.status,
        odds: event.markets[0]?.outcomes || null,
      });
    }

    return {
      leagues: SUPPORTED_LEAGUES.map(l => ({
        ...l,
        events: grouped[l.key] || [],
        eventCount: (grouped[l.key] || []).length,
      })),
      totalEvents: events.length,
      lastFetch: this.lastFetchTime,
    };
  }

  /**
   * Get a single event with full details
   */
  async getEventById(eventId: string) {
    const event = await this.prisma.sportEvent.findUnique({
      where: { id: eventId },
      include: {
        markets: true,
        bets: {
          select: {
            id: true,
            selection: true,
            odds: true,
            stake: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    return event;
  }

  /**
   * Place a sports bet
   */
  async placeBet(
    userId: string,
    eventId: string,
    selection: string, // "home", "away", "draw"
    stake: number,
    currency: string,
    siteId?: string,
  ) {
    // Validate event exists and is open for betting
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
      throw new Error('Event not found');
    }

    if (event.status !== 'UPCOMING') {
      throw new Error('Event is no longer open for betting');
    }

    if (new Date(event.commenceTime) <= new Date()) {
      throw new Error('Event has already started');
    }

    // Get odds
    const market = event.markets[0];
    if (!market) {
      throw new Error('No odds available for this event');
    }

    const outcomes = market.outcomes as Record<string, number>;
    const odds = outcomes[selection];
    if (!odds) {
      throw new Error(`Invalid selection "${selection}". Available: ${Object.keys(outcomes).join(', ')}`);
    }

    // Validate stake
    if (stake < 1) {
      throw new Error('Minimum bet is 1');
    }
    if (stake > 10000) {
      throw new Error('Maximum bet is 10,000');
    }

    const potentialWin = stake * odds;

    // Get selection name
    let selectionName = selection;
    if (selection === 'home') selectionName = event.homeTeam;
    else if (selection === 'away') selectionName = event.awayTeam;
    else if (selection === 'draw') selectionName = 'Draw';

    // Debit user wallet and create bet in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock wallet
      const wallets = await tx.$queryRaw<any[]>`
        SELECT id, balance FROM "Wallet" 
        WHERE "userId" = ${userId} AND currency = ${currency}::"Currency"
        FOR UPDATE
      `;

      if (!wallets || wallets.length === 0) {
        throw new Error('Wallet not found');
      }

      const wallet = wallets[0];
      const currentBalance = Number(wallet.balance);

      if (currentBalance < stake) {
        throw new Error('Insufficient balance');
      }

      const newBalance = currentBalance - stake;

      // Debit wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Create bet transaction
      await tx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'BET',
          status: 'CONFIRMED',
          amount: -stake,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          confirmedAt: new Date(),
          siteId: siteId || null,
          metadata: {
            sportBet: true,
            eventId,
            selection,
            odds,
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
          },
        },
      });

      // Create sport bet
      const sportBet = await tx.sportBet.create({
        data: {
          userId,
          eventId,
          siteId: siteId || null,
          selection,
          selectionName,
          odds,
          stake,
          potentialWin,
          currency: currency as any,
          status: 'PENDING',
        },
      });

      return {
        bet: sportBet,
        newBalance,
      };
    });

    this.logger.log(`🎰 Sport bet placed: ${userId} bet ${stake} on ${selectionName} @ ${odds} for ${event.homeTeam} vs ${event.awayTeam}`);

    return result;
  }

  /**
   * Get user's sport bets
   */
  async getUserBets(userId: string, status?: string, limit = 50) {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return this.prisma.sportBet.findMany({
      where,
      include: {
        event: {
          select: {
            homeTeam: true,
            awayTeam: true,
            sportKey: true,
            sportTitle: true,
            commenceTime: true,
            status: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Force settle an event (admin)
   */
  async forceSettle(eventId: string, homeScore: number, awayScore: number) {
    const event = await this.prisma.sportEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) throw new Error('Event not found');

    // Update event
    await this.prisma.sportEvent.update({
      where: { id: eventId },
      data: {
        homeScore,
        awayScore,
        completed: true,
        status: 'ENDED',
      },
    });

    // Determine winner
    let winner: string;
    if (homeScore > awayScore) winner = 'home';
    else if (awayScore > homeScore) winner = 'away';
    else winner = 'draw';

    // Settle pending bets
    const pendingBets = await this.prisma.sportBet.findMany({
      where: { eventId, status: 'PENDING' },
    });

    let settledCount = 0;

    for (const bet of pendingBets) {
      const isWin = bet.selection === winner;
      const profit = isWin
        ? Number(bet.potentialWin) - Number(bet.stake)
        : -Number(bet.stake);

      await this.prisma.$transaction(async (tx) => {
        await tx.sportBet.update({
          where: { id: bet.id },
          data: {
            status: isWin ? 'WON' : 'LOST',
            profit,
            settledAt: new Date(),
          },
        });

        if (isWin) {
          const wallet = await tx.wallet.findFirst({
            where: { userId: bet.userId, currency: bet.currency as any },
          });

          if (wallet) {
            const currentBalance = Number(wallet.balance);
            const newBalance = currentBalance + Number(bet.potentialWin);

            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: newBalance },
            });

            await tx.transaction.create({
              data: {
                userId: bet.userId,
                walletId: wallet.id,
                type: 'WIN',
                status: 'CONFIRMED',
                amount: Number(bet.potentialWin),
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                confirmedAt: new Date(),
                siteId: bet.siteId,
                metadata: {
                  sportBetId: bet.id,
                  forceSettled: true,
                  score: `${homeScore}-${awayScore}`,
                },
              },
            });
          }
        }
      });

      settledCount++;
    }

    return {
      event: event.homeTeam + ' vs ' + event.awayTeam,
      score: `${homeScore}-${awayScore}`,
      winner,
      settledBets: settledCount,
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      apiKeyConfigured: !!this.apiKey,
      lastFetchTime: this.lastFetchTime,
      apiCallsThisMonth: this.apiCallsThisMonth,
      maxMonthlyCallsLimit: this.MAX_MONTHLY_CALLS,
      supportedLeagues: SUPPORTED_LEAGUES,
    };
  }

  /**
   * Manual trigger for odds fetch (admin)
   */
  async triggerFetch() {
    return this.fetchAllLeagueOdds();
  }

  /**
   * Manual trigger for settlement (admin)
   */
  async triggerSettlement() {
    return this.fetchScoresAndSettle();
  }

  /**
   * Get all sport bets with filters (admin)
   */
  async getAllBets(filters: {
    status?: string;
    siteId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.siteId) where.siteId = filters.siteId;

    const [bets, total] = await Promise.all([
      this.prisma.sportBet.findMany({
        where,
        include: {
          user: { select: { username: true, email: true } },
          event: {
            select: {
              homeTeam: true,
              awayTeam: true,
              sportKey: true,
              sportTitle: true,
              commenceTime: true,
              status: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.sportBet.count({ where }),
    ]);

    return { bets, total };
  }

  /**
   * Get sports betting stats (admin)
   */
  async getStats(siteId?: string) {
    const where: any = siteId ? { siteId } : {};

    const [
      totalBets,
      pendingBets,
      totalStaked,
      totalPaidOut,
      totalEvents,
      upcomingEvents,
    ] = await Promise.all([
      this.prisma.sportBet.count({ where }),
      this.prisma.sportBet.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.sportBet.aggregate({
        where,
        _sum: { amount: true },
      }),
      this.prisma.sportBet.aggregate({
        where: { ...where, status: 'WON' },
        _sum: { potentialWin: true },
      }),
      this.prisma.sportEvent.count(),
      this.prisma.sportEvent.count({ where: { status: 'UPCOMING' } }),
    ]);

    return {
      totalBets,
      pendingBets,
      totalStaked: Number(totalStaked._sum.stake || 0),
      totalPaidOut: Number(totalPaidOut._sum.potentialWin || 0),
      ggr: Number(totalStaked._sum.stake || 0) - Number(totalPaidOut._sum.potentialWin || 0),
      totalEvents,
      upcomingEvents,
      apiStatus: this.getStatus(),
    };
  }
}
