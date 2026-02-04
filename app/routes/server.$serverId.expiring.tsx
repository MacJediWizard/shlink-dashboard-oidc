import { faCalendarTimes, faExclamationTriangle, faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, LabelledSelect, SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import type { ShlinkApiClient } from '@shlinkio/shlink-js-sdk/api-contract';
import { clsx } from 'clsx';
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';
import { apiClientBuilder as defaultApiClientBuilder } from '../api/apiClientBuilder.server';
import { serverContainer } from '../container/container.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';
import { ServersService } from '../servers/ServersService.server';
import type { Route } from './+types/server.$serverId.expiring';
import type { RouteComponentProps } from './types';

export const middleware = [authMiddleware];

interface ExpiringUrl {
  shortCode: string;
  shortUrl: string;
  longUrl: string;
  title: string | null;
  validUntil: string;
  daysUntilExpiration: number;
}

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  apiClientBuilder: typeof defaultApiClientBuilder = defaultApiClientBuilder,
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }

  const server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
  const apiClient: ShlinkApiClient = apiClientBuilder(server);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    const result = await apiClient.listShortUrls({
      itemsPerPage: 100,
      orderBy: { field: 'dateCreated', dir: 'DESC' },
    });

    const expiringUrls: ExpiringUrl[] = [];

    for (const shortUrl of result.data) {
      if (shortUrl.meta?.validUntil) {
        const validUntil = new Date(shortUrl.meta.validUntil);
        if (validUntil <= thirtyDaysFromNow && validUntil > now) {
          const daysUntilExpiration = Math.ceil(
            (validUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          );

          expiringUrls.push({
            shortCode: shortUrl.shortCode,
            shortUrl: shortUrl.shortUrl,
            longUrl: shortUrl.longUrl,
            title: shortUrl.title ?? null,
            validUntil: shortUrl.meta.validUntil,
            daysUntilExpiration,
          });
        }
      }
    }

    expiringUrls.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

    return {
      serverId,
      serverName: server.name,
      expiringUrls,
    };
  } catch (error: any) {
    return {
      serverId,
      serverName: server.name,
      expiringUrls: [],
      error: error.message,
    };
  }
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Badge for days until expiration
function ExpirationBadge({ days }: { days: number }) {
  return (
    <span
      className={clsx(
        'rounded-sm px-2 py-0.5 text-xs font-bold',
        days <= 3 && 'bg-danger text-white',
        days > 3 && days <= 7 && 'bg-warning text-dark',
        days > 7 && 'bg-info text-white',
      )}
    >
      {days} {days === 1 ? 'day' : 'days'}
    </span>
  );
}

export default function ExpiringUrls({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, expiringUrls, error } = loaderData as {
    serverId: string;
    serverName: string;
    expiringUrls: ExpiringUrl[];
    error?: string;
  };

  const [filterDays, setFilterDays] = useState<'all' | '7' | '14' | '30'>('all');

  const filteredUrls = expiringUrls.filter((url) => {
    if (filterDays === 'all') return true;
    return url.daysUntilExpiration <= parseInt(filterDays, 10);
  });

  const urgentCount = expiringUrls.filter((u) => u.daysUntilExpiration <= 7).length;

  return (
    <main className="container py-4 mx-auto flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <FontAwesomeIcon icon={faCalendarTimes} className="text-red-600" />
            Expiring URLs
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>{serverName}</strong> &bull; {expiringUrls.length} URL{expiringUrls.length !== 1 ? 's' : ''} expiring within 30 days
          </p>
        </div>
      </div>

      {/* Urgent Warning */}
      {urgentCount > 0 && !error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-xl" />
          <div>
            <strong>{urgentCount} URL{urgentCount !== 1 ? 's' : ''} expiring within 7 days!</strong>
            <span className="ml-2 text-red-600 dark:text-red-400">Review and take action before they expire.</span>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <FontAwesomeIcon icon={faCalendarTimes} className="text-red-600 text-xl" />
        <span className="text-gray-600 dark:text-gray-400">
          URLs with expiration dates set will stop redirecting after their expiration.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <div>
            <strong>Error fetching URLs:</strong> {error}
          </div>
        </div>
      )}

      {/* Filter */}
      {expiringUrls.length > 0 && !error && (
        <div className="max-w-xs">
          <LabelledSelect
            label="Filter by time"
            value={filterDays}
            onChange={(e) => setFilterDays(e.target.value as 'all' | '7' | '14' | '30')}
          >
            <option value="all">Show all ({expiringUrls.length})</option>
            <option value="7">Within 7 days ({expiringUrls.filter((u) => u.daysUntilExpiration <= 7).length})</option>
            <option value="14">Within 14 days ({expiringUrls.filter((u) => u.daysUntilExpiration <= 14).length})</option>
            <option value="30">Within 30 days ({expiringUrls.length})</option>
          </LabelledSelect>
        </div>
      )}

      {/* Content */}
      {!error && expiringUrls.length === 0 ? (
        <SimpleCard bodyClassName="text-center py-8">
          <FontAwesomeIcon icon={faCalendarTimes} className="text-green-600 text-5xl mb-4" />
          <h4 className="text-green-600 mb-2">All Clear!</h4>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            No short URLs are expiring within the next 30 days.
          </p>
        </SimpleCard>
      ) : !error && filteredUrls.length === 0 ? (
        <SimpleCard bodyClassName="text-center py-4">
          <p className="text-gray-500 mb-2">No URLs match the selected filter.</p>
          <Button variant="secondary" onClick={() => setFilterDays('all')}>
            Show all
          </Button>
        </SimpleCard>
      ) : !error && (
        <SimpleCard
          title={`${filteredUrls.length} expiring URL${filteredUrls.length !== 1 ? 's' : ''}`}
          bodyClassName="flex flex-col gap-4"
        >
          <Table
            header={
              <Table.Row>
                <Table.Cell>Short Code</Table.Cell>
                <Table.Cell>Title / Destination</Table.Cell>
                <Table.Cell>Expires</Table.Cell>
                <Table.Cell>Time Left</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            }
          >
            {filteredUrls.map((url) => (
              <Table.Row
                key={url.shortCode}
                className={clsx(
                  url.daysUntilExpiration <= 3 && 'bg-red-50 dark:bg-red-900/20',
                  url.daysUntilExpiration > 3 && url.daysUntilExpiration <= 7 && 'bg-yellow-50 dark:bg-yellow-900/20',
                )}
              >
                <Table.Cell>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">{url.shortCode}</code>
                </Table.Cell>
                <Table.Cell className="max-w-xs">
                  {url.title && <div className="font-medium truncate">{url.title}</div>}
                  <div className="text-gray-500 text-sm truncate">{url.longUrl}</div>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">{formatDate(url.validUntil)}</Table.Cell>
                <Table.Cell>
                  <ExpirationBadge days={url.daysUntilExpiration} />
                </Table.Cell>
                <Table.Cell>
                  <a
                    href={url.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                    title="Open short URL"
                  >
                    <FontAwesomeIcon icon={faExternalLink} />
                  </a>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        </SimpleCard>
      )}

      {/* Summary & Back Link */}
      <div className="flex justify-between items-center">
        <Link to={`/server/${serverId}`} className="text-blue-600 hover:underline">
          &larr; Back to Server
        </Link>
        {expiringUrls.length > 0 && !error && (
          <span className="text-gray-500 text-sm">
            {urgentCount > 0 && <span className="text-red-600 font-bold">{urgentCount} urgent</span>}
            {urgentCount > 0 && ' &bull; '}
            {expiringUrls.length} total expiring
          </span>
        )}
      </div>
    </main>
  );
}
