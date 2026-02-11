import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { CashierService } from './cashier.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('cashier')
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  /**
   * GET /cashier/balances - TENANT SCOPED
   */
  @Get('balances')
  @UseGuards(JwtAuthGuard)
  async getBalances(@Request() req) {
    const siteId = req.tenant?.siteId || req.user?.siteId || null;
    return this.cashierService.getUserBalances(req.user.id, siteId);
  }

  /**
   * GET /cashier/transactions - TENANT SCOPED
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(@Request() req, @Query('limit') limit?: string) {
    const siteId = req.tenant?.siteId || req.user?.siteId || null;
    return this.cashierService.getUserTransactions(
      req.user.id,
      limit ? parseInt(limit) : 50,
      siteId,
    );
  }

  /**
   * POST /cashier/deposit - TENANT SCOPED
   */
  @Post('deposit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async deposit(@Request() req, @Body() body: { amount: number; currency: string; txHash: string }) {
    const siteId = req.tenant?.siteId || req.user?.siteId || null;
    return this.cashierService.createDepositRequest(
      req.user.id,
      body.amount,
      body.currency || 'USDT',
      body.txHash,
      siteId,
    );
  }

  /**
   * POST /cashier/withdraw - TENANT SCOPED
   */
  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async withdraw(@Request() req, @Body() body: { amount: number; currency: string; walletAddress: string }) {
    const siteId = req.tenant?.siteId || req.user?.siteId || null;
    return this.cashierService.createWithdrawRequest(
      req.user.id,
      body.amount,
      body.currency || 'USDT',
      body.walletAddress,
      siteId,
    );
  }

  /**
   * GET /cashier/admin/pending - TENANT SCOPED
   */
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_MASTER')
  async getPending(@Request() req) {
    // ADMIN sees all, SUPER_MASTER sees only their site
    const siteId = req.user.role === 'ADMIN' ? null : (req.tenant?.siteId || null);
    return this.cashierService.getPendingTransactions(siteId);
  }

  /**
   * GET /cashier/admin/transactions - TENANT SCOPED
   */
  @Get('admin/transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_MASTER')
  async getAllTransactions(@Request() req, @Query('limit') limit?: string) {
    const siteId = req.user.role === 'ADMIN' ? null : (req.tenant?.siteId || null);
    return this.cashierService.getAllTransactions(
      limit ? parseInt(limit) : 100,
      siteId,
    );
  }

  /**
   * POST /cashier/admin/process - Process deposit/withdrawal
   */
  @Post('admin/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_MASTER')
  @HttpCode(HttpStatus.OK)
  async processTransaction(
    @Request() req,
    @Body() body: { transactionId: string; action: 'APPROVE' | 'REJECT'; note?: string },
  ) {
    if (!body.transactionId || !body.action) {
      throw new BadRequestException('transactionId and action are required');
    }
    return this.cashierService.processTransaction(
      body.transactionId,
      body.action,
      req.user.id,
      body.note,
    );
  }

  /**
   * POST /cashier/admin/direct-deposit - Admin direct deposit
   */
  @Post('admin/direct-deposit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async directDeposit(
    @Request() req,
    @Body() body: { userId: string; amount: number; currency: string; note?: string },
  ) {
    return this.cashierService.adminDirectDeposit(
      body.userId,
      body.amount,
      body.currency || 'USDT',
      req.user.id,
      body.note,
    );
  }
}
