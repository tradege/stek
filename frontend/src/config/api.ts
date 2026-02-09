/**
 * Centralized API Configuration
 * All API URLs are managed here - no hardcoded IPs anywhere else in the codebase.
 * Uses environment variables with a single fallback.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const SOCKET_BASE = process.env.NEXT_PUBLIC_SOCKET_URL || '';

export const config = {
  /** Base URL for all REST API calls */
  apiUrl: API_BASE,
  /** Base URL for WebSocket connections */
  socketUrl: SOCKET_BASE,
} as const;

export default config;
