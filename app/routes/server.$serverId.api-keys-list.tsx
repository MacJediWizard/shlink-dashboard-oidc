import { faCheck, faKey, faPlus, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useFetcher, useRevalidator } from 'react-router';
import { ApiKeyRegistryService } from '../api-keys/ApiKeyRegistryService.server';
import { serverContainer } from '../container/container.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';
import { ServersService } from '../servers/ServersService.server';
import type { Route } from './+types/server.$serverId.api-keys-list';
import type { RouteComponentProps } from './types';

export const middleware = [authMiddleware];

interface ApiKey {
  id: number;
  name: string;
  description: string | null;
  keyHint: string;
  service: string;
  tags: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  apiKeyService: ApiKeyRegistryService = serverContainer[ApiKeyRegistryService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }

  const server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
  const apiKeys = await apiKeyService.getApiKeys(session.publicId, serverId);

  return {
    serverId,
    serverName: server.name,
    apiKeys: apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      keyHint: key.keyHint,
      service: key.service,
      tags: key.tags,
      expiresAt: key.expiresAt?.toISOString() ?? null,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      usageCount: key.usageCount,
      isActive: key.isActive,
      notes: key.notes,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    })),
  };
}

const SERVICE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'n8n', label: 'n8n' },
  { value: 'zapier', label: 'Zapier' },
  { value: 'make', label: 'Make/Integromat' },
  { value: 'api', label: 'API Integration' },
  { value: 'other', label: 'Other' },
];

function formatDate(isoDate: string | null): string {
  if (!isoDate) {
    return '-';
  }
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ApiKeysList({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const { serverId, serverName, apiKeys } = loaderData as {
    serverId: string;
    serverName: string;
    apiKeys: ApiKey[];
  };

  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyHint, setNewKeyHint] = useState('');
  const [newKeyService, setNewKeyService] = useState('dashboard');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyNotes, setNewKeyNotes] = useState('');
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState('');

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !newKeyHint.trim()) {
      alert('Name and key hint are required');
      return;
    }

    fetcher.submit(
      {
        action: 'create',
        name: newKeyName.trim(),
        keyHint: newKeyHint.trim(),
        service: newKeyService,
        description: newKeyDescription.trim() || undefined,
        notes: newKeyNotes.trim() || undefined,
        expiresAt: newKeyExpiresAt || undefined,
      },
      {
        method: 'POST',
        action: `/server/${serverId}/api-keys`,
        encType: 'application/json',
      },
    );

    setShowCreateForm(false);
    setNewKeyName('');
    setNewKeyHint('');
    setNewKeyService('dashboard');
    setNewKeyDescription('');
    setNewKeyNotes('');
    setNewKeyExpiresAt('');
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleToggleActive = async (keyId: number, currentStatus: boolean) => {
    fetcher.submit(
      { action: 'update', id: String(keyId), isActive: !currentStatus },
      {
        method: 'POST',
        action: `/server/${serverId}/api-keys`,
        encType: 'application/json',
      },
    );

    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm('Delete this API key registry entry?')) {
      return;
    }

    fetcher.submit(
      { action: 'delete', id: String(keyId) },
      {
        method: 'POST',
        action: `/server/${serverId}/api-keys`,
        encType: 'application/json',
      },
    );

    setTimeout(() => revalidator.revalidate(), 500);
  };

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <div className="flex justify-between items-center mb-4">
          <h2 className="flex items-center gap-2 mb-0">
            <FontAwesomeIcon icon={faKey} />
            API Keys Registry - {serverName}
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-1" />
            Register Key
          </button>
        </div>

        <p className="text-muted mb-4">
          Track and manage your Shlink API keys. This registry helps you keep track of which keys
          are used where.
        </p>

        {showCreateForm && (
          <div className="card mb-4 p-3">
            <h5>Register API Key</h5>
            <p className="text-muted small">
              Register an existing Shlink API key to track its usage.
            </p>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="keyName" className="form-label">Name *</label>
                <input
                  type="text"
                  id="keyName"
                  className="form-control"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My API Key"
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="keyHint" className="form-label">Key Hint * (last 4 chars)</label>
                <input
                  type="text"
                  id="keyHint"
                  className="form-control"
                  value={newKeyHint}
                  onChange={(e) => setNewKeyHint(e.target.value)}
                  placeholder="abcd"
                  maxLength={8}
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="keyService" className="form-label">Service</label>
                <select
                  id="keyService"
                  className="form-select"
                  value={newKeyService}
                  onChange={(e) => setNewKeyService(e.target.value)}
                >
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label htmlFor="keyExpires" className="form-label">Expires At (optional)</label>
                <input
                  type="date"
                  id="keyExpires"
                  className="form-control"
                  value={newKeyExpiresAt}
                  onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                />
              </div>
              <div className="col-12">
                <label htmlFor="keyDescription" className="form-label">Description (optional)</label>
                <input
                  type="text"
                  id="keyDescription"
                  className="form-control"
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="What is this key used for?"
                />
              </div>
              <div className="col-12">
                <label htmlFor="keyNotes" className="form-label">Notes (optional)</label>
                <textarea
                  id="keyNotes"
                  className="form-control"
                  rows={2}
                  value={newKeyNotes}
                  onChange={(e) => setNewKeyNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="col-12">
                <button
                  type="button"
                  className="btn btn-success me-2"
                  onClick={handleCreateKey}
                >
                  Register Key
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

        {apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <FontAwesomeIcon icon={faKey} className="text-muted text-4xl mb-4" />
            <p className="text-muted">No API keys registered.</p>
            <p className="text-muted text-sm">
              Register your Shlink API keys to track their usage and manage them from here.
            </p>
          </div>
        ) : (
          <Table
            header={
              <Table.Row>
                <Table.Cell>Name</Table.Cell>
                <Table.Cell>Service</Table.Cell>
                <Table.Cell>Key Hint</Table.Cell>
                <Table.Cell>Last Used</Table.Cell>
                <Table.Cell>Usage</Table.Cell>
                <Table.Cell>Status</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            }
          >
            {apiKeys.map((key) => (
              <Table.Row key={key.id}>
                <Table.Cell>
                  <div>
                    <strong>{key.name}</strong>
                    {key.description && (
                      <div className="text-muted text-sm">{key.description}</div>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="badge bg-primary">{key.service}</span>
                </Table.Cell>
                <Table.Cell>
                  <code>...{key.keyHint}</code>
                </Table.Cell>
                <Table.Cell>{formatDate(key.lastUsedAt)}</Table.Cell>
                <Table.Cell>{key.usageCount}</Table.Cell>
                <Table.Cell>
                  <button
                    type="button"
                    className={`badge ${key.isActive ? 'bg-success' : 'bg-secondary'} border-0`}
                    onClick={() => handleToggleActive(key.id, key.isActive)}
                    title={key.isActive ? 'Click to deactivate' : 'Click to activate'}
                  >
                    <FontAwesomeIcon icon={key.isActive ? faCheck : faTimes} className="me-1" />
                    {key.isActive ? 'Active' : 'Inactive'}
                  </button>
                </Table.Cell>
                <Table.Cell>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDeleteKey(key.id)}
                    title="Delete from registry"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
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
