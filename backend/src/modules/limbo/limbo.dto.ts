import { IsNumber, IsOptional, IsString, Min, Max } from "class-validator";

export class PlayLimboDto {
  @IsNumber()
  @Min(0.01)
  betAmount: number;

  @IsNumber()
  @Min(1.01)
  @Max(10000)
  targetMultiplier: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
