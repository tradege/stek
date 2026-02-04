import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
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
        console.warn(`⚠️ CORS blocked request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  
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
  
  // ============================================
  // SECURITY HEADERS (Optional but recommended)
  // ============================================
  // Note: For production, consider using helmet middleware
  // app.use(helmet());
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 StakePro Backend running on port ${port}`);
  console.log(`📡 WebSocket Gateway ready`);
  console.log(`🔒 CORS: Restricted to allowed origins`);
  console.log(`🛡️ Validation: Whitelist + ForbidNonWhitelisted enabled`);
}

bootstrap();
