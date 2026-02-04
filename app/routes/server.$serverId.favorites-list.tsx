import { faExternalLink, faPlus, faSearch, faSortAlphaDown, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  const [sortBy, setSortBy] = useState<'date' | 'shortCode' | 'title'>('date');

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
    .sort((a, b) => {
      switch (sortBy) {
        case 'shortCode':
          return a.shortCode.localeCompare(b.shortCode);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const isLoading = fetcher.state !== 'idle';

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        {/* Header with Stats */}
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h2 className="d-flex align-items-center gap-2 mb-2">
              <FontAwesomeIcon icon={faStar} className="text-warning" />
              Favorites
            </h2>
            <p className="text-muted mb-0">
              <strong>{serverName}</strong> &bull; {favorites.length} saved {favorites.length === 1 ? 'URL' : 'URLs'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            Add Favorite
          </button>
        </div>

        {/* Info Card */}
        <div className="alert alert-light border d-flex align-items-center mb-4">
          <FontAwesomeIcon icon={faStar} className="text-warning me-2" style={{ fontSize: '1.2rem' }} />
          <span>
            Save your frequently used short URLs here for quick access. Add URLs manually or organize your most important links.
          </span>
        </div>

        {/* Add Favorite Form */}
        {showAddForm && (
          <div className="card mb-4 border-warning">
            <div className="card-header bg-warning bg-opacity-25 d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faStar} className="text-warning" />
              <strong>Add New Favorite</strong>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="shortCode" className="form-label fw-bold">
                    Short Code <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">{serverBaseUrl}/</span>
                    <input
                      type="text"
                      id="shortCode"
                      className="form-control"
                      value={newShortCode}
                      onChange={(e) => setNewShortCode(e.target.value)}
                      placeholder="abc123"
                    />
                  </div>
                  <small className="text-muted">The short code part of your URL</small>
                </div>
                <div className="col-md-6">
                  <label htmlFor="longUrl" className="form-label fw-bold">
                    Destination URL <span className="text-danger">*</span>
                  </label>
                  <input
                    type="url"
                    id="longUrl"
                    className="form-control"
                    value={newLongUrl}
                    onChange={(e) => setNewLongUrl(e.target.value)}
                    placeholder="https://example.com/page"
                  />
                  <small className="text-muted">The full URL that the short URL redirects to</small>
                </div>
                <div className="col-md-6">
                  <label htmlFor="title" className="form-label fw-bold">Title</label>
                  <input
                    type="text"
                    id="title"
                    className="form-control"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Marketing Campaign Landing Page"
                  />
                  <small className="text-muted">A friendly name to help you remember this URL</small>
                </div>
                <div className="col-md-6">
                  <label htmlFor="notes" className="form-label fw-bold">Notes</label>
                  <input
                    type="text"
                    id="notes"
                    className="form-control"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g., Used for Q1 campaign"
                  />
                  <small className="text-muted">Any additional notes for your reference</small>
                </div>
                <div className="col-12 d-flex gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={handleAddFavorite}
                    disabled={isLoading}
                  >
                    <FontAwesomeIcon icon={faStar} className="me-1" />
                    {isLoading ? 'Adding...' : 'Add to Favorites'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Sort Controls */}
        {favorites.length > 0 && (
          <div className="row g-3 mb-4">
            <div className="col-md-8">
              <div className="input-group">
                <span className="input-group-text">
                  <FontAwesomeIcon icon={faSearch} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by short code, URL, title, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSearchTerm('')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text">
                  <FontAwesomeIcon icon={faSortAlphaDown} />
                </span>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'shortCode' | 'title')}
                >
                  <option value="date">Sort by: Newest first</option>
                  <option value="shortCode">Sort by: Short code</option>
                  <option value="title">Sort by: Title</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {favorites.length === 0 ? (
          <div className="text-center py-5">
            <div className="mb-4">
              <FontAwesomeIcon icon={faStar} className="text-warning" style={{ fontSize: '4rem' }} />
            </div>
            <h4 className="mb-3">No Favorites Yet</h4>
            <p className="text-muted mb-4" style={{ maxWidth: '400px', margin: '0 auto' }}>
              Start building your collection of favorite short URLs for quick access. Save the links you use most often!
            </p>
            <button
              type="button"
              className="btn btn-warning btn-lg"
              onClick={() => setShowAddForm(true)}
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={faPlus} className="me-1" />
              Add Your First Favorite
            </button>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-5">
            <FontAwesomeIcon icon={faSearch} className="text-muted mb-3" style={{ fontSize: '2rem' }} />
            <p className="text-muted mb-2">No favorites match your search.</p>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setSearchTerm('')}
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <small className="text-muted">
                Showing {filteredFavorites.length} of {favorites.length} favorites
              </small>
            </div>
            <div className="table-responsive">
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
          </>
        )}

        {/* Navigation */}
        <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
          <Link to={`/server/${serverId}`} className="btn btn-outline-secondary">
            &larr; Back to Server
          </Link>
          {favorites.length > 0 && (
            <small className="text-muted">
              {favorites.length} favorite{favorites.length !== 1 ? 's' : ''} saved
            </small>
          )}
        </div>
      </SimpleCard>
    </main>
  );
}
