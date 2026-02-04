import { EntitySchema, ReferenceKind } from '@mikro-orm/core';
import { BaseEntity, idColumnSchema } from './Base';
import { Server } from './Server';
import { User } from './User';

export const auditActions = [
  'login',
  'login_oidc',
  'logout',
  'create_short_url',
  'edit_short_url',
  'delete_short_url',
  'create_user',
  'edit_user',
  'delete_user',
  'create_server',
  'edit_server',
  'delete_server',
] as const;

export type AuditAction = typeof auditActions[number];

export class AuditLog extends BaseEntity {
  action!: AuditAction;
  resourceType!: string | null;
  resourceId!: string | null;
  details!: Record<string, unknown> | null;
  ipAddress!: string | null;
  userAgent!: string | null;
  createdAt!: Date;
  user!: User | null;
  server!: Server | null;
}

export const AuditLogSchema = new EntitySchema({
  class: AuditLog,
  tableName: 'audit_logs',
  properties: {
    id: idColumnSchema,
    action: {
      type: 'string',
      length: 50,
    },
    resourceType: {
      name: 'resource_type',
      type: 'string',
      length: 50,
      nullable: true,
    },
    resourceId: {
      name: 'resource_id',
      type: 'string',
      length: 255,
      nullable: true,
    },
    details: {
      type: 'json',
      nullable: true,
    },
    ipAddress: {
      name: 'ip_address',
      type: 'string',
      length: 45,
      nullable: true,
    },
    userAgent: {
      name: 'user_agent',
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
      nullable: true,
      deleteRule: 'set null',
    },
    server: {
      kind: ReferenceKind.MANY_TO_ONE,
      entity: () => Server,
      joinColumn: 'server_id',
      nullable: true,
      deleteRule: 'set null',
    },
  },
  indexes: [
    {
      name: 'idx_audit_created_at',
      properties: ['createdAt'],
    },
    {
      name: 'idx_audit_user_id',
      properties: ['user'],
    },
  ],
});
