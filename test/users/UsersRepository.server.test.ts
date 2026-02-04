import { fromPartial } from '@total-typescript/shoehorn';
import type { EntityManager } from '@mikro-orm/core';
import type { User } from '../../app/entities/User';
import { UsersRepository } from '../../app/users/UsersRepository.server';

describe('UsersRepository', () => {
  const findAndCount = vi.fn();
  const create = vi.fn();
  const persist = vi.fn().mockReturnValue({ flush: vi.fn() });
  const flush = vi.fn();

  const em = fromPartial<EntityManager>({
    persist,
    flush,
  });

  let repo: UsersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = fromPartial<UsersRepository>({
      findAndCount,
      create,
      em,
    });
    // Bind the actual methods to the mocked repo
    Object.assign(repo, {
      findAndCountUsers: UsersRepository.prototype.findAndCountUsers.bind(repo),
      createUser: UsersRepository.prototype.createUser.bind(repo),
      createOidcUser: UsersRepository.prototype.createOidcUser.bind(repo),
    });
  });

  describe('findAndCountUsers', () => {
    it('returns users with default ordering', async () => {
      const users = [
        fromPartial<User>({ publicId: 'user-1', username: 'alice' }),
        fromPartial<User>({ publicId: 'user-2', username: 'bob' }),
      ];
      findAndCount.mockResolvedValue([users, 2]);

      const result = await repo.findAndCountUsers({ limit: 20, offset: 0 });

      expect(result).toEqual([users, 2]);
      expect(findAndCount).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          limit: 20,
          offset: 0,
          orderBy: { createdAt: 'DESC' },
        }),
      );
    });

    it('applies search term when provided', async () => {
      findAndCount.mockResolvedValue([[], 0]);

      await repo.findAndCountUsers({ limit: 20, offset: 0, searchTerm: 'test' });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          '$or': expect.any(Array),
        }),
        expect.any(Object),
      );
    });

    it('applies custom ordering when provided', async () => {
      findAndCount.mockResolvedValue([[], 0]);

      await repo.findAndCountUsers({
        limit: 20,
        offset: 0,
        orderBy: { field: 'username', dir: 'ASC' },
      });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          orderBy: { username: 'ASC' },
        }),
      );
    });
  });

  describe('createUser', () => {
    it('creates user with temporary password flag', async () => {
      const userData = {
        username: 'newuser',
        displayName: 'New User',
        role: 'managed-user' as const,
        tempPassword: 'hashed-password',
      };
      const newUser = fromPartial<User>({
        ...userData,
        publicId: 'new-user-id',
        tempPassword: true,
      });

      create.mockReturnValue(newUser);

      const result = await repo.createUser(userData);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'newuser',
        displayName: 'New User',
        role: 'managed-user',
        password: 'hashed-password',
        tempPassword: true,
        createdAt: expect.any(Date),
        publicId: expect.any(String),
      }));
      expect(persist).toHaveBeenCalledWith(newUser);
      expect(result).toEqual(newUser);
    });
  });

  describe('createOidcUser', () => {
    it('creates user from OIDC claims without temporary password', async () => {
      const userData = {
        username: 'oidcuser',
        displayName: 'OIDC User',
        role: 'managed-user' as const,
        oidcSubject: 'oidc-sub-123',
        password: 'hashed-random-password',
      };
      const newUser = fromPartial<User>({
        ...userData,
        publicId: 'new-user-id',
        tempPassword: false,
      });

      create.mockReturnValue(newUser);

      const result = await repo.createOidcUser(userData);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'oidcuser',
        displayName: 'OIDC User',
        role: 'managed-user',
        oidcSubject: 'oidc-sub-123',
        password: 'hashed-random-password',
        tempPassword: false,
        createdAt: expect.any(Date),
        publicId: expect.any(String),
      }));
      expect(persist).toHaveBeenCalledWith(newUser);
      expect(result).toEqual(newUser);
    });

    it('creates user with null displayName', async () => {
      const userData = {
        username: 'oidcuser',
        displayName: null,
        role: 'admin' as const,
        oidcSubject: 'oidc-sub-456',
        password: 'hashed-password',
      };
      const newUser = fromPartial<User>({
        ...userData,
        publicId: 'new-user-id',
        tempPassword: false,
      });

      create.mockReturnValue(newUser);

      const result = await repo.createOidcUser(userData);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        displayName: null,
      }));
      expect(result).toEqual(newUser);
    });
  });
});
