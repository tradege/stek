import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  { name: 'JWT_SECRET', required: true, description: 'JWT signing secret' },
  { name: 'NODE_ENV', required: false, description: 'Environment (production/development)' },
  { name: 'PORT', required: false, description: 'Server port (default: 3000)' },
  { name: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key for AI features' },
];

export function validateEnvironment(): void {
  logger.log('Validating environment variables...');
  const missing: string[] = [];

  for (const env of ENV_VARS) {
    const value = process.env[env.name];
    if (!value && env.required) {
      missing.push(env.name);
    }
  }

  if (missing.length > 0) {
    throw new Error('Missing required env vars: ' + missing.join(', '));
  }

  logger.log('All required environment variables validated');
}
