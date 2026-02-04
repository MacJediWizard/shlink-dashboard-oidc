import { faExternalLink, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, LabelledInput, SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newShortCode, setNewShortCode] = useState('');
  const [newLongUrl, setNewLongUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

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

  const handleAddFavorite = async () => {
    if (!newShortCode.trim() || !newLongUrl.trim()) {
      alert('Short code and long URL are required');
      return;
    }

    const shortUrlId = `manual-${newShortCode.trim()}-${Date.now()}`;

    fetcher.submit(
      {
        action: 'add',
        shortUrlId,
        shortCode: newShortCode.trim(),
        longUrl: newLongUrl.trim(),
        title: newTitle.trim() || undefined,
        notes: newNotes.trim() || undefined,
      },
      {
        method: 'POST',
        action: `/server/${serverId}/favorites`,
        encType: 'application/json',
      },
    );

    setShowAddForm(false);
    setNewShortCode('');
    setNewLongUrl('');
    setNewTitle('');
    setNewNotes('');
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const filteredFavorites = favorites
    .filter((fav) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        fav.shortCode.toLowerCase().includes(term) ||
        fav.longUrl.toLowerCase().includes(term) ||
        (fav.title?.toLowerCase().includes(term) ?? false) ||
        (fav.notes?.toLowerCase().includes(term) ?? false)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const isLoading = fetcher.state !== 'idle';

  return (
    <main className="container py-4 mx-auto flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <FontAwesomeIcon icon={faStar} className="text-yellow-500" />
            Favorites
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>{serverName}</strong> &bull; {favorites.length} saved {favorites.length === 1 ? 'URL' : 'URLs'}
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} disabled={isLoading}>
          <FontAwesomeIcon icon={faPlus} className="mr-1" />
          Add Favorite
        </Button>
      </div>

      {/* Info Card */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <FontAwesomeIcon icon={faStar} className="text-yellow-500 text-xl" />
        <span className="text-gray-600 dark:text-gray-400">
          Save your frequently used short URLs here for quick access.
        </span>
      </div>

      {/* Add Favorite Form */}
      {showAddForm && (
        <SimpleCard title="Add New Favorite" bodyClassName="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shortCode" className="block text-sm font-medium mb-1">Short Code *</label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-l border border-r-0 border-gray-300 dark:border-gray-600 text-sm">
                  {serverBaseUrl}/
                </span>
                <input
                  type="text"
                  id="shortCode"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r bg-white dark:bg-gray-800"
                  value={newShortCode}
                  onChange={(e) => setNewShortCode(e.target.value)}
                  placeholder="abc123"
                />
              </div>
            </div>
            <LabelledInput
              label="Destination URL"
              required
              type="url"
              value={newLongUrl}
              onChange={(e) => setNewLongUrl(e.target.value)}
              placeholder="https://example.com/page"
            />
            <LabelledInput
              label="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Marketing Campaign"
            />
            <LabelledInput
              label="Notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g., Used for Q1 campaign"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddFavorite} disabled={isLoading}>
              <FontAwesomeIcon icon={faStar} className="mr-1" />
              {isLoading ? 'Adding...' : 'Add to Favorites'}
            </Button>
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        </SimpleCard>
      )}

      {/* Search */}
      {favorites.length > 0 && (
        <div className="relative">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            placeholder="Search by short code, URL, title, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      {favorites.length === 0 ? (
        <SimpleCard bodyClassName="text-center py-8">
          <FontAwesomeIcon icon={faStar} className="text-yellow-500 text-5xl mb-4" />
          <h4 className="text-gray-600 dark:text-gray-400 mb-2">No Favorites Yet</h4>
          <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
            Start building your collection of favorite short URLs for quick access.
          </p>
          <Button onClick={() => setShowAddForm(true)} disabled={isLoading}>
            <FontAwesomeIcon icon={faPlus} className="mr-1" />
            Add Your First Favorite
          </Button>
        </SimpleCard>
      ) : filteredFavorites.length === 0 ? (
        <SimpleCard bodyClassName="text-center py-4">
          <p className="text-gray-500">No favorites match your search.</p>
        </SimpleCard>
      ) : (
        <SimpleCard
          title={`${filteredFavorites.length} favorite${filteredFavorites.length !== 1 ? 's' : ''}`}
          bodyClassName="flex flex-col gap-4"
        >
          <Table
            header={
              <Table.Row>
                <Table.Cell>Short Code</Table.Cell>
                <Table.Cell>Title / Destination</Table.Cell>
                <Table.Cell>Notes</Table.Cell>
                <Table.Cell>Added</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            }
          >
            {filteredFavorites.map((fav) => (
              <Table.Row key={fav.shortUrlId}>
                <Table.Cell>
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">{fav.shortCode}</code>
                </Table.Cell>
                <Table.Cell className="max-w-xs">
                  {fav.title && <div className="font-medium truncate">{fav.title}</div>}
                  <div
                    className="text-gray-500 text-sm cursor-pointer"
                    style={{
                      wordBreak: 'break-all',
                      maxHeight: expandedUrl === fav.shortUrlId ? 'none' : '40px',
                      overflow: 'hidden',
                    }}
                    onClick={() => setExpandedUrl(expandedUrl === fav.shortUrlId ? null : fav.shortUrlId)}
                    title={fav.longUrl}
                  >
                    {fav.longUrl}
                  </div>
                  {fav.longUrl.length > 50 && (
                    <button
                      type="button"
                      className="text-blue-600 hover:underline text-sm"
                      onClick={() => setExpandedUrl(expandedUrl === fav.shortUrlId ? null : fav.shortUrlId)}
                    >
                      {expandedUrl === fav.shortUrlId ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </Table.Cell>
                <Table.Cell className="max-w-xs">
                  {editingNotes === fav.shortUrlId ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        placeholder="Add notes..."
                        autoFocus
                      />
                      <Button onClick={() => handleSaveNotes(fav.shortUrlId)} disabled={isLoading}>
                        Save
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingNotes(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-left hover:text-blue-600"
                      onClick={() => startEditingNotes(fav.shortUrlId, fav.notes)}
                    >
                      {fav.notes ? (
                        <span>{fav.notes}</span>
                      ) : (
                        <span className="text-gray-400 italic">Add notes...</span>
                      )}
                    </button>
                  )}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap">{formatDate(fav.createdAt)}</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    <a
                      href={`${serverBaseUrl}/${fav.shortCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                      title="Open short URL"
                    >
                      <FontAwesomeIcon icon={faExternalLink} />
                    </a>
                    <Button
                      variant="danger"
                      onClick={() => handleRemove(fav.shortUrlId)}
                      title="Remove from favorites"
                      disabled={isLoading}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        </SimpleCard>
      )}

      {/* Back Link */}
      <div>
        <Link to={`/server/${serverId}`} className="text-blue-600 hover:underline">
          &larr; Back to Server
        </Link>
      </div>
    </main>
  );
}
