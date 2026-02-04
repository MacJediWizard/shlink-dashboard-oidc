import { faChevronDown, faChevronRight, faFolder, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
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

export default function FoldersList({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, folders } = loaderData as {
    serverId: string;
    serverName: string;
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
    if (!confirm('Delete this folder? URLs inside will not be deleted.')) {
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

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex items-center gap-2 mb-0">
            <FontAwesomeIcon icon={faFolder} />
            Folders - {serverName}
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-1" />
            New Folder
          </button>
        </div>

        <p className="text-muted mb-4">
          Organize your short URLs into folders.
        </p>

        {showCreateForm && (
          <div className="card mb-4 p-3">
            <h5>Create New Folder</h5>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label htmlFor="folderName" className="form-label">Name</label>
                <input
                  type="text"
                  id="folderName"
                  className="form-control"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Color</label>
                <div className="d-flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="btn p-0"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: color,
                        border: newFolderColor === color ? '3px solid black' : '1px solid #ccc',
                        borderRadius: 4,
                      }}
                      onClick={() => setNewFolderColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div className="col-md-4">
                <button
                  type="button"
                  className="btn btn-success me-2"
                  onClick={handleCreateFolder}
                >
                  Create
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

        {folders.length === 0 ? (
          <div className="text-center py-8">
            <FontAwesomeIcon icon={faFolder} className="text-muted text-4xl mb-4" />
            <p className="text-muted">No folders yet.</p>
            <p className="text-muted text-sm">
              Create folders to organize your short URLs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map((folder) => (
              <div key={folder.id} className="border rounded">
                <div
                  className="p-3 d-flex align-items-center justify-content-between cursor-pointer"
                  style={{ backgroundColor: folder.color ? `${folder.color}15` : undefined }}
                >
                  <div className="d-flex align-items-center gap-2 flex-grow-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <FontAwesomeIcon
                        icon={expandedFolders.has(folder.id) ? faChevronDown : faChevronRight}
                      />
                    </button>
                    <span
                      className="d-inline-block rounded"
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: folder.color || '#6c757d',
                      }}
                    />
                    {editingFolder === folder.id ? (
                      <div className="d-flex gap-2 align-items-center">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: 150 }}
                        />
                        <div className="d-flex gap-1">
                          {FOLDER_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="btn p-0"
                              style={{
                                width: 16,
                                height: 16,
                                backgroundColor: color,
                                border: editColor === color ? '2px solid black' : '1px solid #ccc',
                                borderRadius: 2,
                              }}
                              onClick={() => setEditColor(color)}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          onClick={() => handleUpdateFolder(folder.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setEditingFolder(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-link p-0 text-dark text-start"
                        onClick={() => startEditFolder(folder)}
                      >
                        <strong>{folder.name}</strong>
                      </button>
                    )}
                    <span className="badge bg-secondary">{folder.itemCount} URLs</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDeleteFolder(folder.id)}
                    title="Delete folder"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>

                {expandedFolders.has(folder.id) && folder.items.length > 0 && (
                  <div className="p-3 border-top">
                    <Table
                      header={
                        <Table.Row>
                          <Table.Cell>Short Code</Table.Cell>
                          <Table.Cell>Added</Table.Cell>
                          <Table.Cell>Actions</Table.Cell>
                        </Table.Row>
                      }
                    >
                      {folder.items.map((item) => (
                        <Table.Row key={item.shortUrlId}>
                          <Table.Cell>
                            <code>{item.shortCode}</code>
                          </Table.Cell>
                          <Table.Cell>
                            {new Date(item.addedAt).toLocaleDateString()}
                          </Table.Cell>
                          <Table.Cell>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleRemoveItem(folder.id, item.shortUrlId)}
                              title="Remove from folder"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table>
                  </div>
                )}

                {expandedFolders.has(folder.id) && folder.items.length === 0 && (
                  <div className="p-3 border-top text-muted text-center">
                    No URLs in this folder.
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
