#!/bin/bash
set -e
echo "============================================"
echo "PHASE 4: Production Readiness & Automated Onboarding"
echo "============================================"

cd /var/www/stek/backend

# ============================================
# STEP 1: AUTOMATED BRAND ONBOARDING
# ============================================
echo ">>> Step 1: Creating Brand Onboarding Service & CLI..."

mkdir -p src/modules/onboarding

cat > src/modules/onboarding/onboarding.service.ts << 'ONBOARDEOF'
/**
 * ============================================
 * BRAND ONBOARDING SERVICE - "Brand Factory"
 * ============================================
 * Creates a fully configured new brand in minutes:
 * - SiteConfiguration with defaults
 * - RiskLimit entry
 * - BotConfig pool
 * - Returns JSON config for frontend
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CreateBrandDto {
  brandName: string;
  domain: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  houseEdgeConfig?: Record<string, number>;
  maxPayoutPerDay?: number;
  maxPayoutPerBet?: number;
  maxBetAmount?: number;
  botCount?: number;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new brand with full configuration
   * This is the "Brand Factory" - spawn a new brand in minutes
   */
  async createBrand(dto: CreateBrandDto) {
    // Validate uniqueness
    const existingName = await this.prisma.siteConfiguration.findUnique({
      where: { brandName: dto.brandName },
    });
    if (existingName) {
      throw new BadRequestException(`Brand name "${dto.brandName}" already exists`);
    }

    const existingDomain = await this.prisma.siteConfiguration.findUnique({
      where: { domain: dto.domain },
    });
    if (existingDomain) {
      throw new BadRequestException(`Domain "${dto.domain}" already registered`);
    }

    // Generate unique siteId
    const siteId = `site-${dto.brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

    // Default house edge config
    const defaultHouseEdge = {
      dice: 0.02,
      crash: 0.04,
      mines: 0.03,
      plinko: 0.03,
      olympus: 0.04,
    };

    // Default bot names for new brand
    const defaultBotNames = [
      'CryptoWhale', 'DiamondHands', 'MoonShot', 'BullRunner', 'SatoshiFan',
      'BlockMiner', 'TokenKing', 'DeFiPro', 'ChainLink', 'EtherBoss',
      'BitLord', 'HashPower', 'StakeKing', 'YieldFarmer', 'GasTrader',
    ];

    // Create everything in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create SiteConfiguration
      const site = await tx.siteConfiguration.create({
        data: {
          id: siteId,
          brandName: dto.brandName,
          domain: dto.domain,
          logoUrl: dto.logoUrl || `/assets/brands/${siteId}/logo.png`,
          faviconUrl: dto.faviconUrl || `/assets/brands/${siteId}/favicon.ico`,
          primaryColor: dto.primaryColor || '#6366f1',
          secondaryColor: dto.secondaryColor || '#1e1b4b',
          accentColor: dto.accentColor || '#f59e0b',
          backgroundColor: '#0f0a1e',
          surfaceColor: '#1a1535',
          textColor: '#ffffff',
          houseEdgeConfig: dto.houseEdgeConfig || defaultHouseEdge,
          active: true,
        },
      });
      this.logger.log(`✅ SiteConfiguration created: ${siteId} (${dto.brandName})`);

      // 2. Create RiskLimit
      const riskLimit = await tx.riskLimit.create({
        data: {
          siteId,
          maxPayoutPerDay: dto.maxPayoutPerDay || 50000,
          maxPayoutPerBet: dto.maxPayoutPerBet || 10000,
          maxBetAmount: dto.maxBetAmount || 5000,
        },
      });
      this.logger.log(`✅ RiskLimit created for ${siteId}`);

      // 3. Create BotConfig pool
      const botCount = dto.botCount || 10;
      const botConfigs = [];
      for (let i = 0; i < botCount; i++) {
        const botName = defaultBotNames[i % defaultBotNames.length] + (i >= defaultBotNames.length ? `_${Math.floor(i / defaultBotNames.length)}` : '');
        botConfigs.push({
          siteId,
          botName,
          personality: ['aggressive', 'conservative', 'moderate', 'whale', 'degen'][i % 5],
          minBet: 5,
          maxBet: 500,
          betFrequency: 10 + Math.floor(Math.random() * 20),
          active: true,
          chatEnabled: i < 5, // First 5 bots chat
          chatFrequency: 30 + Math.floor(Math.random() * 60),
        });
      }

      for (const bc of botConfigs) {
        await tx.botConfig.create({ data: bc });
      }
      this.logger.log(`✅ ${botCount} BotConfigs created for ${siteId}`);

      return { site, riskLimit, botCount };
    });

    // 4. Generate frontend config JSON
    const frontendConfig = {
      siteId,
      brandName: dto.brandName,
      domain: dto.domain,
      apiUrl: `https://${dto.domain}/api`,
      wsUrl: `wss://${dto.domain}/ws`,
      theme: {
        primaryColor: dto.primaryColor || '#6366f1',
        secondaryColor: dto.secondaryColor || '#1e1b4b',
        accentColor: dto.accentColor || '#f59e0b',
        logoUrl: result.site.logoUrl,
        faviconUrl: result.site.faviconUrl,
      },
      houseEdge: dto.houseEdgeConfig || defaultHouseEdge,
      riskLimits: {
        maxPayoutPerDay: dto.maxPayoutPerDay || 50000,
        maxPayoutPerBet: dto.maxPayoutPerBet || 10000,
        maxBetAmount: dto.maxBetAmount || 5000,
      },
      bots: result.botCount,
      nginx: {
        serverName: dto.domain,
        proxyPass: 'http://localhost:3000',
        sslCertPath: `/etc/letsencrypt/live/${dto.domain}/fullchain.pem`,
        sslKeyPath: `/etc/letsencrypt/live/${dto.domain}/privkey.pem`,
      },
    };

    this.logger.log(`🏭 Brand "${dto.brandName}" created successfully! siteId: ${siteId}`);

    return {
      success: true,
      message: `Brand "${dto.brandName}" created successfully`,
      siteId,
      frontendConfig,
      nextSteps: [
        `1. Point DNS for ${dto.domain} to server IP`,
        `2. Run: certbot --nginx -d ${dto.domain}`,
        `3. Add nginx server block for ${dto.domain}`,
        `4. Upload logo to ${result.site.logoUrl}`,
        `5. Restart PM2: pm2 restart stek-backend`,
      ],
    };
  }

  /**
   * List all brands with status
   */
  async listBrands() {
    const brands = await this.prisma.siteConfiguration.findMany({
      include: {
        _count: {
          select: {
            users: true,
            bots: true,
          },
        },
      },
      orderBy: { brandName: 'asc' },
    });

    return brands.map(b => ({
      siteId: b.id,
      brandName: b.brandName,
      domain: b.domain,
      active: b.active,
      primaryColor: b.primaryColor,
      users: (b._count as any)?.users || 0,
      bots: (b._count as any)?.bots || 0,
      houseEdge: b.houseEdgeConfig,
    }));
  }

  /**
   * Deactivate a brand (soft delete)
   */
  async deactivateBrand(siteId: string) {
    await this.prisma.siteConfiguration.update({
      where: { id: siteId },
      data: { active: false },
    });
    // Deactivate all bots
    await this.prisma.botConfig.updateMany({
      where: { siteId },
      data: { active: false },
    });
    return { success: true, message: `Brand ${siteId} deactivated` };
  }

  /**
   * Clone an existing brand config to create a new one
   */
  async cloneBrand(sourceSiteId: string, newBrandName: string, newDomain: string) {
    const source = await this.prisma.siteConfiguration.findUnique({
      where: { id: sourceSiteId },
    });
    if (!source) throw new BadRequestException('Source brand not found');

    return this.createBrand({
      brandName: newBrandName,
      domain: newDomain,
      primaryColor: source.primaryColor || undefined,
      secondaryColor: source.secondaryColor || undefined,
      accentColor: source.accentColor || undefined,
      houseEdgeConfig: source.houseEdgeConfig as any,
    });
  }
}
ONBOARDEOF

