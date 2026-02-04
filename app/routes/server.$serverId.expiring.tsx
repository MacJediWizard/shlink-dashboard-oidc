import { faCalendarTimes, faExclamationTriangle, faExternalLink, faFilter } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import type { ShlinkApiClient } from '@shlinkio/shlink-js-sdk/api-contract';
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

  const [filterDays, setFilterDays] = useState<'all' | '7' | '14' | '30'>('all');

  const filteredUrls = expiringUrls.filter((url) => {
    if (filterDays === 'all') return true;
    return url.daysUntilExpiration <= parseInt(filterDays, 10);
  });

  const urgentCount = expiringUrls.filter((u) => u.daysUntilExpiration <= 7).length;

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        {/* Header with Stats */}
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h2 className="d-flex align-items-center gap-2 mb-2">
              <FontAwesomeIcon icon={faCalendarTimes} className="text-danger" />
              Expiring URLs
            </h2>
            <p className="text-muted mb-0">
              <strong>{serverName}</strong> &bull; {expiringUrls.length} URL{expiringUrls.length !== 1 ? 's' : ''} expiring within 30 days
            </p>
          </div>
        </div>

        {/* Urgent Warning */}
        {urgentCount > 0 && !error && (
          <div className="alert alert-danger d-flex align-items-center mb-4">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" style={{ fontSize: '1.2rem' }} />
            <div>
              <strong>{urgentCount} URL{urgentCount !== 1 ? 's' : ''} expiring within 7 days!</strong>
              <span className="ms-2 text-muted">Review and take action before they expire.</span>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="alert alert-light border d-flex align-items-center mb-4">
          <FontAwesomeIcon icon={faCalendarTimes} className="text-danger me-2" style={{ fontSize: '1.2rem' }} />
          <span>
            URLs with expiration dates set will stop redirecting after their expiration. Review and update them as needed.
          </span>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center mb-4">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
            <div>
              <strong>Error fetching URLs:</strong> {error}
            </div>
          </div>
        )}

        {/* Filter */}
        {expiringUrls.length > 0 && !error && (
          <div className="mb-4">
            <div className="input-group" style={{ maxWidth: '300px' }}>
              <span className="input-group-text">
                <FontAwesomeIcon icon={faFilter} />
              </span>
              <select
                className="form-select"
                value={filterDays}
                onChange={(e) => setFilterDays(e.target.value as 'all' | '7' | '14' | '30')}
              >
                <option value="all">Show all ({expiringUrls.length})</option>
                <option value="7">Within 7 days ({expiringUrls.filter((u) => u.daysUntilExpiration <= 7).length})</option>
                <option value="14">Within 14 days ({expiringUrls.filter((u) => u.daysUntilExpiration <= 14).length})</option>
                <option value="30">Within 30 days ({expiringUrls.length})</option>
              </select>
            </div>
          </div>
        )}

        {!error && expiringUrls.length === 0 ? (
          <div className="text-center py-5">
            <div className="mb-4">
              <FontAwesomeIcon icon={faCalendarTimes} className="text-success" style={{ fontSize: '4rem' }} />
            </div>
            <h4 className="text-success mb-3">All Clear!</h4>
            <p className="text-muted mb-0" style={{ maxWidth: '400px', margin: '0 auto' }}>
              No short URLs are expiring within the next 30 days. Check back later or set expiration dates on your URLs to track them here.
            </p>
          </div>
        ) : !error && filteredUrls.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted mb-2">No URLs match the selected filter.</p>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setFilterDays('all')}
            >
              Show all
            </button>
          </div>
        ) : !error && (
          <>
            {/* Results count */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <small className="text-muted">
                Showing {filteredUrls.length} of {expiringUrls.length} expiring URLs
              </small>
            </div>
            <div className="table-responsive">
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
                  <Table.Row key={url.shortCode} className={url.daysUntilExpiration <= 3 ? 'table-danger' : url.daysUntilExpiration <= 7 ? 'table-warning' : ''}>
                    <Table.Cell>
                      <code className="bg-light px-2 py-1 rounded">{url.shortCode}</code>
                    </Table.Cell>
                    <Table.Cell style={{ maxWidth: '300px' }}>
                      {url.title && <div className="fw-medium text-truncate">{url.title}</div>}
                      <div className="text-muted small text-truncate">{url.longUrl}</div>
                    </Table.Cell>
                    <Table.Cell className="text-nowrap">{formatDate(url.validUntil)}</Table.Cell>
                    <Table.Cell>
                      <span className={`badge ${getExpirationBadgeClass(url.daysUntilExpiration)}`}>
                        {url.daysUntilExpiration} {url.daysUntilExpiration === 1 ? 'day' : 'days'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <a
                        href={url.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                        title="Open short URL"
                      >
                        <FontAwesomeIcon icon={faExternalLink} />
                      </a>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
          <Link to={`/server/${serverId}`} className="btn btn-outline-secondary">
            &larr; Back to Server
          </Link>
          {expiringUrls.length > 0 && !error && (
            <small className="text-muted">
              {urgentCount > 0 && <span className="text-danger">{urgentCount} urgent</span>}
              {urgentCount > 0 && ' &bull; '}
              {expiringUrls.length} total expiring
            </small>
          )}
        </div>
      </SimpleCard>
    </main>
  );
}
