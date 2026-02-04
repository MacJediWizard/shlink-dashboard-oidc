import {
  faCheck,
  faClipboard,
  faEdit,
  faExclamationTriangle,
  faKey,
  faPlus,
  faServer,
  faTimes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import { useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useFetcher, useRevalidator } from 'react-router';
import { ApiKeyRegistryService } from '../api-keys/ApiKeyRegistryService.server';
import { ShlinkApiKeyService } from '../api-keys/ShlinkApiKeyService.server';
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

interface ShlinkApiKey {
  key: string;
  name: string | null;
  expirationDate: string | null;
  roles: string[];
}

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  apiKeyService: ApiKeyRegistryService = serverContainer[ApiKeyRegistryService.name],
  shlinkApiKeyService: ShlinkApiKeyService = serverContainer[ShlinkApiKeyService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }

  const server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
  const apiKeys = await apiKeyService.getApiKeys(session.publicId, serverId);
  const expiringKeys = await apiKeyService.getExpiringSoon(session.publicId, serverId, 14);

  // Try to fetch Shlink API keys, but don't fail if it errors
  let shlinkApiKeys: ShlinkApiKey[] = [];
  let shlinkApiError: string | null = null;
  try {
    shlinkApiKeys = await shlinkApiKeyService.listApiKeys(server);
  } catch (error: any) {
    shlinkApiError = error.message || 'Failed to fetch Shlink API keys';
  }

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
    expiringKeyIds: expiringKeys.map((k) => k.id),
    shlinkApiKeys,
    shlinkApiError,
  };
}

