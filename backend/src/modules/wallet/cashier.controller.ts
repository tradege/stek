'use strict';
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CashierService } from './cashier.service';

// DTOs
interface DepositDto {
  amount: number;
  currency: string;
  txHash: string;
}

interface WithdrawDto {
  amount: number;
  currency: string;
  walletAddress: string;
}

interface ApproveTransactionDto {
  transactionId: string;
  action: 'APPROVE' | 'REJECT';
  adminNote?: string;
}

@Controller('wallet')
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  /**
   * Get user's wallet balances
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Request() req) {
    return this.cashierService.getUserBalances(req.user.id);
  }

  /**
   * Get user's transaction history
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getTransactions(@Request() req) {
    return this.cashierService.getUserTransactions(req.user.id);
  }

  /**
   * Submit deposit request
   */
  @Post('deposit')
  @UseGuards(JwtAuthGuard)
  async deposit(@Request() req, @Body() dto: DepositDto) {
    const { amount, currency, txHash } = dto;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    if (!txHash || txHash.length < 10) {
      throw new BadRequestException('Invalid transaction hash');
    }
    if (!['USDT', 'BTC', 'ETH', 'SOL'].includes(currency?.toUpperCase())) {
      throw new BadRequestException('Unsupported currency');
    }

    return this.cashierService.createDepositRequest(
      req.user.id,
      amount,
      currency.toUpperCase(),
      txHash,
    );
  }

  /**
   * Submit withdrawal request
   */
  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  async withdraw(@Request() req, @Body() dto: WithdrawDto) {
    const { amount, currency, walletAddress } = dto;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }
    if (!walletAddress || walletAddress.length < 10) {
      throw new BadRequestException('Invalid wallet address');
    }
    if (!['USDT', 'BTC', 'ETH', 'SOL'].includes(currency?.toUpperCase())) {
      throw new BadRequestException('Unsupported currency');
    }

    return this.cashierService.createWithdrawRequest(
      req.user.id,
      amount,
      currency.toUpperCase(),
      walletAddress,
    );
  }

  /**
   * Get deposit wallet address
   */
  @Get('deposit-address/:currency')
  @UseGuards(JwtAuthGuard)
  async getDepositAddress(@Param('currency') currency: string) {
    // Hardcoded admin wallet addresses for V1
    const addresses: Record<string, { address: string; network: string }> = {
      USDT: {
        address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7',
        network: 'TRC20',
      },
      BTC: {
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        network: 'Bitcoin',
      },
      ETH: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fE2a',
        network: 'ERC20',
      },
      SOL: {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        network: 'Solana',
      },
    };

    const upperCurrency = currency?.toUpperCase();
    if (!addresses[upperCurrency]) {
      throw new BadRequestException('Unsupported currency');
    }

    const minDeposits: Record<string, number> = {
      USDT: 10,
      BTC: 0.0001,
      ETH: 0.005,
      SOL: 0.1,
    };

    return {
      currency: upperCurrency,
      address: addresses[upperCurrency].address,
      network: addresses[upperCurrency].network,
      minDeposit: minDeposits[upperCurrency],
    };
  }
}

/**
 * Admin Controller for transaction management
 */
@Controller('admin')
export class AdminCashierController {
  constructor(private readonly cashierService: CashierService) {}

  /**
   * Get all pending transactions (Admin only)
   */
  @Get('transactions/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingTransactions(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.cashierService.getPendingTransactions();
  }

  /**
   * Get all transactions (Admin only)
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getAllTransactions(@Request() req) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.cashierService.getAllTransactions();
  }

  /**
   * Approve or reject a transaction (Admin only)
   */
  @Post('transactions/approve')
  @UseGuards(JwtAuthGuard)
  async approveTransaction(@Request() req, @Body() dto: ApproveTransactionDto) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    const { transactionId, action, adminNote } = dto;

    if (!transactionId) {
      throw new BadRequestException('Transaction ID required');
    }
    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }

    return this.cashierService.processTransaction(
      transactionId,
      action,
      req.user.id,
      adminNote,
    );
  }
}
