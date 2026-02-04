import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { ApiKeyRegistryService } from '../api-keys/ApiKeyRegistryService.server';
import { serverContainer } from '../container/container.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';

export const middleware = [authMiddleware];

export async function loader(
  { params, context }: LoaderFunctionArgs,
  apiKeyService: ApiKeyRegistryService = serverContainer[ApiKeyRegistryService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const apiKeys = await apiKeyService.getApiKeys(session.publicId, serverId);

  return Response.json({
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
  });
}

export async function action(
  { request, params, context }: ActionFunctionArgs,
  apiKeyService: ApiKeyRegistryService = serverContainer[ApiKeyRegistryService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const data = await request.json();
  const { action: actionType } = data;

  switch (actionType) {
    case 'create': {
      const { name, description, keyHint, service, tags, expiresAt, notes } = data;
      if (!name || !keyHint || !service) {
        return Response.json({ error: 'Name, key hint, and service are required' }, { status: 400 });
      }

      const apiKey = await apiKeyService.createApiKey(session.publicId, serverId, {
        name,
        description,
        keyHint,
        service,
        tags,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        notes,
      });

      return Response.json({
        success: true,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          description: apiKey.description,
          keyHint: apiKey.keyHint,
          service: apiKey.service,
          tags: apiKey.tags,
          expiresAt: apiKey.expiresAt?.toISOString() ?? null,
          lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
          usageCount: apiKey.usageCount,
          isActive: apiKey.isActive,
          notes: apiKey.notes,
          createdAt: apiKey.createdAt.toISOString(),
          updatedAt: apiKey.updatedAt.toISOString(),
        },
      });
    }

    case 'update': {
      const { id, name, description, service, tags, expiresAt, isActive, notes } = data;
      if (!id) {
        return Response.json({ error: 'API key ID required' }, { status: 400 });
      }

      const apiKey = await apiKeyService.updateApiKey(id, session.publicId, serverId, {
        name,
        description,
        service,
        tags,
        expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
        isActive,
        notes,
      });

      if (!apiKey) {
        return Response.json({ error: 'API key not found' }, { status: 404 });
      }

      return Response.json({
        success: true,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          description: apiKey.description,
          keyHint: apiKey.keyHint,
          service: apiKey.service,
          tags: apiKey.tags,
          expiresAt: apiKey.expiresAt?.toISOString() ?? null,
          lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
          usageCount: apiKey.usageCount,
          isActive: apiKey.isActive,
          notes: apiKey.notes,
          createdAt: apiKey.createdAt.toISOString(),
          updatedAt: apiKey.updatedAt.toISOString(),
        },
      });
    }

    case 'delete': {
      const { id } = data;
      if (!id) {
        return Response.json({ error: 'API key ID required' }, { status: 400 });
      }

      const deleted = await apiKeyService.deleteApiKey(id, session.publicId, serverId);
      if (!deleted) {
        return Response.json({ error: 'API key not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    case 'recordUsage': {
      const { id } = data;
      if (!id) {
        return Response.json({ error: 'API key ID required' }, { status: 400 });
      }

      const recorded = await apiKeyService.recordUsage(id, session.publicId, serverId);
      if (!recorded) {
        return Response.json({ error: 'API key not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    case 'getExpiringSoon': {
      const { daysAhead = 30 } = data;
      const expiring = await apiKeyService.getExpiringSoon(session.publicId, serverId, daysAhead);

      return Response.json({
        apiKeys: expiring.map((key) => ({
          id: key.id,
          name: key.name,
          keyHint: key.keyHint,
          service: key.service,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          isActive: key.isActive,
        })),
      });
    }

    case 'getByService': {
      const { service } = data;
      if (!service) {
        return Response.json({ error: 'Service required' }, { status: 400 });
      }

      const apiKeys = await apiKeyService.getByService(session.publicId, serverId, service);

      return Response.json({
        apiKeys: apiKeys.map((key) => ({
          id: key.id,
          name: key.name,
          keyHint: key.keyHint,
          service: key.service,
          isActive: key.isActive,
          createdAt: key.createdAt.toISOString(),
        })),
      });
    }

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
}
