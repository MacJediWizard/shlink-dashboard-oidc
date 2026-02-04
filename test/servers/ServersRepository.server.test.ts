import { fromPartial } from '@total-typescript/shoehorn';
import type { EntityManager } from '@mikro-orm/core';
import type { Server } from '../../app/entities/Server';
import type { User } from '../../app/entities/User';
import { ServersRepository } from '../../app/servers/ServersRepository.server';
import { NotFoundError } from '../../app/validation/NotFoundError.server';
import { ValidationError } from '../../app/validation/ValidationError.server';

describe('ServersRepository', () => {
  const findOne = vi.fn();
  const find = vi.fn();
  const create = vi.fn();
  const persist = vi.fn().mockReturnValue({ flush: vi.fn() });
  const flush = vi.fn();
  const nativeDelete = vi.fn();

  const em = fromPartial<EntityManager>({
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    persist,
    flush,
  });

  let repo: ServersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = fromPartial<ServersRepository>({
      findOne,
      find,
      create,
      em,
      nativeDelete,
    });
    // Bind the actual methods to the mocked repo
    Object.assign(repo, {
      findByPublicIdAndUserId: ServersRepository.prototype.findByPublicIdAndUserId.bind(repo),
      findByUserId: ServersRepository.prototype.findByUserId.bind(repo),
      createServer: ServersRepository.prototype.createServer.bind(repo),
      updateServer: ServersRepository.prototype.updateServer.bind(repo),
      setServersForUser: ServersRepository.prototype.setServersForUser.bind(repo),
    });
  });

  describe('findByPublicIdAndUserId', () => {
    it('returns server when found', async () => {
      const server = fromPartial<Server>({ publicId: 'server-1', name: 'Test Server' });
      findOne.mockResolvedValue(server);

      const result = await repo.findByPublicIdAndUserId('server-1', 'user-1');

      expect(result).toEqual(server);
      expect(findOne).toHaveBeenCalledWith({
        publicId: 'server-1',
        users: { publicId: 'user-1' },
      });
    });

    it('returns null when server not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await repo.findByPublicIdAndUserId('server-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('returns servers for user', async () => {
      const servers = [
        fromPartial<Server>({ publicId: 'server-1', name: 'Server A' }),
        fromPartial<Server>({ publicId: 'server-2', name: 'Server B' }),
      ];
      find.mockResolvedValue(servers);

      const result = await repo.findByUserId('user-1');

      expect(result).toEqual(servers);
      expect(find).toHaveBeenCalledWith(
        { users: { publicId: 'user-1' } },
        expect.objectContaining({ orderBy: { name: 'ASC' } }),
      );
    });

    it('applies search term when provided', async () => {
      find.mockResolvedValue([]);

      await repo.findByUserId('user-1', { searchTerm: 'test' });

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          '$or': expect.any(Array),
        }),
        expect.any(Object),
      );
    });

    it('applies pagination when provided', async () => {
      find.mockResolvedValue([]);

      await repo.findByUserId('user-1', { limit: 10, offset: 20 });

      expect(find).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 10, offset: 20 }),
      );
    });

    it('populates users when requested', async () => {
      find.mockResolvedValue([]);

      await repo.findByUserId('user-1', { populateUsers: true });

      expect(find).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ populate: ['users'] }),
      );
    });
  });

  describe('createServer', () => {
    it('creates server and assigns to user', async () => {
      const user = fromPartial<User>({ publicId: 'user-1' });
      const serverData = { name: 'New Server', baseUrl: 'https://example.com', apiKey: 'key' };
      const newServer = fromPartial<Server>({
        ...serverData,
        publicId: 'new-server-id',
        users: { add: vi.fn() },
      });

      (em.findOneOrFail as ReturnType<typeof vi.fn>).mockResolvedValue(user);
      create.mockReturnValue(newServer);

      const result = await repo.createServer('user-1', serverData);

      expect(em.findOneOrFail).toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Server',
        baseUrl: 'https://example.com',
        apiKey: 'key',
        publicId: expect.any(String),
      }));
      expect(newServer.users.add).toHaveBeenCalledWith(user);
      expect(persist).toHaveBeenCalledWith(newServer);
      expect(result).toEqual(newServer);
    });
  });

  describe('updateServer', () => {
    it('returns null when server not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await repo.updateServer('server-1', 'user-1', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('updates server fields', async () => {
      const server = fromPartial<Server>({
        publicId: 'server-1',
        name: 'Old Name',
        baseUrl: 'https://old.com',
        apiKey: 'old-key',
      });
      findOne.mockResolvedValue(server);

      const result = await repo.updateServer('server-1', 'user-1', {
        name: 'New Name',
        baseUrl: 'https://new.com',
        apiKey: 'new-key',
      });

      expect(result?.name).toBe('New Name');
      expect(result?.baseUrl).toBe('https://new.com');
      expect(result?.apiKey).toBe('new-key');
      expect(em.flush).toHaveBeenCalled();
    });

    it('preserves existing values when not provided', async () => {
      const server = fromPartial<Server>({
        publicId: 'server-1',
        name: 'Keep This',
        baseUrl: 'https://keep.com',
        apiKey: 'keep-key',
      });
      findOne.mockResolvedValue(server);

      const result = await repo.updateServer('server-1', 'user-1', {});

      expect(result?.name).toBe('Keep This');
      expect(result?.baseUrl).toBe('https://keep.com');
      expect(result?.apiKey).toBe('keep-key');
    });
  });

  describe('setServersForUser', () => {
    it('throws NotFoundError when user not found', async () => {
      (em.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(repo.setServersForUser('user-1', { servers: [] }))
        .rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when user is not managed-user', async () => {
      const user = fromPartial<User>({
        publicId: 'user-1',
        role: 'admin',
        servers: { removeAll: vi.fn() },
      });
      (em.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(user);

      await expect(repo.setServersForUser('user-1', { servers: [] }))
        .rejects.toThrow(ValidationError);
    });

    it('sets servers for managed user', async () => {
      const removeAll = vi.fn();
      const add = vi.fn();
      const user = fromPartial<User>({
        publicId: 'user-1',
        role: 'managed-user',
        servers: { removeAll, add },
      });
      const servers = [
        fromPartial<Server>({ publicId: 'server-1' }),
        fromPartial<Server>({ publicId: 'server-2' }),
      ];

      (em.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(user);
      find.mockResolvedValue(servers);

      await repo.setServersForUser('user-1', { servers: ['server-1', 'server-2'] });

      expect(removeAll).toHaveBeenCalled();
      expect(add).toHaveBeenCalledTimes(2);
      expect(em.flush).toHaveBeenCalled();
    });

    it('handles empty server list', async () => {
      const removeAll = vi.fn();
      const user = fromPartial<User>({
        publicId: 'user-1',
        role: 'managed-user',
        servers: { removeAll, add: vi.fn() },
      });

      (em.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(user);

      await repo.setServersForUser('user-1', { servers: [] });

      expect(removeAll).toHaveBeenCalled();
      expect(find).not.toHaveBeenCalled();
      expect(em.flush).toHaveBeenCalled();
    });
  });
});
