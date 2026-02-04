import { faCalendarTimes, faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import type { ShlinkApiClient } from '@shlinkio/shlink-js-sdk/api-contract';
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

  // Get short URLs with validUntil set, ordered by validUntil ascending
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    // Fetch all URLs and filter client-side for those expiring soon
    // Note: Shlink API may not support filtering by validUntil directly
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

    // Sort by days until expiration (soonest first)
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

function getExpirationBadgeClass(days: number): string {
  if (days <= 3) {
    return 'bg-danger text-white';
  }
  if (days <= 7) {
    return 'bg-warning text-dark';
  }
  return 'bg-info text-white';
}

export default function ExpiringUrls({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, expiringUrls, error } = loaderData as {
    serverId: string;
    serverName: string;
    expiringUrls: ExpiringUrl[];
    error?: string;
  };

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <h2 className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faCalendarTimes} />
          Expiring URLs - {serverName}
        </h2>

        <p className="text-muted mb-4">
          Short URLs expiring within the next 30 days.
        </p>

        {error && (
          <div className="alert alert-danger mb-4">
            Error fetching URLs: {error}
          </div>
        )}

        {expiringUrls.length === 0 ? (
          <p className="text-muted">No URLs expiring in the next 30 days.</p>
        ) : (
          <Table
            header={
              <Table.Row>
                <Table.Cell>Short Code</Table.Cell>
                <Table.Cell>Title / Long URL</Table.Cell>
                <Table.Cell>Expires</Table.Cell>
                <Table.Cell>Days Left</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            }
          >
            {expiringUrls.map((url) => (
              <Table.Row key={url.shortCode}>
                <Table.Cell>
                  <code>{url.shortCode}</code>
                </Table.Cell>
                <Table.Cell className="max-w-xs truncate">
                  {url.title && <div className="font-medium">{url.title}</div>}
                  <div className="text-muted text-sm truncate">{url.longUrl}</div>
                </Table.Cell>
                <Table.Cell>{formatDate(url.validUntil)}</Table.Cell>
                <Table.Cell>
                  <span className={`badge ${getExpirationBadgeClass(url.daysUntilExpiration)} px-2 py-1 rounded`}>
                    {url.daysUntilExpiration} {url.daysUntilExpiration === 1 ? 'day' : 'days'}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <a
                    href={url.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary"
                    title="Open short URL"
                  >
                    <FontAwesomeIcon icon={faExternalLink} />
                  </a>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        )}

        <div className="mt-4">
          <Link to={`/server/${serverId}`} className="btn btn-secondary">
            Back to Server
          </Link>
        </div>
      </SimpleCard>
    </main>
  );
}
