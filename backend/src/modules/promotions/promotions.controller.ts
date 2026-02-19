import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
@Controller('promotions')
@ApiTags('Promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}
  @Get()
  @ApiOperation({ summary: 'Get all active promotions for a site' })
  async getActivePromotions(@Query('siteId') siteId?: string) {
    return this.promotionsService.getActivePromotions(siteId);
  }
  @Get('all')
  @ApiOperation({ summary: 'Get all promotions (including inactive) for a site' })
  async getAllPromotions(@Query('siteId') siteId?: string) {
    return this.promotionsService.getAllPromotions(siteId);
  }
}
