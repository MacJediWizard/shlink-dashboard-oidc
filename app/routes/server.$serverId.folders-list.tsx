import {
  faChevronDown,
  faChevronRight,
  faEdit,
  faFolder,
  faFolderOpen,
  faPlus,
  faSearch,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useFetcher, useRevalidator } from 'react-router';
import { serverContainer } from '../container/container.server';
import { FoldersService } from '../folders/FoldersService.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';
import { ServersService } from '../servers/ServersService.server';
import type { Route } from './+types/server.$serverId.folders-list';
import type { RouteComponentProps } from './types';

export const middleware = [authMiddleware];

interface FolderItem {
  shortUrlId: string;
  shortCode: string;
  addedAt: string;
}

interface Folder {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
  itemCount: number;
  items: FolderItem[];
}

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  foldersService: FoldersService = serverContainer[FoldersService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }

  const server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
  const folders = await foldersService.getFolders(session.publicId, serverId);

  return {
    serverId,
    serverName: server.name,
    serverBaseUrl: server.baseUrl,
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      createdAt: f.createdAt.toISOString(),
      itemCount: f.items.length,
      items: f.items.getItems().map((item) => ({
        shortUrlId: item.shortUrlId,
        shortCode: item.shortCode,
        addedAt: item.addedAt.toISOString(),
      })),
    })),
  };
}