cat > src/modules/onboarding/onboarding.controller.ts << 'ONBOARDCTRLEOF'
import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OnboardingService, CreateBrandDto } from './onboarding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';

@ApiTags('Brand Onboarding')
@ApiBearerAuth()
@Controller('admin/brands')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new brand (Brand Factory)' })
  @ApiBody({ schema: {
    type: 'object',
    properties: {
      brandName: { type: 'string', example: 'LuckyDragon' },
      domain: { type: 'string', example: 'luckydragon.com' },
      primaryColor: { type: 'string', example: '#ff6600' },
      secondaryColor: { type: 'string', example: '#1a1a2e' },
      houseEdgeConfig: { type: 'object', example: { dice: 0.03, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04 } },
      maxPayoutPerDay: { type: 'number', example: 50000 },
      botCount: { type: 'number', example: 10 },
    },
    required: ['brandName', 'domain'],
  }})
  async createBrand(@Body() dto: CreateBrandDto) {
    return this.onboardingService.createBrand(dto);
  }

  @Get('list')
  @ApiOperation({ summary: 'List all brands with status' })
  async listBrands() {
    return this.onboardingService.listBrands();
  }

  @Delete(':siteId')
  @ApiOperation({ summary: 'Deactivate a brand (soft delete)' })
  async deactivateBrand(@Param('siteId') siteId: string) {
    return this.onboardingService.deactivateBrand(siteId);
  }

  @Post('clone')
  @ApiOperation({ summary: 'Clone an existing brand to create a new one' })
  async cloneBrand(@Body() body: { sourceSiteId: string; brandName: string; domain: string }) {
    return this.onboardingService.cloneBrand(body.sourceSiteId, body.brandName, body.domain);
  }
}
ONBOARDCTRLEOF

