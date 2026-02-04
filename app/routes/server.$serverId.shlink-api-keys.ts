import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { ApiKeyRegistryService } from '../api-keys/ApiKeyRegistryService.server';
import { ShlinkApiKeyService } from '../api-keys/ShlinkApiKeyService.server';
import { serverContainer } from '../container/container.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';
import { ServersService } from '../servers/ServersService.server';

export const middleware = [authMiddleware];

export async function loader(
  { params, context }: LoaderFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  shlinkApiKeyService: ShlinkApiKeyService = serverContainer[ShlinkApiKeyService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  try {
    const server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
    const apiKeys = await shlinkApiKeyService.listApiKeys(server);

    return Response.json({
      apiKeys: apiKeys.map((key) => ({
        key: key.key,
        name: key.name,
        expirationDate: key.expirationDate,
        roles: key.roles,
        keyHint: key.key.slice(-4), // Last 4 characters for identification
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch API keys' },
      { status: 500 },
    );
  }
}

export async function action(
  { request, params, context }: ActionFunctionArgs,
  serversService: ServersService = serverContainer[ServersService.name],
  shlinkApiKeyService: ShlinkApiKeyService = serverContainer[ShlinkApiKeyService.name],
  apiKeyRegistryService: ApiKeyRegistryService = serverContainer[ApiKeyRegistryService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const data = await request.json();
  const { action: actionType } = data;

  let server;
  try {
    server = await serversService.getByPublicIdAndUser(serverId, session.publicId);
  } catch {
    return Response.json({ error: 'Server not found' }, { status: 404 });
  }

  switch (actionType) {
    case 'create': {
      const { name, expirationDate, roles, registerInDashboard, service, tags, notes } = data;

      try {
        // Create the API key in Shlink
        const shlinkApiKey = await shlinkApiKeyService.createApiKey(server, {
          name,
          expirationDate,
          roles,
        });

        let registryEntry = null;

        // Optionally register in our local registry
        if (registerInDashboard) {
          registryEntry = await apiKeyRegistryService.createApiKey(
            session.publicId,
            serverId,
            {
              name: name ?? `Generated ${new Date().toISOString()}`,
              description: 'Generated via dashboard',
              keyHint: shlinkApiKey.key.slice(-4),
              service: service ?? 'dashboard',
              tags: tags ?? [],
              expiresAt: expirationDate ? new Date(expirationDate) : undefined,
              notes,
            },
          );
        }

        return Response.json({
          success: true,
          apiKey: {
            key: shlinkApiKey.key, // Full key - only shown once
            name: shlinkApiKey.name,
            expirationDate: shlinkApiKey.expirationDate,
            roles: shlinkApiKey.roles,
          },
          registryEntry: registryEntry
            ? {
              id: registryEntry.id,
              name: registryEntry.name,
              keyHint: registryEntry.keyHint,
              service: registryEntry.service,
            }
            : null,
        });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to create API key' },
          { status: 500 },
        );
      }
    }

    case 'delete': {
      const { apiKey } = data;
      if (!apiKey) {
        return Response.json({ error: 'API key required' }, { status: 400 });
      }

      try {
        const deleted = await shlinkApiKeyService.deleteApiKey(server, apiKey);
        if (!deleted) {
          return Response.json({ error: 'API key not found' }, { status: 404 });
        }
        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to delete API key' },
          { status: 500 },
        );
      }
    }

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
}
