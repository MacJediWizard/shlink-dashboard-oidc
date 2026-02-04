import { faExternalLink, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useFetcher, useRevalidator } from 'react-router';
import { serverContainer } from '../container/container.server';
import { FavoritesService } from '../favorites/FavoritesService.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';
import { ServersService } from '../servers/ServersService.server';
import type { Route } from './+types/server.$serverId.favorites-list';
import type { RouteComponentProps } from './types';

export const middleware = [authMiddleware];

interface Favorite {
  shortUrlId: string;
  shortCode: string;
  longUrl: string;
  title: string | null;
  notes: string | null;
  createdAt: string;
}

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  favoritesService: FavoritesService = serverContainer[FavoritesService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }

  const server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
  const favorites = await favoritesService.getFavorites(session.publicId, serverId);

  return {
    serverId,
    serverName: server.name,
    serverBaseUrl: server.baseUrl,
    favorites: favorites.map((f) => ({
      shortUrlId: f.shortUrlId,
      shortCode: f.shortCode,
      longUrl: f.longUrl,
      title: f.title,
      notes: f.notes,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function FavoritesList({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, serverBaseUrl, favorites } = loaderData as {
    serverId: string;
    serverName: string;
    serverBaseUrl: string;
    favorites: Favorite[];
  };

  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const handleRemove = async (shortUrlId: string) => {
    if (!confirm('Remove this URL from favorites?')) {
      return;
    }

    fetcher.submit(
      { action: 'remove', shortUrlId },
      {
        method: 'POST',
        action: `/server/${serverId}/favorites`,
        encType: 'application/json',
      },
    );

    // Revalidate after a short delay to allow the action to complete
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleSaveNotes = async (shortUrlId: string) => {
    fetcher.submit(
      { action: 'updateNotes', shortUrlId, notes: notesValue || null },
      {
        method: 'POST',
        action: `/server/${serverId}/favorites`,
        encType: 'application/json',
      },
    );

    setEditingNotes(null);
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const startEditingNotes = (shortUrlId: string, currentNotes: string | null) => {
    setEditingNotes(shortUrlId);
    setNotesValue(currentNotes || '');
  };

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <h2 className="flex items-center gap-2 mb-4">
          <FontAwesomeIcon icon={faStar} className="text-warning" />
          Favorites - {serverName}
        </h2>

        <p className="text-muted mb-4">
          Your favorited short URLs for quick access.
        </p>

        {favorites.length === 0 ? (
          <div className="text-center py-8">
            <FontAwesomeIcon icon={faStar} className="text-muted text-4xl mb-4" />
            <p className="text-muted">No favorites yet.</p>
            <p className="text-muted text-sm">
              Mark URLs as favorites from the short URLs list to see them here.
            </p>
          </div>
        ) : (
          <Table
            header={
              <Table.Row>
                <Table.Cell>Short Code</Table.Cell>
                <Table.Cell>Title / Long URL</Table.Cell>
                <Table.Cell>Notes</Table.Cell>
                <Table.Cell>Added</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            }
          >
            {favorites.map((fav) => (
              <Table.Row key={fav.shortUrlId}>
                <Table.Cell>
                  <code>{fav.shortCode}</code>
                </Table.Cell>
                <Table.Cell className="max-w-xs">
                  {fav.title && <div className="font-medium">{fav.title}</div>}
                  <div className="text-muted text-sm truncate" title={fav.longUrl}>
                    {fav.longUrl}
                  </div>
                </Table.Cell>
                <Table.Cell className="max-w-xs">
                  {editingNotes === fav.shortUrlId ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        placeholder="Add notes..."
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSaveNotes(fav.shortUrlId)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setEditingNotes(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link p-0 text-start"
                      onClick={() => startEditingNotes(fav.shortUrlId, fav.notes)}
                    >
                      {fav.notes || <span className="text-muted">Add notes...</span>}
                    </button>
                  )}
                </Table.Cell>
                <Table.Cell>{formatDate(fav.createdAt)}</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    <a
                      href={`${serverBaseUrl}/${fav.shortCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary"
                      title="Open short URL"
                    >
                      <FontAwesomeIcon icon={faExternalLink} />
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleRemove(fav.shortUrlId)}
                      title="Remove from favorites"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
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
