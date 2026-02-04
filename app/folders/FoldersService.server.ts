import type { EntityManager } from '@mikro-orm/core';
import { Folder, FolderItem } from '../entities/Folder';
import { Server } from '../entities/Server';
import { User } from '../entities/User';

export interface CreateFolderInput {
  name: string;
  color?: string;
}

export interface AddToFolderInput {
  shortUrlId: string;
  shortCode: string;
}

export class FoldersService {
  readonly #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  async getFolders(userPublicId: string, serverPublicId: string): Promise<Folder[]> {
    return this.#em.find(Folder, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
    }, {
      populate: ['items'],
      orderBy: { name: 'ASC' },
    });
  }

  async getFolder(folderId: string, userPublicId: string, serverPublicId: string): Promise<Folder | null> {
    return this.#em.findOne(Folder, {
      id: folderId,
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
    }, {
      populate: ['items'],
    });
  }

  async createFolder(
    userPublicId: string,
    serverPublicId: string,
    input: CreateFolderInput,
  ): Promise<Folder> {
    const [user, server] = await Promise.all([
      this.#em.findOneOrFail(User, { publicId: userPublicId }),
      this.#em.findOneOrFail(Server, { publicId: serverPublicId }),
    ]);

    // Check if folder with same name already exists
    const existing = await this.#em.findOne(Folder, {
      user: { publicId: userPublicId },
      server: { publicId: serverPublicId },
      name: input.name,
    });

    if (existing) {
      throw new Error('A folder with this name already exists');
    }

    const folder = new Folder();
    folder.name = input.name;
    folder.color = input.color ?? null;
    folder.user = user;
    folder.server = server;
    folder.createdAt = new Date();

    this.#em.persist(folder);
    await this.#em.flush();

    return folder;
  }

  async updateFolder(
    folderId: string,
    userPublicId: string,
    serverPublicId: string,
    input: Partial<CreateFolderInput>,
  ): Promise<Folder | null> {
    const folder = await this.getFolder(folderId, userPublicId, serverPublicId);

    if (!folder) {
      return null;
    }

    if (input.name !== undefined) {
      folder.name = input.name;
    }
    if (input.color !== undefined) {
      folder.color = input.color || null;
    }

    await this.#em.flush();
    return folder;
  }

  async deleteFolder(
    folderId: string,
    userPublicId: string,
    serverPublicId: string,
  ): Promise<boolean> {
    const folder = await this.getFolder(folderId, userPublicId, serverPublicId);

    if (!folder) {
      return false;
    }

    await this.#em.removeAndFlush(folder);
    return true;
  }

  async addToFolder(
    folderId: string,
    userPublicId: string,
    serverPublicId: string,
    input: AddToFolderInput,
  ): Promise<FolderItem | null> {
    const folder = await this.getFolder(folderId, userPublicId, serverPublicId);

    if (!folder) {
      return null;
    }

    // Check if already in folder
    const existing = await this.#em.findOne(FolderItem, {
      folder: { id: folderId },
      shortUrlId: input.shortUrlId,
    });

    if (existing) {
      return existing;
    }

    const item = new FolderItem();
    item.shortUrlId = input.shortUrlId;
    item.shortCode = input.shortCode;
    item.folder = folder;
    item.addedAt = new Date();

    this.#em.persist(item);
    await this.#em.flush();

    return item;
  }

  async removeFromFolder(
    folderId: string,
    userPublicId: string,
    serverPublicId: string,
    shortUrlId: string,
  ): Promise<boolean> {
    const folder = await this.getFolder(folderId, userPublicId, serverPublicId);

    if (!folder) {
      return false;
    }

    const item = await this.#em.findOne(FolderItem, {
      folder: { id: folderId },
      shortUrlId,
    });

    if (!item) {
      return false;
    }

    await this.#em.removeAndFlush(item);
    return true;
  }

  async getFoldersForShortUrl(
    userPublicId: string,
    serverPublicId: string,
    shortUrlId: string,
  ): Promise<Folder[]> {
    const items = await this.#em.find(FolderItem, {
      shortUrlId,
      folder: {
        user: { publicId: userPublicId },
        server: { publicId: serverPublicId },
      },
    }, {
      populate: ['folder'],
    });

    return items.map((item) => item.folder);
  }
}
