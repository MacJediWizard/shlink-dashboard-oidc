import {
  faChevronDown,
  faChevronRight,
  faFolder,
  faPlus,
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

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="d-flex align-items-center gap-2 mb-0">
            <FontAwesomeIcon icon={faFolder} />
            Folders - {serverName}
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={isLoading}
          >
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            New Folder
          </button>
        </div>

        <p className="text-muted mb-4">
          Organize your short URLs into folders for easy management.
        </p>

        {/* Create Folder Form */}
        {showCreateForm && (
          <div className="card mb-4 p-3 bg-light">
            <h5 className="mb-3">Create New Folder</h5>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label htmlFor="folderName" className="form-label">Name *</label>
                <input
                  type="text"
                  id="folderName"
                  className="form-control"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My Folder"
                />
              </div>
              <div className="col-md-5">
                <label className="form-label">Color</label>
                <div className="d-flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="btn p-0"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: color,
                        border: newFolderColor === color ? '3px solid #000' : '2px solid #ccc',
                        borderRadius: 6,
                        transition: 'transform 0.1s',
                        transform: newFolderColor === color ? 'scale(1.1)' : 'scale(1)',
                      }}
                      onClick={() => setNewFolderColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div className="col-md-3">
                <button
                  type="button"
                  className="btn btn-success me-2"
                  onClick={handleCreateFolder}
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {folders.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-5">
            <FontAwesomeIcon icon={faFolder} className="text-muted mb-3" style={{ fontSize: '3rem' }} />
            <p className="text-muted mb-2">No folders yet.</p>
            <p className="text-muted small">
              Create folders to organize your short URLs into categories.
            </p>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted">No folders match your search.</p>
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
                          style={{ width: 150 }}
                          autoFocus
                        />
                        <div className="d-flex gap-1">
                          {FOLDER_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="btn p-0"
                              style={{
                                width: 18,
                                height: 18,
                                backgroundColor: color,
                                border: editColor === color ? '2px solid #000' : '1px solid #ccc',
                                borderRadius: 3,
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
                      <button
                        type="button"
                        className="btn btn-link p-0 text-dark text-start text-decoration-none fw-bold"
                        onClick={() => startEditFolder(folder)}
                        title="Click to edit"
                      >
                        {folder.name}
                      </button>
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

        <div className="mt-4">
          <Link to={`/server/${serverId}`} className="btn btn-secondary">
            Back to Server
          </Link>
        </div>
      </SimpleCard>
    </main>
  );
}
