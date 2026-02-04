import type { EntityManager } from '@mikro-orm/core';
import { Favorite } from '../entities/Favorite';
import { Server } from '../entities/Server';
import { User } from '../entities/User';

export interface CreateFavoriteInput {
  shortUrlId: string;
  shortCode: string;
  longUrl: string;
  title?: string;
  notes?: string;
}

export class FavoritesService {
  readonly #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  async getFavorites(userPublicId: string, serverPublicId: string): Promise<Favorite[]> {
    return this.#em.find(Favorite, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
    }, {
      orderBy: { createdAt: 'DESC' },
    });
  }

  async addFavorite(
    userPublicId: string,
    serverPublicId: string,
    input: CreateFavoriteInput,
  ): Promise<Favorite> {
    const [user, server] = await Promise.all([
      this.#em.findOneOrFail(User, { publicId: userPublicId }),
      this.#em.findOneOrFail(Server, { publicId: serverPublicId }),
    ]);

    // Check if already favorited
    const existing = await this.#em.findOne(Favorite, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      shortUrlId: input.shortUrlId,
    });

    if (existing) {
      // Update notes if provided
      if (input.notes !== undefined) {
        existing.notes = input.notes;
        await this.#em.flush();
      }
      return existing;
    }

    const favorite = new Favorite();
    favorite.shortUrlId = input.shortUrlId;
    favorite.shortCode = input.shortCode;
    favorite.longUrl = input.longUrl;
    favorite.title = input.title ?? null;
    favorite.notes = input.notes ?? null;
    favorite.user = user;
    favorite.server = server;
    favorite.createdAt = new Date();

    this.#em.persist(favorite);
    await this.#em.flush();

    return favorite;
  }

  async removeFavorite(
    userPublicId: string,
    serverPublicId: string,
    shortUrlId: string,
  ): Promise<boolean> {
    const favorite = await this.#em.findOne(Favorite, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      shortUrlId,
    });

    if (!favorite) {
      return false;
    }

    await this.#em.removeAndFlush(favorite);
    return true;
  }

  async isFavorite(
    userPublicId: string,
    serverPublicId: string,
    shortUrlId: string,
  ): Promise<boolean> {
    const count = await this.#em.count(Favorite, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      shortUrlId,
    });

    return count > 0;
  }

  async updateFavoriteNotes(
    userPublicId: string,
    serverPublicId: string,
    shortUrlId: string,
    notes: string | null,
  ): Promise<Favorite | null> {
    const favorite = await this.#em.findOne(Favorite, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      shortUrlId,
    });

    if (!favorite) {
      return null;
    }

    favorite.notes = notes;
    await this.#em.flush();

    return favorite;
  }
}