cat > src/modules/onboarding/onboarding.module.ts << 'ONBOARDMODEOF'
import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
ONBOARDMODEOF

# Register in AppModule
if ! grep -q 'OnboardingModule' src/app.module.ts; then
  sed -i "/import { FraudModule }/a import { OnboardingModule } from './modules/onboarding/onboarding.module';" src/app.module.ts
  sed -i '/FraudModule,/a\    OnboardingModule,' src/app.module.ts
fi

echo "✅ Step 1: Brand Onboarding complete"

# ============================================
# STEP 1B: CLI Script for Brand Creation
# ============================================
echo ">>> Step 1B: Creating CLI script..."

cat > scripts/create-brand.ts << 'CLIEOF'
#!/usr/bin/env ts-node
/**
 * CLI: Create New Brand
 * Usage: npx ts-node scripts/create-brand.ts --name "LuckyDragon" --domain "luckydragon.com"
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const brandName = getArg('--name');
  const domain = getArg('--domain');
  const primaryColor = getArg('--color') || '#6366f1';
  const botCount = parseInt(getArg('--bots') || '10');

  if (!brandName || !domain) {
    console.log('Usage: npx ts-node scripts/create-brand.ts --name "BrandName" --domain "brand.com" [--color "#hex"] [--bots 10]');
    process.exit(1);
  }

  const siteId = `site-${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

  console.log(`\n🏭 Creating brand: ${brandName}`);
  console.log(`   Domain: ${domain}`);
  console.log(`   SiteId: ${siteId}`);
  console.log(`   Color:  ${primaryColor}`);
  console.log(`   Bots:   ${botCount}\n`);

  // Create SiteConfiguration
  const site = await prisma.siteConfiguration.create({
    data: {
      id: siteId,
      brandName,
      domain,
      primaryColor,
      secondaryColor: '#1e1b4b',
      accentColor: '#f59e0b',
      backgroundColor: '#0f0a1e',
      surfaceColor: '#1a1535',
      textColor: '#ffffff',
      houseEdgeConfig: { dice: 0.02, crash: 0.04, mines: 0.03, plinko: 0.03, olympus: 0.04 },
      active: true,
    },
  });
  console.log('✅ SiteConfiguration created');

  // Create RiskLimit
  await prisma.riskLimit.create({
    data: { siteId, maxPayoutPerDay: 50000, maxPayoutPerBet: 10000, maxBetAmount: 5000 },
  });
  console.log('✅ RiskLimit created');

  // Create Bots
  const botNames = ['CryptoWhale', 'DiamondHands', 'MoonShot', 'BullRunner', 'SatoshiFan',
    'BlockMiner', 'TokenKing', 'DeFiPro', 'ChainLink', 'EtherBoss'];
  for (let i = 0; i < botCount; i++) {
    const name = botNames[i % botNames.length] + (i >= botNames.length ? `_${i}` : '');
    await prisma.botConfig.create({
      data: {
        siteId, botName: name, personality: ['aggressive', 'conservative', 'moderate'][i % 3],
        minBet: 5, maxBet: 500, betFrequency: 15, active: true, chatEnabled: i < 5, chatFrequency: 45,
      },
    });
  }
  console.log(`✅ ${botCount} Bots created`);

  // Output frontend config
  const config = {
    siteId,
    brandName,
    domain,
    theme: { primaryColor, secondaryColor: '#1e1b4b', accentColor: '#f59e0b' },
    houseEdge: site.houseEdgeConfig,
  };

  console.log('\n📋 Frontend Config JSON:');
  console.log(JSON.stringify(config, null, 2));

  console.log('\n📝 Next Steps:');
  console.log(`   1. Point DNS: ${domain} → 146.190.21.113`);
  console.log(`   2. SSL: certbot --nginx -d ${domain}`);
  console.log(`   3. Restart: pm2 restart stek-backend`);
  console.log('\n🎉 Brand created successfully!\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
CLIEOF

echo "✅ Step 1B: CLI script created"

# ============================================
# STEP 2: SWAGGER/OPENAPI DOCUMENTATION
# ============================================
echo ">>> Step 2: Setting up Swagger documentation..."

cat > src/main.ts << 'MAINEOF'
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Logging Interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ============================================
  // SWAGGER / OPENAPI DOCUMENTATION
  // ============================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('STEK Platform API')
    .setDescription(`
## Multi-Tenant White-Label Casino Platform

### Authentication
All protected endpoints require a Bearer JWT token in the Authorization header.
The JWT contains the user's \`siteId\` for automatic tenant isolation.

### Multi-Tenancy
Every request is automatically scoped to a brand via:
- **JWT Token**: Contains \`siteId\` from user registration
- **X-Site-Id Header**: Optional override for admin operations
- **Origin Domain**: Auto-resolved from request origin

### GGR Calculation
\`\`\`
GGR (Gross Gaming Revenue) = Total Wagered - Total Payouts
NGR (Net Gaming Revenue)   = GGR - Affiliate Commissions - Bonuses
RTP (Return to Player)     = (Total Payouts / Total Wagered) × 100%
House Edge                 = 100% - RTP
\`\`\`

### Fraud Alert Statuses
| Status | Description |
|--------|-------------|
| OPEN | New alert, needs review |
| REVIEWED | Admin has seen it |
| DISMISSED | False positive |
| CONFIRMED | Confirmed fraud, action taken |

### Fraud Alert Types
| Type | Trigger |
|------|---------|
| HIGH_WIN_RATE | >80% win rate over 50+ bets |
| RAPID_BETTING | >100 bets in 1 hour |
| LARGE_WITHDRAWAL | >$5,000 withdrawal |
| SUSPICIOUS_RATIO | Withdrawals > 3× deposits |
    `)
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addApiKey({ type: 'apiKey', name: 'X-Site-Id', in: 'header', description: 'Brand/Tenant identifier' }, 'X-Site-Id')
    .addTag('Auth', 'User registration, login, and JWT management')
    .addTag('Games', 'Dice, Crash, Mines, Plinko, Olympus game endpoints')
    .addTag('Cashier', 'Wallet, deposits, withdrawals, and balance management')
    .addTag('Admin Dashboard', 'GGR/NGR reports, user management, brand control')
    .addTag('Brand Onboarding', 'Create, list, clone, and manage brands')
    .addTag('Fraud Detection', 'Scan, alerts, and fraud management')
    .addTag('Affiliate/MLM', 'Referral network, commissions, and leaderboard')
    .addTag('Tenant', 'Brand configuration and theme management')
    .addTag('System', 'Health checks and system status')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'STEK Platform API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1e1b4b; }',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  logger.log('📚 Swagger docs available at /api/docs');

  // ============================================
  // DYNAMIC CORS
  // ============================================
  const staticOrigins = [
    'http://localhost:3001', 'http://localhost:3000',
    'http://127.0.0.1:3001', 'http://127.0.0.1:3000',
    'http://146.190.21.113:3001', 'http://146.190.21.113:3000',
    'http://146.190.21.113',
    'https://marketedgepros.com', 'https://www.marketedgepros.com',
  ];

  let dynamicOrigins: string[] = [];
  try {
    const prisma = app.get(PrismaService);
    const sites = await prisma.siteConfiguration.findMany({
      where: { active: true },
      select: { domain: true },
    });
    dynamicOrigins = sites.flatMap(s => [
      `https://${s.domain}`, `https://www.${s.domain}`, `http://${s.domain}`,
    ]);
    logger.log(`Loaded ${sites.length} tenant domains for CORS`);
  } catch (e) {
    logger.warn('Could not load tenant domains for CORS');
  }

  const allOrigins = [...staticOrigins, ...dynamicOrigins];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-KEY', 'X-Site-Id'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    disableErrorMessages: false,
  }));

  // Global Error Handling
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection: ${reason}`);
  });
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
  });

  // ============================================
  // ENV VALIDATION ON STARTUP
  // ============================================
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    logger.error(`❌ Missing required ENV vars: ${missingVars.join(', ')}`);
    process.exit(1);
  }
  logger.log('✅ All required ENV variables validated');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 STEK Platform running on port ${port}`);
  logger.log(`📚 API Docs: http://localhost:${port}/api/docs`);
  logger.log(`🔒 Security: Helmet + Dynamic CORS + Validation enabled`);
}

bootstrap();
MAINEOF

echo "✅ Step 2: Swagger + main.ts updated"

# ============================================
# STEP 2B: Add Swagger decorators to key controllers
# ============================================
echo ">>> Step 2B: Adding Swagger tags to controllers..."

# Auth controller
if [ -f src/modules/auth/auth.controller.ts ]; then
  if ! grep -q 'ApiTags' src/modules/auth/auth.controller.ts; then
    sed -i "1i import { ApiTags, ApiOperation } from '@nestjs/swagger';" src/modules/auth/auth.controller.ts
    sed -i "/@Controller/a @ApiTags('Auth')" src/modules/auth/auth.controller.ts
  fi
fi

# Admin controller
if ! grep -q 'ApiTags' src/modules/admin/admin.controller.ts; then
  sed -i "1i import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';" src/modules/admin/admin.controller.ts
  sed -i "/@Controller('admin')/a @ApiTags('Admin Dashboard')\n@ApiBearerAuth('JWT')" src/modules/admin/admin.controller.ts
fi

# Fraud controller
if ! grep -q 'ApiTags' src/modules/fraud/fraud.controller.ts; then
  sed -i "1i import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';" src/modules/fraud/fraud.controller.ts
  sed -i "/@Controller/a @ApiTags('Fraud Detection')\n@ApiBearerAuth('JWT')" src/modules/fraud/fraud.controller.ts
fi

# Dice controller
if ! grep -q 'ApiTags' src/modules/dice/dice.controller.ts; then
  sed -i "1i import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';" src/modules/dice/dice.controller.ts
  sed -i "/@Controller('dice')/a @ApiTags('Games')\n@ApiBearerAuth('JWT')" src/modules/dice/dice.controller.ts
fi

# Plinko controller
if ! grep -q 'ApiTags' src/modules/plinko/plinko.controller.ts; then
  sed -i "1i import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';" src/modules/plinko/plinko.controller.ts
  sed -i "/@Controller/a @ApiTags('Games')\n@ApiBearerAuth('JWT')" src/modules/plinko/plinko.controller.ts
fi

# Tenant controller
if [ -f src/modules/tenant/tenant.controller.ts ]; then
  if ! grep -q 'ApiTags' src/modules/tenant/tenant.controller.ts; then
    sed -i "1i import { ApiTags } from '@nestjs/swagger';" src/modules/tenant/tenant.controller.ts
    sed -i "/@Controller/a @ApiTags('Tenant')" src/modules/tenant/tenant.controller.ts
  fi
fi

echo "✅ Step 2B: Swagger tags added"

# ============================================
# STEP 3: SYSTEM HEALTH ENDPOINT
# ============================================
echo ">>> Step 3: Creating Health/System module..."

mkdir -p src/modules/health

cat > src/modules/health/health.service.ts << 'HEALTHSVCEOF'
/**
 * ============================================
 * SYSTEM HEALTH SERVICE
 * ============================================
 * Reports status of DB, WebSocket, and platform metrics
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  async getHealth() {
    const checks: Record<string, any> = {};

    // 1. Database check
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'UP',
        responseTime: `${Date.now() - start}ms`,
      };
    } catch (e) {
      checks.database = { status: 'DOWN', error: (e as Error).message };
    }

    // 2. Memory usage
    const mem = process.memoryUsage();
    checks.memory = {
      status: 'UP',
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      external: `${Math.round(mem.external / 1024 / 1024)}MB`,
    };

    // 3. Platform metrics
    try {
      const [totalUsers, totalBets, activeSites, openAlerts] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.bet.count(),
        this.prisma.siteConfiguration.count({ where: { active: true } }),
        this.prisma.fraudAlert.count({ where: { status: 'OPEN' } }).catch(() => 0),
      ]);
      checks.platform = {
        status: 'UP',
        totalUsers,
        totalBets,
        activeSites,
        openFraudAlerts: openAlerts,
      };
    } catch (e) {
      checks.platform = { status: 'DEGRADED', error: (e as Error).message };
    }

    // 4. Uptime
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    // Overall status
    const allUp = Object.values(checks).every((c: any) => c.status === 'UP');

    return {
      status: allUp ? 'HEALTHY' : 'DEGRADED',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async getDetailedHealth() {
    const health = await this.getHealth();

    // Add per-brand stats
    const brands = await this.prisma.siteConfiguration.findMany({
      where: { active: true },
      select: { id: true, brandName: true, domain: true },
    });

    const brandHealth = await Promise.all(brands.map(async (b) => {
      const [users, betsToday] = await Promise.all([
        this.prisma.user.count({ where: { siteId: b.id, isBot: false } }),
        this.prisma.bet.count({
          where: { siteId: b.id, createdAt: { gte: new Date(Date.now() - 86400000) } },
        }),
      ]);
      return { siteId: b.id, brandName: b.brandName, domain: b.domain, users, betsToday };
    }));

    return { ...health, brands: brandHealth };
  }
}
HEALTHSVCEOF

cat > src/modules/health/health.controller.ts << 'HEALTHCTRLEOF'
import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('System')
@Controller('system')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Public health check (DB, Memory, Platform)' })
  async health() {
    return this.healthService.getHealth();
  }

  @Get('health/detailed')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Detailed health with per-brand stats (Admin only)' })
  async detailedHealth() {
    return this.healthService.getDetailedHealth();
  }
}
HEALTHCTRLEOF

cat > src/modules/health/health.module.ts << 'HEALTHMODEOF'
import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
HEALTHMODEOF

# Register in AppModule
if ! grep -q 'HealthModule' src/app.module.ts; then
  sed -i "/import { OnboardingModule }/a import { HealthModule } from './modules/health/health.module';" src/app.module.ts
  sed -i '/OnboardingModule,/a\    HealthModule,' src/app.module.ts
fi

echo "✅ Step 3: Health module created"

# ============================================
# STEP 4: PRODUCTION CLEANUP
# ============================================
echo ">>> Step 4: Production cleanup..."

# Remove debug log level from main.ts (already done above - only error, warn, log)
# Remove console.log from services (convert to Logger)
find src/modules -name "*.ts" -not -name "*.spec.ts" -exec sed -i 's/console\.log(/\/\/ console.log(/g' {} \; 2>/dev/null || true
find src/modules -name "*.ts" -not -name "*.spec.ts" -exec sed -i 's/console\.warn(/\/\/ console.warn(/g' {} \; 2>/dev/null || true

echo "✅ Step 4: Console.log disabled in production"

# ============================================
# STEP 5: BUILD AND DEPLOY
# ============================================
echo ">>> Step 5: Building..."
npm run build 2>&1 | tail -15
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  echo "✅ Build successful!"
  pm2 restart stek-backend
  sleep 5
  echo "✅ Backend restarted"
else
  echo "❌ Build failed - checking errors..."
  npm run build 2>&1 | grep 'error TS' | head -20
fi

echo ""
echo "============================================"
echo "PHASE 4 SCRIPT COMPLETE"
echo "============================================"
