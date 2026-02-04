import { faExternalLink, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
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

    // Generate a unique ID for the favorite (using shortCode as base)
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

  const filteredFavorites = favorites.filter((fav) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      fav.shortCode.toLowerCase().includes(term) ||
      fav.longUrl.toLowerCase().includes(term) ||
      (fav.title?.toLowerCase().includes(term) ?? false) ||
      (fav.notes?.toLowerCase().includes(term) ?? false)
    );
  });

  const isLoading = fetcher.state !== 'idle';

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="d-flex align-items-center gap-2 mb-0">
            <FontAwesomeIcon icon={faStar} className="text-warning" />
            Favorites - {serverName}
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            Add Favorite
          </button>
        </div>

        <p className="text-muted mb-4">
          Your favorited short URLs for quick access. Add URLs manually or mark them as favorites from the Shlink interface.
        </p>

        {/* Add Favorite Form */}
        {showAddForm && (
          <div className="card mb-4 p-3 bg-light">
            <h5 className="mb-3">Add New Favorite</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="shortCode" className="form-label">Short Code *</label>
                <input
                  type="text"
                  id="shortCode"
                  className="form-control"
                  value={newShortCode}
                  onChange={(e) => setNewShortCode(e.target.value)}
                  placeholder="abc123"
                />
                <small className="text-muted">The short code part of your URL</small>
              </div>
              <div className="col-md-6">
                <label htmlFor="longUrl" className="form-label">Long URL *</label>
                <input
                  type="url"
                  id="longUrl"
                  className="form-control"
                  value={newLongUrl}
                  onChange={(e) => setNewLongUrl(e.target.value)}
                  placeholder="https://example.com/page"
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="title" className="form-label">Title (optional)</label>
                <input
                  type="text"
                  id="title"
                  className="form-control"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="My favorite link"
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="notes" className="form-label">Notes (optional)</label>
                <input
                  type="text"
                  id="notes"
                  className="form-control"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Remember this for..."
                />
              </div>
              <div className="col-12">
                <button
                  type="button"
                  className="btn btn-success me-2"
                  onClick={handleAddFavorite}
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add to Favorites'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {favorites.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search favorites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {favorites.length === 0 ? (
          <div className="text-center py-5">
            <FontAwesomeIcon icon={faStar} className="text-muted mb-3" style={{ fontSize: '3rem' }} />
            <p className="text-muted mb-2">No favorites yet.</p>
            <p className="text-muted small">
              Click "Add Favorite" above to add URLs manually, or mark them as favorites from the short URLs list.
            </p>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted">No favorites match your search.</p>
          </div>
        ) : (
          <div className="table-responsive">
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
              {filteredFavorites.map((fav) => (
                <Table.Row key={fav.shortUrlId}>
                  <Table.Cell>
                    <code className="bg-light px-2 py-1 rounded">{fav.shortCode}</code>
                  </Table.Cell>
                  <Table.Cell style={{ maxWidth: '300px' }}>
                    {fav.title && <div className="fw-medium text-truncate">{fav.title}</div>}
                    <div
                      className="text-muted small"
                      style={{
                        wordBreak: 'break-all',
                        maxHeight: expandedUrl === fav.shortUrlId ? 'none' : '40px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedUrl(expandedUrl === fav.shortUrlId ? null : fav.shortUrlId)}
                      title={fav.longUrl}
                    >
                      {fav.longUrl}
                    </div>
                    {fav.longUrl.length > 50 && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted"
                        onClick={() => setExpandedUrl(expandedUrl === fav.shortUrlId ? null : fav.shortUrlId)}
                      >
                        {expandedUrl === fav.shortUrlId ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ maxWidth: '200px' }}>
                    {editingNotes === fav.shortUrlId ? (
                      <div className="d-flex gap-2 align-items-center">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Add notes..."
                          autoFocus
                          style={{ minWidth: '120px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => handleSaveNotes(fav.shortUrlId)}
                          disabled={isLoading}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setEditingNotes(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-link p-0 text-start text-decoration-none"
                        onClick={() => startEditingNotes(fav.shortUrlId, fav.notes)}
                        style={{ maxWidth: '100%' }}
                      >
                        {fav.notes ? (
                          <span className="text-dark">{fav.notes}</span>
                        ) : (
                          <span className="text-muted fst-italic">Add notes...</span>
                        )}
                      </button>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">{formatDate(fav.createdAt)}</Table.Cell>
                  <Table.Cell>
                    <div className="d-flex gap-2">
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
                        disabled={isLoading}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </div>
        )}

        <div className="mt-4 d-flex gap-2">
          <Link to={`/server/${serverId}`} className="btn btn-secondary">
            Back to Server
          </Link>
        </div>
      </SimpleCard>
    </main>
  );
}
