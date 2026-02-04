import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import type { AuditService } from '../../../app/audit/AuditService.server';
import { loader } from '../../../app/routes/admin/audit-log';

describe('admin/audit-log', () => {
  const getAuditLogs = vi.fn();
  const auditService = fromPartial<AuditService>({ getAuditLogs });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('returns audit logs with pagination', async () => {
      const logs = [
        {
          id: 1,
          action: 'login',
          resourceType: null,
          resourceId: null,
          details: null,
          ipAddress: '192.168.1.1',
          createdAt: new Date('2026-01-01'),
          user: { username: 'testuser' },
          server: null,
        },
      ];
      getAuditLogs.mockResolvedValue({ logs, total: 1 });

      const args = fromPartial<LoaderFunctionArgs>({
        params: { page: '1' },
      });

      const result = await loader(args, auditService);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe('login');
      expect(result.logs[0].username).toBe('testuser');
      expect(result.pagination.totalItems).toBe(1);
      expect(getAuditLogs).toHaveBeenCalledWith({
        page: 1,
        itemsPerPage: 25,
      });
    });

    it('uses default page when not provided', async () => {
      getAuditLogs.mockResolvedValue({ logs: [], total: 0 });

      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
      });

      await loader(args, auditService);

      expect(getAuditLogs).toHaveBeenCalledWith({
        page: 1,
        itemsPerPage: 25,
      });
    });

    it('handles logs without user', async () => {
      const logs = [
        {
          id: 1,
          action: 'system_event',
          resourceType: null,
          resourceId: null,
          details: null,
          ipAddress: null,
          createdAt: new Date('2026-01-01'),
          user: null,
          server: { name: 'Test Server' },
        },
      ];
      getAuditLogs.mockResolvedValue({ logs, total: 1 });

      const args = fromPartial<LoaderFunctionArgs>({
        params: { page: '1' },
      });

      const result = await loader(args, auditService);

      expect(result.logs[0].username).toBe('System');
      expect(result.logs[0].serverName).toBe('Test Server');
    });

    it('calculates pages count correctly', async () => {
      getAuditLogs.mockResolvedValue({ logs: [], total: 100 });

      const args = fromPartial<LoaderFunctionArgs>({
        params: { page: '1' },
      });

      const result = await loader(args, auditService);

      expect(result.pagination.pagesCount).toBe(4); // 100 / 25 = 4
    });

    it('maps log fields correctly', async () => {
      const logs = [
        {
          id: '1',
          action: 'create_url',
          resourceType: 'short_url',
          resourceId: 'abc123',
          details: { field: 'value' },
          ipAddress: '10.0.0.1',
          createdAt: new Date('2026-01-15T10:30:00Z'),
          user: { username: 'admin' },
          server: { name: 'Production' },
        },
      ];
      getAuditLogs.mockResolvedValue({ logs, total: 1 });

      const args = fromPartial<LoaderFunctionArgs>({
        params: { page: '2' },
      });

      const result = await loader(args, auditService);

      expect(result.logs[0].id).toBe('1');
      expect(result.logs[0].action).toBe('create_url');
      expect(result.logs[0].resourceType).toBe('short_url');
      expect(result.logs[0].resourceId).toBe('abc123');
      expect(result.logs[0].details).toEqual({ field: 'value' });
      expect(result.logs[0].ipAddress).toBe('10.0.0.1');
      expect(result.logs[0].createdAt).toBe('2026-01-15T10:30:00.000Z');
      expect(result.logs[0].username).toBe('admin');
      expect(result.logs[0].serverName).toBe('Production');
      expect(result.pagination.currentPage).toBe(2);
      expect(getAuditLogs).toHaveBeenCalledWith({ page: 2, itemsPerPage: 25 });
    });

    it('handles server being null', async () => {
      const logs = [
        {
          id: '1',
          action: 'logout',
          resourceType: null,
          resourceId: null,
          details: null,
          ipAddress: null,
          createdAt: new Date('2026-01-01'),
          user: { username: 'user' },
          server: null,
        },
      ];
      getAuditLogs.mockResolvedValue({ logs, total: 1 });

      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
      });

      const result = await loader(args, auditService);

      expect(result.logs[0].serverName).toBeNull();
    });
  });
});
