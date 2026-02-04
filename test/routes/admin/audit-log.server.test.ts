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
  });
});
