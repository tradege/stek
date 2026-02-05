import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { ApiKeyGuard } from './api-key.guard';
import {
  BalanceRequestDto,
  BalanceResponseDto,
  TransactionRequestDto,
  TransactionResponseDto,
} from './integration.dto';

@Controller('api/integration')
@UseGuards(ApiKeyGuard)
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Get user balance
   * POST /api/integration/balance
   */
  @Post('balance')
  @HttpCode(HttpStatus.OK)
  async getBalance(@Body() dto: BalanceRequestDto): Promise<BalanceResponseDto> {
    this.logger.log(`Balance request for user: ${dto.userId}`);
    return this.integrationService.getBalance(dto);
  }

  /**
   * Process transaction (BET / WIN / REFUND)
   * POST /api/integration/transaction
   */
  @Post('transaction')
  @HttpCode(HttpStatus.OK)
  async processTransaction(
    @Body() dto: TransactionRequestDto,
  ): Promise<TransactionResponseDto> {
    this.logger.log(
      `Transaction request: ${dto.type} ${dto.amount} for user ${dto.userId}, ` +
      `game: ${dto.gameId}, txId: ${dto.transactionId}`
    );
    return this.integrationService.processTransaction(dto);
  }

  /**
   * Rollback a transaction
   * POST /api/integration/rollback
   */
  @Post('rollback')
  @HttpCode(HttpStatus.OK)
  async rollbackTransaction(
    @Body() body: { transactionId: string },
  ): Promise<TransactionResponseDto> {
    this.logger.log(`Rollback request for transaction: ${body.transactionId}`);
    return this.integrationService.rollbackTransaction(body.transactionId);
  }

  /**
   * Health check endpoint
   * POST /api/integration/health
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Authenticate user session for Seamless Wallet
   * POST /api/integration/authenticate
   */
  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  async authenticate(@Body() body: { token: string }): Promise<any> {
    this.logger.log(`Authentication request with token: ${body.token}`);
    return this.integrationService.authenticate(body.token);
  }
}
