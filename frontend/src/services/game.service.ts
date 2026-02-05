// Game Service - Frontend API Client for Games Module
// Handles all game-related API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Game {
  id: string;
  providerId: string;
  externalId: string;
  name: string;
  slug: string;
  category: string;
  thumbnail: string | null;
  banner: string | null;
  description: string | null;
  rtp: number | null;
  volatility: string | null;
  minBet: number | null;
  maxBet: number | null;
  isActive: boolean;
  isNew: boolean;
  isHot: boolean;
  isFeatured: boolean;
  sortOrder: number;
  provider: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface GameProvider {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isLive: boolean;
  _count?: {
    games: number;
  };
}

export interface GameCategory {
  category: string;
  count: number;
}

export interface GameFilters {
  provider?: string;
  category?: string;
  isActive?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GamesResponse {
  games: Game[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LaunchGameResponse {
  url: string;
  sessionId: string;
}

export interface GameSession {
  id: string;
  userId: string;
  gameId: string;
  externalSessionId: string | null;
  totalBet: string;
  totalWin: string;
  status: string;
  game: Game;
}

/**
 * Get all games with filters and pagination
 */
export async function getAllGames(filters?: GameFilters): Promise<GamesResponse> {
  try {
    const params = new URLSearchParams();
    
    if (filters?.provider) params.append('provider', filters.provider);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.isHot) params.append('isHot', 'true');
    if (filters?.isNew) params.append('isNew', 'true');
    if (filters?.isFeatured) params.append('isFeatured', 'true');
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await fetch(`${API_URL}/api/games?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching games:', error);
    throw error;
  }
}

/**
 * Get single game by slug
 */
export async function getGameBySlug(slug: string): Promise<Game> {
  try {
    const response = await fetch(`${API_URL}/api/games/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch game: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching game:', error);
    throw error;
  }
}

/**
 * Get all game providers
 */
export async function getAllProviders(): Promise<GameProvider[]> {
  try {
    const response = await fetch(`${API_URL}/api/games/providers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch providers: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching providers:', error);
    throw error;
  }
}

/**
 * Get all game categories with counts
 */
export async function getCategories(): Promise<GameCategory[]> {
  try {
    const response = await fetch(`${API_URL}/api/games/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

/**
 * Launch a game (requires authentication)
 */
export async function launchGame(slug: string, currency?: string): Promise<LaunchGameResponse> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required to launch game');
    }

    const response = await fetch(`${API_URL}/api/games/${slug}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currency }),
    });

    if (!response.ok) {
      throw new Error(`Failed to launch game: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error launching game:', error);
    throw error;
  }
}

/**
 * Get user's active game sessions (requires authentication)
 */
export async function getActiveSessions(): Promise<GameSession[]> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/api/games/sessions/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
}

/**
 * Close a game session (requires authentication)
 */
export async function closeSession(sessionId: string): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/api/games/sessions/${sessionId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to close session: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error closing session:', error);
    throw error;
  }
}
