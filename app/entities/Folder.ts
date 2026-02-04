import { Collection, EntitySchema, ReferenceKind } from '@mikro-orm/core';
import { BaseEntity, idColumnSchema } from './Base';
import { Server } from './Server';
import { User } from './User';

export class Folder extends BaseEntity {
  name!: string;
  color!: string | null;
  createdAt!: Date;
  user!: User;
  server!: Server;
  items: Collection<FolderItem>;

  constructor() {
    super();
    this.items = new Collection<FolderItem>(this);
  }
}

export class FolderItem extends BaseEntity {
  shortUrlId!: string;
  shortCode!: string;
  addedAt!: Date;
  folder!: Folder;
}

export const FolderSchema = new EntitySchema({
  class: Folder,
  tableName: 'folders',
  properties: {
    id: idColumnSchema,
    name: {
      type: 'string',
      length: 255,
    },
    color: {
      type: 'string',
      length: 7,
      nullable: true,
    },
    createdAt: {
      name: 'created_at',
      type: 'datetime',
      onCreate: () => new Date(),
    },
    user: {
      kind: ReferenceKind.MANY_TO_ONE,
      entity: () => User,
      joinColumn: 'user_id',
      deleteRule: 'cascade',
    },
    server: {
      kind: ReferenceKind.MANY_TO_ONE,
      entity: () => Server,
      joinColumn: 'server_id',
      deleteRule: 'cascade',
    },
    items: {
      kind: ReferenceKind.ONE_TO_MANY,
      entity: () => FolderItem,
      mappedBy: 'folder',
    },
  },
  indexes: [
    {
      name: 'idx_folder_user_server_name',
      properties: ['user', 'server', 'name'],
      options: { unique: true },
    },
  ],
});

export const FolderItemSchema = new EntitySchema({
  class: FolderItem,
  tableName: 'folder_items',
  properties: {
    id: idColumnSchema,
    shortUrlId: {
      name: 'short_url_id',
      type: 'string',
      length: 255,
    },
    shortCode: {
      name: 'short_code',
      type: 'string',
      length: 255,
    },
    addedAt: {
      name: 'added_at',
      type: 'datetime',
      onCreate: () => new Date(),
    },
    folder: {
      kind: ReferenceKind.MANY_TO_ONE,
      entity: () => Folder,
      joinColumn: 'folder_id',
      deleteRule: 'cascade',
    },
  },
  indexes: [
    {
      name: 'idx_folder_item_folder_shorturl',
      properties: ['folder', 'shortUrlId'],
      options: { unique: true },
    },
  ],
});
