import { faHistory } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Paginator, SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import type { LoaderFunctionArgs } from 'react-router';
import { href } from 'react-router';
import { AuditService } from '../../audit/AuditService.server';
import { serverContainer } from '../../container/container.server';
import { ensureAdminMiddleware } from '../../middleware/middleware.server';
import type { RouteComponentProps } from '../types';
import type { Route } from './+types/audit-log';

export const middleware = [ensureAdminMiddleware];

export async function loader(
  { params }: LoaderFunctionArgs,
  auditService: AuditService = serverContainer[AuditService.name],
) {
  const page = Number(params.page ?? '1');
  const itemsPerPage = 25;

  const { logs, total } = await auditService.getAuditLogs({
    page,
    itemsPerPage,
  });

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      details: log.details,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
      username: log.user?.username ?? 'System',
      serverName: log.server?.name ?? null,
    })),
    pagination: {
      currentPage: page,
      pagesCount: Math.ceil(total / itemsPerPage),
      totalItems: total,
    },
  };
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString();
}

export default function AuditLog({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { logs, pagination } = loaderData;

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <h2 className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faHistory} />
          Audit Log
        </h2>

        {logs.length === 0 ? (
          <p className="text-muted">No audit log entries found.</p>
        ) : (
          <>
            <Table
              header={
                <Table.Row>
                  <Table.Cell>Date/Time</Table.Cell>
                  <Table.Cell>User</Table.Cell>
                  <Table.Cell>Action</Table.Cell>
                  <Table.Cell>Resource</Table.Cell>
                  <Table.Cell>Server</Table.Cell>
                  <Table.Cell>IP Address</Table.Cell>
                </Table.Row>
              }
            >
              {logs.map((log) => (
                <Table.Row key={log.id}>
                  <Table.Cell>{formatDate(log.createdAt)}</Table.Cell>
                  <Table.Cell>{log.username}</Table.Cell>
                  <Table.Cell>{formatAction(log.action)}</Table.Cell>
                  <Table.Cell>
                    {log.resourceType ? `${log.resourceType}: ${log.resourceId ?? 'N/A'}` : '-'}
                  </Table.Cell>
                  <Table.Cell>{log.serverName ?? '-'}</Table.Cell>
                  <Table.Cell>{log.ipAddress ?? '-'}</Table.Cell>
                </Table.Row>
              ))}
            </Table>

            <Paginator
              pagesCount={pagination.pagesCount}
              currentPage={pagination.currentPage}
              urlForPage={(page) => href('/admin/audit-log/:page', { page: String(page) })}
            />
          </>
        )}
      </SimpleCard>
    </main>
  );
}
