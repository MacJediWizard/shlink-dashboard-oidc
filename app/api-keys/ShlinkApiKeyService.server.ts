import type { Server } from '../entities/Server';
import { createLogger } from '../utils/logger.server';

const logger = createLogger('ShlinkApiKey');

export interface ShlinkApiKey {
  key: string;
  name: string | null;
  expirationDate: string | null;
  roles: Array<{
    role: string;
    meta: {
      authority?: string;
      domainId?: string;
    };
  }>;
}

export interface CreateShlinkApiKeyInput {
  name?: string;
  expirationDate?: string; // ISO date string
  roles?: Array<{
    role: 'AUTHORED_SHORT_URLS' | 'DOMAIN_SPECIFIC';
    meta?: {
      authority?: string;
      domainId?: string;
    };
  }>;
}

export interface ShlinkApiKeyListResponse {
  apiKeys: {
    data: ShlinkApiKey[];
  };
}

export class ShlinkApiKeyService {
  async listApiKeys(server: Server): Promise<ShlinkApiKey[]> {
    const url = `${server.baseUrl}/rest/v3/api-keys`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Api-Key': server.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to list API keys from Shlink', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to list API keys: ${response.status}`);
      }

      const data = await response.json() as ShlinkApiKeyListResponse;
      return data.apiKeys.data;
    } catch (error) {
      logger.error('Error listing API keys from Shlink', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async createApiKey(server: Server, input: CreateShlinkApiKeyInput = {}): Promise<ShlinkApiKey> {
    const url = `${server.baseUrl}/rest/v3/api-keys`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Api-Key': server.apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to create API key in Shlink', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to create API key: ${response.status}`);
      }

      const data = await response.json() as ShlinkApiKey;
      logger.info('Created new API key in Shlink', {
        name: input.name ?? 'unnamed',
        hasExpiration: !!input.expirationDate,
      });
      return data;
    } catch (error) {
      logger.error('Error creating API key in Shlink', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async deleteApiKey(server: Server, apiKey: string): Promise<boolean> {
    const url = `${server.baseUrl}/rest/v3/api-keys/${encodeURIComponent(apiKey)}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'X-Api-Key': server.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return false;
        }
        const errorText = await response.text();
        logger.error('Failed to delete API key from Shlink', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to delete API key: ${response.status}`);
      }

      logger.info('Deleted API key from Shlink');
      return true;
    } catch (error) {
      logger.error('Error deleting API key from Shlink', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
