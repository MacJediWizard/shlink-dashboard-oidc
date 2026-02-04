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
import { Button, LabelledInput, LabelledSelect, SimpleCard, Table } from '@shlinkio/shlink-frontend-kit';
import { clsx } from 'clsx';
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

// Badge component for status
function StatusBadge({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      className={clsx(
        'rounded-sm px-2 py-0.5 text-xs font-bold cursor-pointer border-0',
        active ? 'bg-green-600 text-white' : 'bg-gray-500 text-white',
      )}
      onClick={onClick}
      title={active ? 'Click to deactivate' : 'Click to activate'}
      disabled={disabled}
    >
      <FontAwesomeIcon icon={active ? faCheck : faTimes} className="mr-1" />
      {active ? 'Active' : 'Inactive'}
    </button>
  );
}

// Service badge
function ServiceBadge({ service }: { service: string }) {
  return (
    <span className="rounded-sm px-2 py-0.5 text-xs font-bold bg-blue-600 text-white">
      {service}
    </span>
  );
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

    setTimeout(async () => {
      revalidator.revalidate();
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
    <main className="container py-4 mx-auto flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <FontAwesomeIcon icon={faKey} />
          API Keys - {serverName}
        </h2>
      </div>

      {/* Quick Actions Card */}
      <SimpleCard title="Quick Actions" bodyClassName="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20 text-center">
            <FontAwesomeIcon icon={faServer} className="text-green-600 text-3xl mb-2" />
            <h3 className="font-bold mb-1">Generate New API Key</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Create a new API key directly on your Shlink server.
            </p>
            <Button
              onClick={() => {
                setActiveTab('shlink');
                setShowCreateShlinkForm(true);
              }}
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              Generate New Key
            </Button>
          </div>
          <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 text-center">
            <FontAwesomeIcon icon={faKey} className="text-blue-600 text-3xl mb-2" />
            <h3 className="font-bold mb-1">Register Existing Key</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Already have an API key? Register it to track usage.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setActiveTab('registry');
                setShowCreateForm(true);
              }}
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={faKey} className="mr-1" />
              Register Key
            </Button>
          </div>
        </div>
      </SimpleCard>

      {/* Expiring Keys Warning */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <strong>{expiringCount} API key{expiringCount > 1 ? 's' : ''}</strong>
          <span>expiring within 14 days!</span>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'registry' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('registry')}
        >
          <FontAwesomeIcon icon={faKey} className="mr-1" />
          Key Registry
          <span className="ml-2 rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs">
            {apiKeys.length}
          </span>
        </Button>
        <Button
          variant={activeTab === 'shlink' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('shlink')}
        >
          <FontAwesomeIcon icon={faServer} className="mr-1" />
          Shlink Server Keys
          <span className="ml-2 rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs">
            {shlinkApiKeys.length}
          </span>
        </Button>
      </div>

      {/* Registry Tab */}
      {activeTab === 'registry' && (
        <SimpleCard
          title="Key Registry"
          bodyClassName="flex flex-col gap-4"
        >
          <div className="flex justify-between items-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Track and manage your Shlink API keys. Register keys to monitor usage and expiration.
            </p>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} disabled={isLoading}>
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              Register Key
            </Button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faKey} />
                Register Existing API Key
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Register an existing Shlink API key to track its usage and expiration.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabelledInput
                  label="Name"
                  required
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                />
                <div>
                  <label htmlFor="keyHint" className="block text-sm font-medium mb-1">Key Hint *</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-l border border-r-0 border-gray-300 dark:border-gray-600">...</span>
                    <input
                      type="text"
                      id="keyHint"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r bg-white dark:bg-gray-800"
                      value={newKeyHint}
                      onChange={(e) => setNewKeyHint(e.target.value)}
                      placeholder="last 4-8 chars"
                      maxLength={8}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter the last 4-8 characters of your API key</p>
                </div>
                <LabelledSelect
                  label="Service"
                  value={newKeyService}
                  onChange={(e) => setNewKeyService(e.target.value)}
                >
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </LabelledSelect>
                <LabelledInput
                  label="Expiration Date"
                  type="date"
                  value={newKeyExpiresAt}
                  onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                />
                <LabelledInput
                  label="Description"
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  placeholder="What is this key used for?"
                />
                <LabelledInput
                  label="Notes"
                  value={newKeyNotes}
                  onChange={(e) => setNewKeyNotes(e.target.value)}
                  placeholder="Any additional notes..."
                />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCreateKey} disabled={isLoading}>
                  <FontAwesomeIcon icon={faPlus} className="mr-1" />
                  {isLoading ? 'Registering...' : 'Register Key'}
                </Button>
                <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Search */}
          {apiKeys.length > 0 && (
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                placeholder="Search keys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <FontAwesomeIcon icon={faKey} className="text-gray-400 text-5xl mb-4" />
              <h4 className="text-gray-600 dark:text-gray-400 mb-2">No API Keys Registered Yet</h4>
              <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
                Register your existing Shlink API keys to track their usage and expiration.
              </p>
              <Button onClick={() => setShowCreateForm(true)} disabled={isLoading}>
                <FontAwesomeIcon icon={faPlus} className="mr-1" />
                Register Your First Key
              </Button>
            </div>
          ) : filteredApiKeys.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No keys match your search.
            </div>
          ) : (
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
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                        <h6 className="font-bold mb-3">Edit API Key</h6>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <LabelledInput
                            label="Name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <LabelledSelect
                            label="Service"
                            value={editService}
                            onChange={(e) => setEditService(e.target.value)}
                          >
                            {SERVICE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </LabelledSelect>
                          <LabelledInput
                            label="Expires At"
                            type="date"
                            value={editExpiresAt}
                            onChange={(e) => setEditExpiresAt(e.target.value)}
                          />
                          <LabelledInput
                            label="Description"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                          />
                          <LabelledInput
                            label="Notes"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button onClick={() => handleUpdateKey(key.id)} disabled={isLoading}>
                            Save
                          </Button>
                          <Button variant="secondary" onClick={() => setEditingKey(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  <Table.Row key={key.id} className={isExpiring ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                    <Table.Cell>
                      <div>
                        <strong>{key.name}</strong>
                        {key.description && (
                          <div className="text-gray-500 text-sm">{key.description}</div>
                        )}
                        {key.notes && (
                          <div className="text-gray-500 text-sm italic mt-1">
                            Note: {key.notes}
                          </div>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <ServiceBadge service={key.service} />
                    </Table.Cell>
                    <Table.Cell>
                      <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">...{key.keyHint}</code>
                    </Table.Cell>
                    <Table.Cell>
                      {key.expiresAt ? (
                        <span className={daysUntil !== null && daysUntil <= 7 ? 'text-red-600 font-bold' : ''}>
                          {formatDate(key.expiresAt)}
                          {daysUntil !== null && daysUntil <= 14 && (
                            <div className="text-sm text-red-600">
                              ({daysUntil} day{daysUntil !== 1 ? 's' : ''} left)
                            </div>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">Never</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{formatDate(key.lastUsedAt)}</Table.Cell>
                    <Table.Cell>
                      <span className="rounded-sm px-2 py-0.5 text-xs font-bold bg-gray-500 text-white">
                        {key.usageCount}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge
                        active={key.isActive}
                        onClick={() => handleToggleActive(key.id, key.isActive)}
                        disabled={isLoading}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => handleRecordUsage(key.id)}
                          title="Record usage"
                          disabled={isLoading}
                        >
                          +1
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => startEditKey(key)}
                          title="Edit"
                          disabled={isLoading}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => handleDeleteKey(key.id)}
                          title="Delete from registry"
                          disabled={isLoading}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table>
          )}
        </SimpleCard>
      )}

      {/* Shlink API Keys Tab */}
      {activeTab === 'shlink' && (
        <SimpleCard
          title="Shlink Server Keys"
          bodyClassName="flex flex-col gap-4"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">Server API Keys</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Keys that exist directly on your Shlink server.
              </p>
            </div>
            <Button onClick={() => setShowCreateShlinkForm(!showCreateShlinkForm)} disabled={isLoading}>
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              Generate New API Key
            </Button>
          </div>

          {shlinkApiError && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              {shlinkApiError}
            </div>
          )}

          {/* Created Key Display */}
          {createdKey && (
            <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20">
              <h4 className="font-bold flex items-center gap-2 text-green-700 dark:text-green-300 mb-3">
                <FontAwesomeIcon icon={faCheck} />
                API Key Generated Successfully!
              </h4>
              <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded mb-3">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600" />
                <strong>Copy this key now!</strong> It will not be displayed again.
              </div>
              <label className="font-bold block mb-1">Your New API Key:</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 bg-gray-800 text-white font-mono rounded border border-gray-600"
                  value={createdKey}
                  readOnly
                />
                <Button onClick={() => copyToClipboard(createdKey)}>
                  <FontAwesomeIcon icon={faClipboard} className="mr-1" />
                  Copy
                </Button>
              </div>
              <Button variant="secondary" onClick={() => setCreatedKey(null)}>
                <FontAwesomeIcon icon={faTimes} className="mr-1" />
                Dismiss
              </Button>
            </div>
          )}

          {/* Create Shlink Key Form */}
          {showCreateShlinkForm && (
            <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faPlus} />
                Generate New Shlink API Key
              </h3>
              <div className="flex items-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 rounded mb-4">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-blue-600" />
                <strong>Important:</strong> The generated API key will only be displayed once!
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LabelledInput
                  label="Key Name (optional)"
                  value={shlinkKeyName}
                  onChange={(e) => setShlinkKeyName(e.target.value)}
                  placeholder="e.g., My Integration Key"
                />
                <LabelledInput
                  label="Expiration Date (optional)"
                  type="date"
                  value={shlinkKeyExpires}
                  onChange={(e) => setShlinkKeyExpires(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <input
                  type="checkbox"
                  id="registerInDashboard"
                  className="w-5 h-5"
                  checked={registerInDashboard}
                  onChange={(e) => setRegisterInDashboard(e.target.checked)}
                />
                <label htmlFor="registerInDashboard">
                  <strong>Also register in Key Registry</strong>
                  <span className="block text-sm text-gray-500">Track usage and get expiration reminders</span>
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCreateShlinkKey} disabled={isLoading}>
                  <FontAwesomeIcon icon={faPlus} className="mr-1" />
                  {isLoading ? 'Generating...' : 'Generate API Key'}
                </Button>
                <Button variant="secondary" onClick={() => setShowCreateShlinkForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!shlinkApiError && shlinkApiKeys.length === 0 ? (
            <div className="text-center py-8">
              <FontAwesomeIcon icon={faServer} className="text-gray-400 text-5xl mb-4" />
              <h4 className="text-gray-600 dark:text-gray-400 mb-2">No API Keys Found</h4>
              <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
                Your Shlink server doesn't have any API keys yet.
              </p>
              <Button onClick={() => setShowCreateShlinkForm(true)} disabled={isLoading}>
                <FontAwesomeIcon icon={faPlus} className="mr-1" />
                Generate Your First API Key
              </Button>
            </div>
          ) : !shlinkApiError && (
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
                    {key.name || <span className="text-gray-500 italic">Unnamed</span>}
                  </Table.Cell>
                  <Table.Cell>
                    <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                      ...{key.key.slice(-8)}
                    </code>
                    <button
                      type="button"
                      className="ml-2 text-blue-600 hover:text-blue-800"
                      onClick={() => copyToClipboard(key.key)}
                      title="Copy full key"
                    >
                      <FontAwesomeIcon icon={faClipboard} />
                    </button>
                  </Table.Cell>
                  <Table.Cell>
                    {key.expirationDate ? formatDate(key.expirationDate) : (
                      <span className="text-gray-500">Never</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {key.roles.length > 0 ? (
                      key.roles.map((role) => (
                        <span key={role} className="rounded-sm px-2 py-0.5 text-xs font-bold bg-gray-500 text-white mr-1">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-sm px-2 py-0.5 text-xs font-bold bg-green-600 text-white">Admin</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteShlinkKey(key.key)}
                      title="Delete from Shlink"
                      disabled={isLoading}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          )}
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
