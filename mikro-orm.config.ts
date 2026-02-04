import type { Options } from '@mikro-orm/core';
import { ApiKeyRegistry } from './app/entities/ApiKeyRegistry';
import { AuditLog } from './app/entities/AuditLog';
import { Favorite } from './app/entities/Favorite';
import { Folder, FolderItem } from './app/entities/Folder';
import { Server } from './app/entities/Server';
import { Settings } from './app/entities/Settings';
import { Tag } from './app/entities/Tag';
import { User } from './app/entities/User';
import { isProd } from './app/utils/env.server';
import baseConfig from './migrations.config';

const isProduction = isProd();

async function resolveOptions(): Promise<Options> {
  return {
    ...baseConfig,
    entities: [User, Settings, Server, Tag, AuditLog, Favorite, Folder, FolderItem, ApiKeyRegistry],
    debug: !isProduction,
  } satisfies Options;
}

export default await resolveOptions();
