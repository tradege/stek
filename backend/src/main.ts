import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from './modules/config/env.validation';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  validateEnvironment();
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
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
  // Add global x-site-id header parameter to all endpoints
  for (const path of Object.values(document.paths || {})) {
    for (const method of Object.values(path as any)) {
      if (typeof method === 'object' && method !== null) {
        (method as any).parameters = (method as any).parameters || [];
        (method as any).parameters.push({
          name: 'x-site-id',
          in: 'header',
          required: false,
          description: 'Brand/Site ID for multi-tenant isolation. Auto-detected from domain if not provided.',
          schema: { type: 'string', example: 'default-site-001' },
        });
      }
    }
  }
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
    'http://167.172.174.75:3001', 'http://167.172.174.75:3000',
    'http://167.172.174.75',
    'https://marketedgepros.com', 'https://www.marketedgepros.com',
    'http://167-172-174-75.nip.io', 'http://167-172-174-75.nip.io:3000', 'http://167-172-174-75.nip.io:3001',
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

  // Body parser with size limit (100KB max)
  app.use(require("express").json({ limit: "100kb" }));
  app.use(require("express").urlencoded({ extended: true, limit: "100kb" }));
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
