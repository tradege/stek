import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export class BalanceRequestDto {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  currency?: string = 'USDT';
}

export class BalanceResponseDto {
  status: 'OK' | 'ERROR';
  balance?: number;
  currency?: string;
  error?: string;
}

export enum TransactionType {
  BET = 'BET',
  WIN = 'WIN',
  REFUND = 'REFUND',
}

export class TransactionRequestDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  gameId: string;

  @IsString()
  transactionId: string;

  @IsString()
  @IsOptional()
  roundId?: string;

  @IsString()
  @IsOptional()
  currency?: string = 'USDT';
}

export class TransactionResponseDto {
  status: 'OK' | 'ERROR';
  newBalance?: number;
  txId?: string;
  error?: string;
  errorCode?: string;
}

// Error codes for providers
export enum IntegrationErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  USER_BLOCKED = 'USER_BLOCKED',
}
