import { EntitySchema, ReferenceKind } from '@mikro-orm/core';
import { BaseEntity, idColumnSchema } from './Base';
import { Server } from './Server';
import { User } from './User';

export class Favorite extends BaseEntity {
  shortUrlId!: string;
  shortCode!: string;
  longUrl!: string;
  title!: string | null;
  notes!: string | null;
  createdAt!: Date;
  user!: User;
  server!: Server;
}

export const FavoriteSchema = new EntitySchema({
  class: Favorite,
  tableName: 'favorites',
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
    longUrl: {
      name: 'long_url',
      type: 'text',
    },
    title: {
      type: 'string',
      length: 255,
      nullable: true,
    },
    notes: {
      type: 'text',
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
  },
  indexes: [
    {
      name: 'idx_favorite_user_server_shorturl',
      properties: ['user', 'server', 'shortUrlId'],
      options: { unique: true },
    },
  ],
});