const SERVICE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'n8n', label: 'n8n' },
  { value: 'zapier', label: 'Zapier' },
  { value: 'home-assistant', label: 'Home Assistant' },
  { value: 'api-client', label: 'API Client' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'backup', label: 'Backup' },
  { value: 'custom', label: 'Custom/Other' },
];

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDaysUntilExpiration(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const now = new Date();
  const expDate = new Date(isoDate);
  return Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ApiKeysList({ loaderData }: RouteComponentProps<Route.ComponentProps>) {
  const {
    serverId,
    serverName,
    apiKeys,
    expiringKeyIds,
    shlinkApiKeys,
    shlinkApiError,
  } = loaderData as {
    serverId: string;
    serverName: string;
    apiKeys: ApiKey[];
    expiringKeyIds: number[];
    shlinkApiKeys: ShlinkApiKey[];
    shlinkApiError: string | null;
  };

  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [activeTab, setActiveTab] = useState<'registry' | 'shlink'>('registry');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateShlinkForm, setShowCreateShlinkForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Create registry key form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyHint, setNewKeyHint] = useState('');
  const [newKeyService, setNewKeyService] = useState('dashboard');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyNotes, setNewKeyNotes] = useState('');
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState('');

  // Create Shlink key form state
  const [shlinkKeyName, setShlinkKeyName] = useState('');
  const [shlinkKeyExpires, setShlinkKeyExpires] = useState('');
  const [registerInDashboard, setRegisterInDashboard] = useState(true);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Edit state
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editService, setEditService] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');

  const isLoading = fetcher.state !== 'idle';

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

  const handleCreateShlinkKey = async () => {
    fetcher.submit(
      {
        action: 'create',
        name: shlinkKeyName.trim() || undefined,
        expirationDate: shlinkKeyExpires || undefined,
        registerInDashboard,
        service: 'dashboard',
      },
      {
        method: 'POST',
        action: `/server/${serverId}/shlink-api-keys`,
        encType: 'application/json',
      },
    );

    // Handle response to show created key
    setTimeout(async () => {
      revalidator.revalidate();
      // Note: The actual key would need to be captured from the response
    }, 500);

    setShowCreateShlinkForm(false);
    setShlinkKeyName('');
    setShlinkKeyExpires('');
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
    if (!confirm('Delete this API key from the registry?')) return;

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

  const handleDeleteShlinkKey = async (apiKey: string) => {
    if (!confirm('Delete this API key from the Shlink server? This cannot be undone.')) return;

    fetcher.submit(
      { action: 'delete', apiKey },
      {
        method: 'POST',
        action: `/server/${serverId}/shlink-api-keys`,
        encType: 'application/json',
      },
    );
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const handleRecordUsage = async (keyId: number) => {
    fetcher.submit(
      { action: 'recordUsage', id: String(keyId) },
      {
        method: 'POST',
        action: `/server/${serverId}/api-keys`,
        encType: 'application/json',
      },
    );
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const startEditKey = (key: ApiKey) => {
    setEditingKey(key.id);
    setEditName(key.name);
    setEditDescription(key.description || '');
    setEditService(key.service);
    setEditNotes(key.notes || '');
    setEditExpiresAt(key.expiresAt ? key.expiresAt.split('T')[0] : '');
  };

  const handleUpdateKey = async (keyId: number) => {
    fetcher.submit(
      {
        action: 'update',
        id: String(keyId),
        name: editName.trim(),
        description: editDescription.trim() || null,
        service: editService,
        notes: editNotes.trim() || null,
        expiresAt: editExpiresAt || null,
      },
      {
        method: 'POST',
        action: `/server/${serverId}/api-keys`,
        encType: 'application/json',
      },
    );
    setEditingKey(null);
    setTimeout(() => revalidator.revalidate(), 500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const filteredApiKeys = apiKeys.filter((key) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      key.name.toLowerCase().includes(term) ||
      key.service.toLowerCase().includes(term) ||
      (key.description?.toLowerCase().includes(term) ?? false) ||
      (key.notes?.toLowerCase().includes(term) ?? false)
    );
  });

  const expiringCount = expiringKeyIds.length;

  return (
    <main className="container py-4 mx-auto">
      <SimpleCard>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="d-flex align-items-center gap-2 mb-0">
            <FontAwesomeIcon icon={faKey} />
            API Keys - {serverName}
          </h2>
        </div>

        {/* Expiring Keys Warning */}
        {expiringCount > 0 && (
          <div className="alert alert-warning d-flex align-items-center mb-4">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
            <strong>{expiringCount} API key{expiringCount > 1 ? 's' : ''}</strong>
            &nbsp;expiring within 14 days!
          </div>
        )}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'registry' ? 'active' : ''}`}
              onClick={() => setActiveTab('registry')}
            >
              <FontAwesomeIcon icon={faKey} className="me-1" />
              Key Registry ({apiKeys.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'shlink' ? 'active' : ''}`}
              onClick={() => setActiveTab('shlink')}
            >
              <FontAwesomeIcon icon={faServer} className="me-1" />
              Shlink API Keys ({shlinkApiKeys.length})
            </button>
          </li>
        </ul>

        {/* Registry Tab */}
        {activeTab === 'registry' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted mb-0">
                Track and manage your Shlink API keys. Register keys to monitor usage and expiration.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateForm(!showCreateForm)}
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faPlus} className="me-1" />
                Register Key
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <div className="card mb-4 p-3 bg-light">
                <h5 className="mb-3">Register API Key</h5>
                <p className="text-muted small mb-3">
                  Register an existing Shlink API key to track its usage and expiration.
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
                      disabled={isLoading}
                    >
                      {isLoading ? 'Registering...' : 'Register Key'}
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
            {apiKeys.length > 0 && (
              <div className="mb-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search keys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {apiKeys.length === 0 ? (
              <div className="text-center py-5">
                <FontAwesomeIcon icon={faKey} className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                <p className="text-muted mb-2">No API keys registered.</p>
                <p className="text-muted small">
                  Register your Shlink API keys to track their usage and get expiration warnings.
                </p>
              </div>
            ) : filteredApiKeys.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted">No keys match your search.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table
                  header={
                    <Table.Row>
                      <Table.Cell>Name</Table.Cell>
                      <Table.Cell>Service</Table.Cell>
                      <Table.Cell>Key Hint</Table.Cell>
                      <Table.Cell>Expires</Table.Cell>
                      <Table.Cell>Last Used</Table.Cell>
                      <Table.Cell>Usage</Table.Cell>
                      <Table.Cell>Status</Table.Cell>
                      <Table.Cell>Actions</Table.Cell>
                    </Table.Row>
                  }
                >
                  {filteredApiKeys.map((key) => {
                    const daysUntil = getDaysUntilExpiration(key.expiresAt);
                    const isExpiring = expiringKeyIds.includes(key.id);

                    return editingKey === key.id ? (
                      <Table.Row key={key.id}>
                        <Table.Cell colSpan={8}>
                          <div className="p-3 bg-light rounded">
                            <h6 className="mb-3">Edit API Key</h6>
                            <div className="row g-3">
                              <div className="col-md-4">
                                <label className="form-label small">Name</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small">Service</label>
                                <select
                                  className="form-select form-select-sm"
                                  value={editService}
                                  onChange={(e) => setEditService(e.target.value)}
                                >
                                  {SERVICE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small">Expires At</label>
                                <input
                                  type="date"
                                  className="form-control form-control-sm"
                                  value={editExpiresAt}
                                  onChange={(e) => setEditExpiresAt(e.target.value)}
                                />
                              </div>
                              <div className="col-12">
                                <label className="form-label small">Description</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                />
                              </div>
                              <div className="col-12">
                                <label className="form-label small">Notes</label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows={2}
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                />
                              </div>
                              <div className="col-12">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success me-2"
                                  onClick={() => handleUpdateKey(key.id)}
                                  disabled={isLoading}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => setEditingKey(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ) : (
                      <Table.Row key={key.id} className={isExpiring ? 'table-warning' : ''}>
                        <Table.Cell>
                          <div>
                            <strong>{key.name}</strong>
                            {key.description && (
                              <div className="text-muted small">{key.description}</div>
                            )}
                            {key.notes && (
                              <div className="text-muted small fst-italic mt-1">
                                Note: {key.notes}
                              </div>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="badge bg-primary">{key.service}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <code className="bg-light px-2 py-1 rounded">...{key.keyHint}</code>
                        </Table.Cell>
                        <Table.Cell>
                          {key.expiresAt ? (
                            <span className={daysUntil !== null && daysUntil <= 7 ? 'text-danger fw-bold' : ''}>
                              {formatDate(key.expiresAt)}
                              {daysUntil !== null && daysUntil <= 14 && (
                                <div className="small text-danger">
                                  ({daysUntil} day{daysUntil !== 1 ? 's' : ''} left)
                                </div>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted">Never</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>{formatDate(key.lastUsedAt)}</Table.Cell>
                        <Table.Cell>
                          <span className="badge bg-secondary">{key.usageCount}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <button
                            type="button"
                            className={`badge border-0 ${key.isActive ? 'bg-success' : 'bg-secondary'}`}
                            onClick={() => handleToggleActive(key.id, key.isActive)}
                            title={key.isActive ? 'Click to deactivate' : 'Click to activate'}
                            disabled={isLoading}
                          >
                            <FontAwesomeIcon icon={key.isActive ? faCheck : faTimes} className="me-1" />
                            {key.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleRecordUsage(key.id)}
                              title="Record usage"
                              disabled={isLoading}
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => startEditKey(key)}
                              title="Edit"
                              disabled={isLoading}
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteKey(key.id)}
                              title="Delete from registry"
                              disabled={isLoading}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table>
              </div>
            )}
          </>
        )}

        {/* Shlink API Keys Tab */}
        {activeTab === 'shlink' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted mb-0">
                API keys configured on the Shlink server. Create new keys or delete existing ones.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateShlinkForm(!showCreateShlinkForm)}
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faPlus} className="me-1" />
                Generate New Key
              </button>
            </div>

            {shlinkApiError && (
              <div className="alert alert-danger mb-4">
                <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
                {shlinkApiError}
              </div>
            )}

            {/* Created Key Display */}
            {createdKey && (
              <div className="alert alert-success mb-4">
                <h6 className="alert-heading">API Key Created!</h6>
                <p className="mb-2">Copy this key now - it won't be shown again:</p>
                <div className="d-flex gap-2 align-items-center">
                  <code className="bg-dark text-light p-2 rounded flex-grow-1">{createdKey}</code>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={() => copyToClipboard(createdKey)}
                  >
                    <FontAwesomeIcon icon={faClipboard} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success mt-2"
                  onClick={() => setCreatedKey(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Create Shlink Key Form */}
            {showCreateShlinkForm && (
              <div className="card mb-4 p-3 bg-light">
                <h5 className="mb-3">Generate New Shlink API Key</h5>
                <p className="text-muted small mb-3">
                  Create a new API key directly on the Shlink server. The key will only be shown once!
                </p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="shlinkKeyName" className="form-label">Name (optional)</label>
                    <input
                      type="text"
                      id="shlinkKeyName"
                      className="form-control"
                      value={shlinkKeyName}
                      onChange={(e) => setShlinkKeyName(e.target.value)}
                      placeholder="My new API key"
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="shlinkKeyExpires" className="form-label">Expires At (optional)</label>
                    <input
                      type="date"
                      id="shlinkKeyExpires"
                      className="form-control"
                      value={shlinkKeyExpires}
                      onChange={(e) => setShlinkKeyExpires(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        id="registerInDashboard"
                        className="form-check-input"
                        checked={registerInDashboard}
                        onChange={(e) => setRegisterInDashboard(e.target.checked)}
                      />
                      <label htmlFor="registerInDashboard" className="form-check-label">
                        Also register in dashboard key registry
                      </label>
                    </div>
                  </div>
                  <div className="col-12">
                    <button
                      type="button"
                      className="btn btn-success me-2"
                      onClick={handleCreateShlinkKey}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Generating...' : 'Generate Key'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowCreateShlinkForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!shlinkApiError && shlinkApiKeys.length === 0 ? (
              <div className="text-center py-5">
                <FontAwesomeIcon icon={faServer} className="text-muted mb-3" style={{ fontSize: '3rem' }} />
                <p className="text-muted mb-2">No API keys on the Shlink server.</p>
                <p className="text-muted small">
                  Generate a new API key to access the Shlink API.
                </p>
              </div>
            ) : !shlinkApiError && (
              <div className="table-responsive">
                <Table
                  header={
                    <Table.Row>
                      <Table.Cell>Name</Table.Cell>
                      <Table.Cell>Key</Table.Cell>
                      <Table.Cell>Expires</Table.Cell>
                      <Table.Cell>Roles</Table.Cell>
                      <Table.Cell>Actions</Table.Cell>
                    </Table.Row>
                  }
                >
                  {shlinkApiKeys.map((key) => (
                    <Table.Row key={key.key}>
                      <Table.Cell>
                        {key.name || <span className="text-muted fst-italic">Unnamed</span>}
                      </Table.Cell>
                      <Table.Cell>
                        <code className="bg-light px-2 py-1 rounded">
                          ...{key.key.slice(-8)}
                        </code>
                        <button
                          type="button"
                          className="btn btn-sm btn-link"
                          onClick={() => copyToClipboard(key.key)}
                          title="Copy full key"
                        >
                          <FontAwesomeIcon icon={faClipboard} />
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        {key.expirationDate ? formatDate(key.expirationDate) : (
                          <span className="text-muted">Never</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {key.roles.length > 0 ? (
                          key.roles.map((role) => (
                            <span key={role} className="badge bg-secondary me-1">{role}</span>
                          ))
                        ) : (
                          <span className="badge bg-success">Admin</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteShlinkKey(key.key)}
                          title="Delete from Shlink"
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
          </>
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
