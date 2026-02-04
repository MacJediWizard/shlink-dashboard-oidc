import {
  faChevronDown,
  faChevronRight,
  faEdit,
  faFolder,
  faFolderOpen,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, LabelledInput, SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
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
    <main className="container py-4 mx-auto flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <FontAwesomeIcon icon={faFolder} className="text-blue-600" />
            Folders
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <strong>{serverName}</strong> &bull; {folders.length} folder{folders.length !== 1 ? 's' : ''} &bull; {totalItems} total URL{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} disabled={isLoading}>
          <FontAwesomeIcon icon={faPlus} className="mr-1" />
          New Folder
        </Button>
      </div>

      {/* Info Card */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <FontAwesomeIcon icon={faFolderOpen} className="text-blue-600 text-xl" />
        <span className="text-gray-600 dark:text-gray-400">
          Organize your short URLs into folders for better management.
        </span>
      </div>

      {/* Create Folder Form */}
      {showCreateForm && (
        <SimpleCard title="Create New Folder" bodyClassName="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabelledInput
              label="Folder Name"
              required
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g., Marketing Campaigns"
            />
            <div>
              <label className="block text-sm font-medium mb-2">Folder Color</label>
              <div className="flex gap-2 flex-wrap p-2 bg-gray-100 dark:bg-gray-800 rounded">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="p-0 border-0 cursor-pointer"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: color,
                      border: newFolderColor === color ? '3px solid #000' : '2px solid transparent',
                      borderRadius: 6,
                      transform: newFolderColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: newFolderColor === color ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setNewFolderColor(color)}
                    title={`Select ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Preview */}
          <div className="p-3 rounded" style={{ backgroundColor: `${newFolderColor}20`, borderLeft: `4px solid ${newFolderColor}` }}>
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded"
                style={{ width: 20, height: 20, backgroundColor: newFolderColor }}
              />
              <strong>{newFolderName || 'Folder Preview'}</strong>
              <span className="rounded-sm px-2 py-0.5 text-xs font-bold bg-gray-500 text-white">0 URLs</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateFolder} disabled={isLoading || !newFolderName.trim()}>
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              {isLoading ? 'Creating...' : 'Create Folder'}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
          </div>
        </SimpleCard>
      )}

      {/* Search */}
      {folders.length > 0 && (
        <div className="relative">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
            placeholder="Search folders by name or short code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      {folders.length === 0 ? (
        <SimpleCard bodyClassName="text-center py-8">
          <FontAwesomeIcon icon={faFolderOpen} className="text-blue-600 text-5xl mb-4" />
          <h4 className="text-gray-600 dark:text-gray-400 mb-2">No Folders Yet</h4>
          <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
            Start organizing your short URLs by creating folders.
          </p>
          <Button onClick={() => setShowCreateForm(true)} disabled={isLoading}>
            <FontAwesomeIcon icon={faPlus} className="mr-1" />
            Create Your First Folder
          </Button>
        </SimpleCard>
      ) : filteredFolders.length === 0 ? (
        <SimpleCard bodyClassName="text-center py-4">
          <p className="text-gray-500">No folders match your search.</p>
        </SimpleCard>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: folder.color || '#e5e7eb' }}
            >
              {/* Folder Header */}
              <div
                className="p-3 flex items-center justify-between"
                style={{
                  backgroundColor: folder.color ? `${folder.color}15` : '#f9fafb',
                  borderLeft: `4px solid ${folder.color || '#6b7280'}`,
                }}
              >
                <div className="flex items-center gap-2 flex-grow">
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <FontAwesomeIcon
                      icon={expandedFolders.has(folder.id) ? faChevronDown : faChevronRight}
                    />
                  </button>
                  <span
                    className="inline-block rounded"
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: folder.color || '#6b7280',
                      flexShrink: 0,
                    }}
                  />
                  {editingFolder === folder.id ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <input
                        type="text"
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ width: 160 }}
                        autoFocus
                      />
                      <div className="flex gap-1 p-1 bg-white dark:bg-gray-800 rounded">
                        {FOLDER_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className="p-0 border-0 cursor-pointer"
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: color,
                              border: editColor === color ? '2px solid #000' : '1px solid #e5e7eb',
                              borderRadius: 4,
                              transform: editColor === color ? 'scale(1.1)' : 'scale(1)',
                            }}
                            onClick={() => setEditColor(color)}
                          />
                        ))}
                      </div>
                      <Button onClick={() => handleUpdateFolder(folder.id)} disabled={isLoading}>
                        Save
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingFolder(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{folder.name}</span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => startEditFolder(folder)}
                        title="Edit folder name and color"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                    </div>
                  )}
                  <span className="rounded-sm px-2 py-0.5 text-xs font-bold bg-gray-500 text-white ml-2">
                    {folder.itemCount} URLs
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
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
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteFolder(folder.id)}
                    title="Delete folder"
                    disabled={isLoading}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                </div>
              </div>

              {/* Add Item Form */}
              {addingToFolder === folder.id && (
                <div className="p-3 border-t bg-gray-50 dark:bg-gray-800">
                  <h6 className="font-medium mb-2">Add URL to Folder</h6>
                  <div className="flex gap-2 items-end">
                    <div className="flex-grow">
                      <label htmlFor={`shortCode-${folder.id}`} className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Short Code *
                      </label>
                      <input
                        type="text"
                        id={`shortCode-${folder.id}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                        value={newItemShortCode}
                        onChange={(e) => setNewItemShortCode(e.target.value)}
                        placeholder="abc123"
                        autoFocus
                      />
                    </div>
                    <Button onClick={() => handleAddItemToFolder(folder.id)} disabled={isLoading}>
                      Add
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAddingToFolder(null);
                        setNewItemShortCode('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the short code of an existing URL from this Shlink server.
                  </p>
                </div>
              )}

              {/* Folder Items */}
              {expandedFolders.has(folder.id) && folder.items.length > 0 && (
                <div className="p-3 border-t">
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
                          <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">{item.shortCode}</code>
                        </Table.Cell>
                        <Table.Cell>
                          <a
                            href={`${serverBaseUrl}/${item.shortCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {serverBaseUrl}/{item.shortCode}
                          </a>
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          {formatDate(item.addedAt)}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            variant="danger"
                            onClick={() => handleRemoveItem(folder.id, item.shortUrlId)}
                            title="Remove from folder"
                            disabled={isLoading}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table>
                </div>
              )}

              {/* Empty Folder Message */}
              {expandedFolders.has(folder.id) && folder.items.length === 0 && (
                <div className="p-3 border-t text-gray-500 text-center">
                  <p className="mb-2">No URLs in this folder.</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAddingToFolder(folder.id);
                      setNewItemShortCode('');
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-1" />
                    Add URL
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
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
