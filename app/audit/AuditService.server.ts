import type { EntityManager } from '@mikro-orm/core';
import type { AuditAction } from '../entities/AuditLog';
import { AuditLog } from '../entities/AuditLog';
import type { Server } from '../entities/Server';
import type { User } from '../entities/User';
import { createLogger } from '../utils/logger.server';

const logger = createLogger('Audit');

export interface AuditLogEntry {
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  user?: User;
  server?: Server;
}

export interface AuditLogFilter {
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  itemsPerPage?: number;
}

export class AuditService {
  readonly #em: EntityManager;

  constructor(em: EntityManager) {
    this.#em = em;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const auditLog = new AuditLog();
      auditLog.action = entry.action;
      auditLog.resourceType = entry.resourceType ?? null;
      auditLog.resourceId = entry.resourceId ?? null;
      auditLog.details = entry.details ?? null;
      auditLog.ipAddress = entry.ipAddress ?? null;
      auditLog.userAgent = entry.userAgent ?? null;
      auditLog.user = entry.user ?? null;
      auditLog.server = entry.server ?? null;
      auditLog.createdAt = new Date();

      this.#em.persist(auditLog);
      await this.#em.flush();

      logger.debug('Audit log entry created', {
        action: entry.action,
        resourceType: entry.resourceType,
        userId: entry.user?.id,
      });
    } catch (error: any) {
      // Don't let audit logging errors affect the main flow
      logger.error('Failed to create audit log entry', { error: error.message });
    }
  }

  async getAuditLogs(filter: AuditLogFilter = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const { userId, action, startDate, endDate, page = 1, itemsPerPage = 50 } = filter;

    const where: Record<string, unknown> = {};

    if (userId) {
      where.user = { publicId: userId };
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).$gte = startDate;
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).$lte = endDate;
      }
    }

    const offset = (page - 1) * itemsPerPage;
    const [logs, total] = await Promise.all([
      this.#em.find(AuditLog, where, {
        populate: ['user', 'server'],
        orderBy: { createdAt: 'DESC' },
        limit: itemsPerPage,
        offset,
      }),
      this.#em.count(AuditLog, where),
    ]);

    return { logs, total };
  }
}
