import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { RaceService } from "./race.service";

@Controller("api/race")
@ApiTags("Races")
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Get("leaderboard")
  @ApiOperation({ summary: "Get daily race leaderboard (live)" })
  async getDailyLeaderboard() {
    const entries = await this.raceService.getDailyLeaderboard();
    return {
      type: "daily",
      entries,
      prizes: this.raceService.getPrizeConfig().daily,
      resetsAt: this.getNextMidnight(),
    };
  }

  @Get("weekly-leaderboard")
  @ApiOperation({ summary: "Get weekly race leaderboard (live)" })
  async getWeeklyLeaderboard() {
    const entries = await this.raceService.getWeeklyLeaderboard();
    return {
      type: "weekly",
      entries,
      prizes: this.raceService.getPrizeConfig().weekly,
      resetsAt: this.getNextMonday(),
    };
  }

  @Get("monthly-leaderboard")
  @ApiOperation({ summary: "Get monthly race leaderboard (live)" })
  async getMonthlyLeaderboard() {
    const entries = await this.raceService.getMonthlyLeaderboard();
    return {
      type: "monthly",
      entries,
      prizes: this.raceService.getPrizeConfig().monthly,
      resetsAt: this.getFirstOfNextMonth(),
    };
  }

  @Get("prizes")
  @ApiOperation({ summary: "Get prize configuration for all races" })
  async getPrizeConfig() {
    return this.raceService.getPrizeConfig();
  }

  private getNextMidnight(): string {
    const now = new Date();
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    return next.toISOString();
  }

  private getNextMonday(): string {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    next.setUTCHours(0, 0, 0, 0);
    return next.toISOString();
  }

  private getFirstOfNextMonth(): string {
    const now = new Date();
    const next = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    return next.toISOString();
  }
}