const FOLDER_COLORS = [
  '#dc3545', // Red
  '#fd7e14', // Orange
  '#ffc107', // Yellow
  '#28a745', // Green
  '#20c997', // Teal
  '#17a2b8', // Cyan
  '#007bff', // Blue
  '#6f42c1', // Purple
  '#e83e8c', // Pink
  '#6c757d', // Gray
];

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function FoldersList({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, serverBaseUrl, folders } = loaderData as {
    serverId: string;
    serverName: string;
    serverBaseUrl: string;
    folders: Folder[];
  };

  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // Add URL to folder state
  const [addingToFolder, setAddingToFolder] = useState<number | null>(null);
  const [newItemShortCode, setNewItemShortCode] = useState('');

  const isLoading = fetcher.state !== 'idle';

  const toggleFolder = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Folder name is required');
      return;
    }

    fetcher.submit(
      { action: 'create', name: newFolderName.trim(), color: newFolderColor },
      {
        method: 'POST',
        action: `/server/${serverId}/folders`,
        encType: 'application/json',
      },
    );

    setShowCreateForm(false);
    setNewFolderName('');
    setNewFolderColor(FOLDER_COLORS[0]);
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm('Delete this folder? URLs inside will not be deleted from Shlink.')) {
      return;
    }

    fetcher.submit(
      { action: 'delete', folderId },
      {
        method: 'POST',
        action: `/server/${serverId}/folders`,
        encType: 'application/json',
      },
    );

    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleRemoveItem = async (folderId: number, shortUrlId: string) => {
    fetcher.submit(
      { action: 'removeItem', folderId, shortUrlId },
      {
        method: 'POST',
        action: `/server/${serverId}/folders`,
        encType: 'application/json',
      },
    );

    setTimeout(() => revalidator.revalidate(), 500);
  };

  const startEditFolder = (folder: Folder) => {
    setEditingFolder(folder.id);
    setEditName(folder.name);
    setEditColor(folder.color || FOLDER_COLORS[0]);
  };

  const handleUpdateFolder = async (folderId: number) => {
    if (!editName.trim()) {
      return;
    }

    fetcher.submit(
      { action: 'update', folderId, name: editName.trim(), color: editColor },
      {
        method: 'POST',
        action: `/server/${serverId}/folders`,
        encType: 'application/json',
      },
    );

    setEditingFolder(null);
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleAddItemToFolder = async (folderId: number) => {
    if (!newItemShortCode.trim()) {
      alert('Short code is required');
      return;
    }

    // Generate a unique ID for the item
    const shortUrlId = `folder-item-${newItemShortCode.trim()}-${Date.now()}`;

    fetcher.submit(
      {
        action: 'addItem',
        folderId,
        shortUrlId,
        shortCode: newItemShortCode.trim(),
      },
      {
        method: 'POST',
        action: `/server/${serverId}/folders`,
        encType: 'application/json',
      },
    );

    setAddingToFolder(null);
    setNewItemShortCode('');
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const filteredFolders = folders.filter((folder) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      folder.name.toLowerCase().includes(term) ||
      folder.items.some((item) => item.shortCode.toLowerCase().includes(term))
    );
  });

  const totalItems = folders.reduce((sum, f) => sum + f.itemCount, 0);

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        {/* Header with Stats */}
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h2 className="d-flex align-items-center gap-2 mb-2">
              <FontAwesomeIcon icon={faFolder} className="text-primary" />
              Folders
            </h2>
            <p className="text-muted mb-0">
              <strong>{serverName}</strong> &bull; {folders.length} folder{folders.length !== 1 ? 's' : ''} &bull; {totalItems} total URL{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            New Folder
          </button>
        </div>

        {/* Info Card */}
        <div className="alert alert-light border d-flex align-items-center mb-4">
          <FontAwesomeIcon icon={faFolderOpen} className="text-primary me-2" style={{ fontSize: '1.2rem' }} />
          <span>
            Organize your short URLs into folders for better management. Create folders by topic, campaign, or any category that works for you.
          </span>
        </div>

        {/* Create Folder Form */}
        {showCreateForm && (
          <div className="card mb-4 border-primary">
            <div className="card-header bg-primary text-white d-flex align-items-center gap-2">
              <FontAwesomeIcon icon={faFolder} />
              <strong>Create New Folder</strong>
            </div>
            <div className="card-body">
              <div className="row g-4">
                <div className="col-md-6">
                  <label htmlFor="folderName" className="form-label fw-bold">
                    Folder Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    id="folderName"
                    className="form-control form-control-lg"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g., Marketing Campaigns"
                  />
                  <small className="text-muted">Give your folder a descriptive name</small>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold">Folder Color</label>
                  <div className="d-flex gap-2 flex-wrap p-2 bg-light rounded">
                    {FOLDER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="btn p-0 position-relative"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: color,
                          border: newFolderColor === color ? '3px solid #000' : '2px solid #dee2e6',
                          borderRadius: 8,
                          transition: 'all 0.15s ease',
                          transform: newFolderColor === color ? 'scale(1.15)' : 'scale(1)',
                          boxShadow: newFolderColor === color ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                        }}
                        onClick={() => setNewFolderColor(color)}
                        title={`Select ${color}`}
                      />
                    ))}
                  </div>
                  <small className="text-muted">Choose a color to visually identify this folder</small>
                </div>
                <div className="col-12">
                  {/* Preview */}
                  <div className="p-3 rounded mb-3" style={{ backgroundColor: `${newFolderColor}15`, borderLeft: `4px solid ${newFolderColor}` }}>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="d-inline-block rounded"
                        style={{ width: 24, height: 24, backgroundColor: newFolderColor }}
                      />
                      <strong>{newFolderName || 'Folder Preview'}</strong>
                      <span className="badge bg-secondary ms-2">0 URLs</span>
                    </div>
                  </div>
                </div>
                <div className="col-12 d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleCreateFolder}
                    disabled={isLoading || !newFolderName.trim()}
                  >
                    <FontAwesomeIcon icon={faPlus} className="me-1" />
                    {isLoading ? 'Creating...' : 'Create Folder'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {folders.length > 0 && (
          <div className="mb-4">
            <div className="input-group">
              <span className="input-group-text">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search folders by name or short code..."
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
        )}

        {folders.length === 0 ? (
          <div className="text-center py-5">
            <div className="mb-4">
              <FontAwesomeIcon icon={faFolderOpen} className="text-primary" style={{ fontSize: '4rem' }} />
            </div>
            <h4 className="mb-3">No Folders Yet</h4>
            <p className="text-muted mb-4" style={{ maxWidth: '400px', margin: '0 auto' }}>
              Start organizing your short URLs by creating folders. Group them by campaign, topic, client, or any category that makes sense for you.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => setShowCreateForm(true)}
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={faPlus} className="me-1" />
              Create Your First Folder
            </button>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="text-center py-5">
            <FontAwesomeIcon icon={faSearch} className="text-muted mb-3" style={{ fontSize: '2rem' }} />
            <p className="text-muted mb-2">No folders match your search.</p>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setSearchTerm('')}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className="border rounded overflow-hidden"
                style={{ borderColor: folder.color || '#dee2e6' }}
              >
                {/* Folder Header */}
                <div
                  className="p-3 d-flex align-items-center justify-content-between"
                  style={{
                    backgroundColor: folder.color ? `${folder.color}15` : '#f8f9fa',
                    borderLeft: `4px solid ${folder.color || '#6c757d'}`,
                  }}
                >
                  <div className="d-flex align-items-center gap-2 flex-grow-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 text-secondary"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <FontAwesomeIcon
                        icon={expandedFolders.has(folder.id) ? faChevronDown : faChevronRight}
                      />
                    </button>
                    <span
                      className="d-inline-block rounded"
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: folder.color || '#6c757d',
                        flexShrink: 0,
                      }}
                    />
                    {editingFolder === folder.id ? (
                      <div className="d-flex gap-2 align-items-center flex-wrap">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: 180 }}
                          autoFocus
                        />
                        <div className="d-flex gap-1 p-1 bg-white rounded">
                          {FOLDER_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="btn p-0"
                              style={{
                                width: 22,
                                height: 22,
                                backgroundColor: color,
                                border: editColor === color ? '2px solid #000' : '1px solid #dee2e6',
                                borderRadius: 4,
                                transform: editColor === color ? 'scale(1.1)' : 'scale(1)',
                              }}
                              onClick={() => setEditColor(color)}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => handleUpdateFolder(folder.id)}
                          disabled={isLoading}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setEditingFolder(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold">{folder.name}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-muted p-0"
                          onClick={() => startEditFolder(folder)}
                          title="Edit folder name and color"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                      </div>
                    )}
                    <span className="badge bg-secondary ms-2">{folder.itemCount} URLs</span>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        setAddingToFolder(addingToFolder === folder.id ? null : folder.id);
                        setNewItemShortCode('');
                        if (!expandedFolders.has(folder.id)) {
                          toggleFolder(folder.id);
                        }
                      }}
                      title="Add URL to folder"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteFolder(folder.id)}
                      title="Delete folder"
                      disabled={isLoading}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>

                {/* Add Item Form */}
                {addingToFolder === folder.id && (
                  <div className="p-3 border-top bg-light">
                    <h6 className="mb-2">Add URL to Folder</h6>
                    <div className="d-flex gap-2 align-items-end">
                      <div className="flex-grow-1">
                        <label htmlFor={`shortCode-${folder.id}`} className="form-label small">
                          Short Code *
                        </label>
                        <input
                          type="text"
                          id={`shortCode-${folder.id}`}
                          className="form-control form-control-sm"
                          value={newItemShortCode}
                          onChange={(e) => setNewItemShortCode(e.target.value)}
                          placeholder="abc123"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={() => handleAddItemToFolder(folder.id)}
                        disabled={isLoading}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setAddingToFolder(null);
                          setNewItemShortCode('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <small className="text-muted">
                      Enter the short code of an existing URL from this Shlink server.
                    </small>
                  </div>
                )}

                {/* Folder Items */}
                {expandedFolders.has(folder.id) && folder.items.length > 0 && (
                  <div className="p-3 border-top">
                    <Table
                      header={
                        <Table.Row>
                          <Table.Cell>Short Code</Table.Cell>
                          <Table.Cell>Short URL</Table.Cell>
                          <Table.Cell>Added</Table.Cell>
                          <Table.Cell>Actions</Table.Cell>
                        </Table.Row>
                      }
                    >
                      {folder.items.map((item) => (
                        <Table.Row key={item.shortUrlId}>
                          <Table.Cell>
                            <code className="bg-light px-2 py-1 rounded">{item.shortCode}</code>
                          </Table.Cell>
                          <Table.Cell>
                            <a
                              href={`${serverBaseUrl}/${item.shortCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-decoration-none"
                            >
                              {serverBaseUrl}/{item.shortCode}
                            </a>
                          </Table.Cell>
                          <Table.Cell className="text-nowrap">
                            {formatDate(item.addedAt)}
                          </Table.Cell>
                          <Table.Cell>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleRemoveItem(folder.id, item.shortUrlId)}
                              title="Remove from folder"
                              disabled={isLoading}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table>
                  </div>
                )}

                {/* Empty Folder Message */}
                {expandedFolders.has(folder.id) && folder.items.length === 0 && (
                  <div className="p-3 border-top text-muted text-center">
                    <p className="mb-2">No URLs in this folder.</p>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        setAddingToFolder(folder.id);
                        setNewItemShortCode('');
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} className="me-1" />
                      Add URL
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
          <Link to={`/server/${serverId}`} className="btn btn-outline-secondary">
            &larr; Back to Server
          </Link>
          {folders.length > 0 && (
            <small className="text-muted">
              {folders.length} folder{folders.length !== 1 ? 's' : ''} &bull; {totalItems} URL{totalItems !== 1 ? 's' : ''} organized
            </small>
          )}
        </div>
      </SimpleCard>
    </main>
  );
}
