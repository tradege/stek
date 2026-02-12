/**
 * Jest E2E Setup - Load environment variables before tests
 * This ensures process.env has all required values from .env
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from the backend root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
