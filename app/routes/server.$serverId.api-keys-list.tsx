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
  const [showQuickCreate, setShowQuickCreate] = useState(false);

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

        {/* Quick Actions Card - Primary Actions */}
        <div className="card border-primary mb-4">
          <div className="card-header bg-primary text-white d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faPlus} />
            <strong>Quick Actions</strong>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="card h-100 border-success">
                  <div className="card-body text-center">
                    <FontAwesomeIcon icon={faServer} className="text-success mb-2" style={{ fontSize: '2rem' }} />
                    <h5 className="card-title">Generate New API Key</h5>
                    <p className="card-text text-muted small">
                      Create a new API key directly on your Shlink server. The key will be generated and shown once.
                    </p>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => {
                        setShowQuickCreate(true);
                        setActiveTab('shlink');
                        setShowCreateShlinkForm(true);
                      }}
                      disabled={isLoading}
                    >
                      <FontAwesomeIcon icon={faPlus} className="me-1" />
                      Generate New Key
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <FontAwesomeIcon icon={faKey} className="text-primary mb-2" style={{ fontSize: '2rem' }} />
                    <h5 className="card-title">Register Existing Key</h5>
                    <p className="card-text text-muted small">
                      Already have an API key? Register it here to track usage, set expiration reminders, and add notes.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => {
                        setActiveTab('registry');
                        setShowCreateForm(true);
                      }}
                      disabled={isLoading}
                    >
                      <FontAwesomeIcon icon={faKey} className="me-1" />
                      Register Key
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expiring Keys Warning */}
        {expiringCount > 0 && (
          <div className="alert alert-warning d-flex align-items-center mb-4">
            <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
            <strong>{expiringCount} API key{expiringCount > 1 ? 's' : ''}</strong>
            &nbsp;expiring within 14 days!
          </div>
        )}

        {/* Tabs with descriptions */}
        <div className="card mb-4">
          <div className="card-header p-0">
            <ul className="nav nav-tabs card-header-tabs">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'registry' ? 'active' : ''}`}
                  onClick={() => setActiveTab('registry')}
                  style={{ borderRadius: '0.375rem 0 0 0' }}
                >
                  <FontAwesomeIcon icon={faKey} className="me-1" />
                  <strong>Key Registry</strong>
                  <span className="badge bg-secondary ms-2">{apiKeys.length}</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'shlink' ? 'active' : ''}`}
                  onClick={() => setActiveTab('shlink')}
                >
                  <FontAwesomeIcon icon={faServer} className="me-1" />
                  <strong>Shlink Server Keys</strong>
                  <span className="badge bg-secondary ms-2">{shlinkApiKeys.length}</span>
                </button>
              </li>
            </ul>
          </div>
          <div className="card-body p-2 bg-light">
            {activeTab === 'registry' ? (
              <small className="text-muted">
                <FontAwesomeIcon icon={faKey} className="me-1" />
                Track and manage your registered API keys. Monitor usage, set expiration alerts, and keep notes.
              </small>
            ) : (
              <small className="text-muted">
                <FontAwesomeIcon icon={faServer} className="me-1" />
                View and manage API keys directly on your Shlink server. Generate new keys or delete existing ones.
              </small>
            )}
          </div>
        </div>

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
              <div className="card mb-4 border-primary">
                <div className="card-header bg-primary text-white d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faKey} />
                  <strong>Register Existing API Key</strong>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-3">
                    Register an existing Shlink API key to track its usage, monitor expiration, and add notes for reference.
                  </p>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="keyName" className="form-label fw-bold">
                        Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        id="keyName"
                        className="form-control"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., Production API Key"
                      />
                      <small className="text-muted">A friendly name to identify this key</small>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="keyHint" className="form-label fw-bold">
                        Key Hint <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">...</span>
                        <input
                          type="text"
                          id="keyHint"
                          className="form-control"
                          value={newKeyHint}
                          onChange={(e) => setNewKeyHint(e.target.value)}
                          placeholder="last 4-8 chars"
                          maxLength={8}
                        />
                      </div>
                      <small className="text-muted">Enter the last 4-8 characters of your API key for identification</small>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="keyService" className="form-label fw-bold">Service / Integration</label>
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
                      <small className="text-muted">What service or integration uses this key?</small>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="keyExpires" className="form-label fw-bold">Expiration Date</label>
                      <input
                        type="date"
                        id="keyExpires"
                        className="form-control"
                        value={newKeyExpiresAt}
                        onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                      />
                      <small className="text-muted">Get reminded before this key expires</small>
                    </div>
                    <div className="col-12">
                      <label htmlFor="keyDescription" className="form-label fw-bold">Description</label>
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
                      <label htmlFor="keyNotes" className="form-label fw-bold">Notes</label>
                      <textarea
                        id="keyNotes"
                        className="form-control"
                        rows={2}
                        value={newKeyNotes}
                        onChange={(e) => setNewKeyNotes(e.target.value)}
                        placeholder="Any additional notes about this key..."
                      />
                    </div>
                    <div className="col-12 d-flex gap-2 pt-2">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleCreateKey}
                        disabled={isLoading}
                      >
                        <FontAwesomeIcon icon={faPlus} className="me-1" />
                        {isLoading ? 'Registering...' : 'Register Key'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
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
                <div className="mb-4">
                  <FontAwesomeIcon icon={faKey} className="text-muted" style={{ fontSize: '4rem' }} />
                </div>
                <h4 className="text-muted mb-3">No API Keys Registered Yet</h4>
                <p className="text-muted mb-4" style={{ maxWidth: '400px', margin: '0 auto' }}>
                  Register your existing Shlink API keys to track their usage, monitor expiration dates, and keep notes.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => setShowCreateForm(true)}
                  disabled={isLoading}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" />
                  Register Your First Key
                </button>
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
              <div>
                <p className="mb-1 fw-bold">Server API Keys</p>
                <p className="text-muted mb-0 small">
                  These keys exist on your Shlink server. Generate new keys or delete existing ones.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-success btn-lg"
                onClick={() => setShowCreateShlinkForm(!showCreateShlinkForm)}
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faPlus} className="me-1" />
                Generate New API Key
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
              <div className="card border-success mb-4">
                <div className="card-header bg-success text-white d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} />
                  <strong>API Key Generated Successfully!</strong>
                </div>
                <div className="card-body">
                  <div className="alert alert-warning d-flex align-items-start mb-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-2 mt-1 text-warning" />
                    <div>
                      <strong>Copy this key now!</strong> It will not be displayed again for security reasons.
                    </div>
                  </div>
                  <label className="form-label fw-bold">Your New API Key:</label>
                  <div className="input-group input-group-lg mb-3">
                    <input
                      type="text"
                      className="form-control bg-dark text-light font-monospace"
                      value={createdKey}
                      readOnly
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => copyToClipboard(createdKey)}
                    >
                      <FontAwesomeIcon icon={faClipboard} className="me-1" />
                      Copy
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setCreatedKey(null)}
                  >
                    <FontAwesomeIcon icon={faTimes} className="me-1" />
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Create Shlink Key Form */}
            {showCreateShlinkForm && (
              <div className="card mb-4 border-success">
                <div className="card-header bg-success text-white d-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faPlus} />
                  <strong>Generate New Shlink API Key</strong>
                </div>
                <div className="card-body">
                  <div className="alert alert-info d-flex align-items-start mb-3">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="me-2 mt-1" />
                    <div>
                      <strong>Important:</strong> The generated API key will only be displayed once! Make sure to copy it immediately after generation.
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="shlinkKeyName" className="form-label fw-bold">
                        Key Name <span className="text-muted fw-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        id="shlinkKeyName"
                        className="form-control form-control-lg"
                        value={shlinkKeyName}
                        onChange={(e) => setShlinkKeyName(e.target.value)}
                        placeholder="e.g., My Integration Key"
                      />
                      <small className="text-muted">Give your key a descriptive name to identify it later</small>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="shlinkKeyExpires" className="form-label fw-bold">
                        Expiration Date <span className="text-muted fw-normal">(optional)</span>
                      </label>
                      <input
                        type="date"
                        id="shlinkKeyExpires"
                        className="form-control form-control-lg"
                        value={shlinkKeyExpires}
                        onChange={(e) => setShlinkKeyExpires(e.target.value)}
                      />
                      <small className="text-muted">Leave blank for a key that never expires</small>
                    </div>
                    <div className="col-12">
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          id="registerInDashboard"
                          className="form-check-input"
                          checked={registerInDashboard}
                          onChange={(e) => setRegisterInDashboard(e.target.checked)}
                          style={{ width: '3em', height: '1.5em' }}
                        />
                        <label htmlFor="registerInDashboard" className="form-check-label ms-2">
                          <strong>Also register in Key Registry</strong>
                          <br />
                          <small className="text-muted">Track usage and get expiration reminders in the dashboard</small>
                        </label>
                      </div>
                    </div>
                    <div className="col-12 d-flex gap-2 pt-2">
                      <button
                        type="button"
                        className="btn btn-success btn-lg"
                        onClick={handleCreateShlinkKey}
                        disabled={isLoading}
                      >
                        <FontAwesomeIcon icon={faPlus} className="me-1" />
                        {isLoading ? 'Generating...' : 'Generate API Key'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-lg"
                        onClick={() => setShowCreateShlinkForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!shlinkApiError && shlinkApiKeys.length === 0 ? (
              <div className="text-center py-5">
                <div className="mb-4">
                  <FontAwesomeIcon icon={faServer} className="text-muted" style={{ fontSize: '4rem' }} />
                </div>
                <h4 className="text-muted mb-3">No API Keys Found</h4>
                <p className="text-muted mb-4" style={{ maxWidth: '400px', margin: '0 auto' }}>
                  Your Shlink server doesn't have any API keys yet. Generate a new key to start using the Shlink API.
                </p>
                <button
                  type="button"
                  className="btn btn-success btn-lg"
                  onClick={() => setShowCreateShlinkForm(true)}
                  disabled={isLoading}
                >
                  <FontAwesomeIcon icon={faPlus} className="me-1" />
                  Generate Your First API Key
                </button>
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
