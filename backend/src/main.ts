import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // ============================================
  // SECURITY HEADERS (Helmet)
  // ============================================
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for game iframes
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  logger.log('🛡️ Helmet security headers enabled');

  // ============================================
  // GLOBAL EXCEPTION FILTER
  // ============================================
  app.useGlobalFilters(new AllExceptionsFilter());
  logger.log('🚨 Global exception filter configured');

  // ============================================
  // GLOBAL LOGGING INTERCEPTOR
  // ============================================
  app.useGlobalInterceptors(new LoggingInterceptor());
  logger.log('📝 Global logging interceptor configured');

  // ============================================
  // CORS CONFIGURATION (Production Ready)
  // ============================================
  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3000',
    'http://146.190.21.113:3001',
    'http://146.190.21.113:3000',
    'https://marketedgepros.com',
    'https://www.marketedgepros.com',
  ];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`⚠️ CORS blocked request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-KEY'],
  });
  logger.log('🔒 CORS configured with allowed origins');

  // ============================================
  // GLOBAL VALIDATION PIPE (Security Hardened)
  // ============================================
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,              // Strip properties not in DTO
    forbidNonWhitelisted: true,   // Throw error if extra properties sent
    transform: true,              // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true,  // Convert types automatically
    },
    disableErrorMessages: false,  // Keep error messages for debugging (disable in prod if needed)
  }));
  logger.log('✅ Global validation pipe configured');

  // ============================================
  // GLOBAL ERROR HANDLING
  // ============================================
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 StakePro Backend running on port ${port}`);
  logger.log(`📡 WebSocket Gateway ready`);
  logger.log(`🛡️ Security: Helmet + CORS + Validation + Logging enabled`);
}

bootstrap();
