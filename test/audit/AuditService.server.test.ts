import type { EntityManager } from '@mikro-orm/core';
import { fromPartial } from '@total-typescript/shoehorn';
import { AuditService } from '../../app/audit/AuditService.server';
import { AuditLog } from '../../app/entities/AuditLog';
import type { Server } from '../../app/entities/Server';
import type { User } from '../../app/entities/User';

describe('AuditService', () => {
  const persist = vi.fn();
  const flush = vi.fn();
  const find = vi.fn();
  const count = vi.fn();
  const em = fromPartial<EntityManager>({ persist, flush, find, count });
  let auditService: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new AuditService(em);
  });

  describe('log', () => {
    it('creates audit log entry', async () => {
      const user = fromPartial<User>({ id: 1 });
      const server = fromPartial<Server>({ id: 1 });

      await auditService.log({
        action: 'login',
        resourceType: 'user',
        resourceId: '123',
        details: { field: 'value' },
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
        user,
        server,
      });

      expect(persist).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledOnce();
      const logEntry = persist.mock.calls[0][0] as AuditLog;
      expect(logEntry.action).toBe('login');
      expect(logEntry.resourceType).toBe('user');
      expect(logEntry.resourceId).toBe('123');
      expect(logEntry.details).toEqual({ field: 'value' });
      expect(logEntry.ipAddress).toBe('192.168.1.1');
      expect(logEntry.userAgent).toBe('TestAgent/1.0');
      expect(logEntry.user).toBe(user);
      expect(logEntry.server).toBe(server);
    });

    it('creates audit log entry with minimal fields', async () => {
      await auditService.log({
        action: 'test_action',
      });

      expect(persist).toHaveBeenCalledOnce();
      const logEntry = persist.mock.calls[0][0] as AuditLog;
      expect(logEntry.action).toBe('test_action');
      expect(logEntry.resourceType).toBeNull();
      expect(logEntry.user).toBeNull();
      expect(logEntry.server).toBeNull();
    });

    it('handles errors gracefully', async () => {
      flush.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await auditService.log({ action: 'test' });

      expect(persist).toHaveBeenCalledOnce();
    });
  });

  describe('getAuditLogs', () => {
    it('returns logs with pagination', async () => {
      const logs = [
        fromPartial<AuditLog>({ id: 1, action: 'login' }),
        fromPartial<AuditLog>({ id: 2, action: 'logout' }),
      ];
      find.mockResolvedValue(logs);
      count.mockResolvedValue(10);

      const result = await auditService.getAuditLogs({ page: 1, itemsPerPage: 2 });

      expect(result.logs).toEqual(logs);
      expect(result.total).toBe(10);
      expect(find).toHaveBeenCalledWith(
        AuditLog,
        {},
        expect.objectContaining({
          orderBy: { createdAt: 'DESC' },
          limit: 2,
          offset: 0,
          populate: ['user', 'server'],
        }),
      );
    });

    it('filters by action', async () => {
      find.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await auditService.getAuditLogs({ action: 'login' });

      expect(find).toHaveBeenCalledWith(
        AuditLog,
        { action: 'login' },
        expect.anything(),
      );
    });

    it('filters by userId', async () => {
      find.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await auditService.getAuditLogs({ userId: 'user-1' });

      expect(find).toHaveBeenCalledWith(
        AuditLog,
        { user: { publicId: 'user-1' } },
        expect.anything(),
      );
    });

    it('filters by date range', async () => {
      find.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await auditService.getAuditLogs({ startDate, endDate });

      expect(find).toHaveBeenCalledWith(
        AuditLog,
        { createdAt: { $gte: startDate, $lte: endDate } },
        expect.anything(),
      );
    });

    it('uses default pagination', async () => {
      find.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await auditService.getAuditLogs({});

      expect(find).toHaveBeenCalledWith(
        AuditLog,
        {},
        expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
      );
    });
  });
});
