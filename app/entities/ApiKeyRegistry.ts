import { EntitySchema, ReferenceKind } from '@mikro-orm/core';
import { BaseEntity, idColumnSchema } from './Base';
import { Server } from './Server';
import { User } from './User';

export class ApiKeyRegistry extends BaseEntity {
  name!: string;
  description!: string | null;
  keyHint!: string; // Last 4 characters of the key for identification
  service!: string; // e.g., 'dashboard', 'n8n', 'zapier', 'custom'
  tags!: string[]; // JSON array of tags
  expiresAt!: Date | null;
  lastUsedAt!: Date | null;
  usageCount!: number;
  isActive!: boolean;
  notes!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  user!: User;
  server!: Server;
}

export const ApiKeyRegistrySchema = new EntitySchema({
  class: ApiKeyRegistry,
  tableName: 'api_key_registry',
  properties: {
    id: idColumnSchema,
    name: {
      type: 'string',
      length: 255,
    },
    description: {
      type: 'text',
      nullable: true,
    },
    keyHint: {
      name: 'key_hint',
      type: 'string',
      length: 10,
    },
    service: {
      type: 'string',
      length: 50,
    },
    tags: {
      type: 'json',
      default: '[]',
    },
    expiresAt: {
      name: 'expires_at',
      type: 'datetime',
      nullable: true,
    },
    lastUsedAt: {
      name: 'last_used_at',
      type: 'datetime',
      nullable: true,
    },
    usageCount: {
      name: 'usage_count',
      type: 'int',
      unsigned: true,
      default: 0,
    },
    isActive: {
      name: 'is_active',
      type: 'boolean',
      default: true,
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
    updatedAt: {
      name: 'updated_at',
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
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
      name: 'idx_apikey_user_server',
      properties: ['user', 'server'],
    },
    {
      name: 'idx_apikey_service',
      properties: ['service'],
    },
  ],
});
