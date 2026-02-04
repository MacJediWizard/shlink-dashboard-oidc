import type { EntityManager } from '@mikro-orm/core';
import { ApiKeyRegistry } from '../entities/ApiKeyRegistry';
import { Server } from '../entities/Server';
import { User } from '../entities/User';

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  keyHint: string; // Last 4+ characters of the actual key
  service: string;
  tags?: string[];
  expiresAt?: Date;
  notes?: string;
}

export interface UpdateApiKeyInput {
  name?: string;
  description?: string;
  service?: string;
  tags?: string[];
  expiresAt?: Date | null;
  isActive?: boolean;
  notes?: string;
}

export const COMMON_SERVICES = [
  'dashboard',
  'n8n',
  'zapier',
  'home-assistant',
  'api-client',
  'monitoring',
  'backup',
  'custom',
] as const;

export class ApiKeyRegistryService {
  readonly #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  async getApiKeys(userPublicId: string, serverPublicId: string): Promise<ApiKeyRegistry[]> {
    return this.#em.find(ApiKeyRegistry, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
    }, {
      orderBy: { createdAt: 'DESC' },
    });
  }

  async getApiKey(
    id: string,
    userPublicId: string,
    serverPublicId: string,
  ): Promise<ApiKeyRegistry | null> {
    return this.#em.findOne(ApiKeyRegistry, {
      id,
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
    });
  }

  async createApiKey(
    userPublicId: string,
    serverPublicId: string,
    input: CreateApiKeyInput,
  ): Promise<ApiKeyRegistry> {
    const [user, server] = await Promise.all([
      this.#em.findOneOrFail(User, { publicId: userPublicId }),
      this.#em.findOneOrFail(Server, { publicId: serverPublicId }),
    ]);

    const apiKey = new ApiKeyRegistry();
    apiKey.name = input.name;
    apiKey.description = input.description ?? null;
    apiKey.keyHint = input.keyHint;
    apiKey.service = input.service;
    apiKey.tags = input.tags ?? [];
    apiKey.expiresAt = input.expiresAt ?? null;
    apiKey.notes = input.notes ?? null;
    apiKey.isActive = true;
    apiKey.usageCount = 0;
    apiKey.lastUsedAt = null;
    apiKey.user = user;
    apiKey.server = server;

    const now = new Date();
    apiKey.createdAt = now;
    apiKey.updatedAt = now;

    this.#em.persist(apiKey);
    await this.#em.flush();

    return apiKey;
  }

  async updateApiKey(
    id: string,
    userPublicId: string,
    serverPublicId: string,
    input: UpdateApiKeyInput,
  ): Promise<ApiKeyRegistry | null> {
    const apiKey = await this.getApiKey(id, userPublicId, serverPublicId);

    if (!apiKey) {
      return null;
    }

    if (input.name !== undefined) apiKey.name = input.name;
    if (input.description !== undefined) apiKey.description = input.description || null;
    if (input.service !== undefined) apiKey.service = input.service;
    if (input.tags !== undefined) apiKey.tags = input.tags;
    if (input.expiresAt !== undefined) apiKey.expiresAt = input.expiresAt;
    if (input.isActive !== undefined) apiKey.isActive = input.isActive;
    if (input.notes !== undefined) apiKey.notes = input.notes || null;

    apiKey.updatedAt = new Date();

    await this.#em.flush();
    return apiKey;
  }

  async deleteApiKey(
    id: string,
    userPublicId: string,
    serverPublicId: string,
  ): Promise<boolean> {
    const apiKey = await this.getApiKey(id, userPublicId, serverPublicId);

    if (!apiKey) {
      return false;
    }

    await this.#em.removeAndFlush(apiKey);
    return true;
  }

  async recordUsage(
    id: string,
    userPublicId: string,
    serverPublicId: string,
  ): Promise<boolean> {
    const apiKey = await this.getApiKey(id, userPublicId, serverPublicId);

    if (!apiKey) {
      return false;
    }

    apiKey.lastUsedAt = new Date();
    apiKey.usageCount += 1;
    apiKey.updatedAt = new Date();

    await this.#em.flush();
    return true;
  }

  async getExpiringSoon(
    userPublicId: string,
    serverPublicId: string,
    daysAhead: number = 30,
  ): Promise<ApiKeyRegistry[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.#em.find(ApiKeyRegistry, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      isActive: true,
      expiresAt: {
        $ne: null,
        $lte: futureDate,
        $gt: now,
      },
    }, {
      orderBy: { expiresAt: 'ASC' },
    });
  }

  async getByService(
    userPublicId: string,
    serverPublicId: string,
    service: string,
  ): Promise<ApiKeyRegistry[]> {
    return this.#em.find(ApiKeyRegistry, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      service,
    }, {
      orderBy: { createdAt: 'DESC' },
    });
  }
}
