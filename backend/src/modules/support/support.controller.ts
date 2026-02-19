import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupportService } from './support.service';

@Controller('support')
@ApiTags('Support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('ticket')
  @ApiOperation({ summary: 'Submit a support ticket' })
  async createTicket(@Body() body: { name: string; email: string; subject: string; message: string }) {
    return this.supportService.createTicket(body);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get all support tickets (admin)' })
  async getTickets(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getTickets(status, parseInt(page || '1'), parseInt(limit || '20'));
  }
}
