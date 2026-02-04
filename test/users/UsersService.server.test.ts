import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { fromPartial } from '@total-typescript/shoehorn';
import { hashPassword, verifyPassword } from '../../app/auth/passwords.server';
import type { User } from '../../app/entities/User';
import { IncorrectPasswordError } from '../../app/users/IncorrectPasswordError.server';
import type { UsersRepository } from '../../app/users/UsersRepository.server';
import { UsersService } from '../../app/users/UsersService.server';
import { DuplicatedEntryError } from '../../app/validation/DuplicatedEntryError.server';
import { NotFoundError } from '../../app/validation/NotFoundError.server';
import { createFormData } from '../__helpers__/utils';

describe('UsersService', () => {
  const findOne = vi.fn();
  const findAndCountUsers = vi.fn();
  const createUser = vi.fn();
  const nativeDelete = vi.fn();
  const flush = vi.fn();
  let usersRepo: UsersRepository;
  let usersService: UsersService;

  beforeEach(() => {
    usersRepo = fromPartial<UsersRepository>({ findOne, findAndCountUsers, createUser, nativeDelete, flush });
    usersService = new UsersService(usersRepo);
  });

  describe('getUserByCredentials', () => {
    it('throws when user is not found', async () => {
      findOne.mockResolvedValue(null);

      await expect(usersService.getUserByCredentials('foo', 'bar')).rejects.toEqual(
        new NotFoundError('User not found with username foo'),
      );
      expect(findOne).toHaveBeenCalledWith({ username: 'foo' });
    });

    it('throws if password does not match', async () => {
      findOne.mockResolvedValue(fromPartial<User>({ password: await hashPassword('the right one') }));

      await expect(usersService.getUserByCredentials('foo', 'bar')).rejects.toEqual(
        new IncorrectPasswordError('foo'),
      );
      expect(findOne).toHaveBeenCalledWith({ username: 'foo' });
    });

    it('returns user if password is correct', async () => {
      const expectedUser = fromPartial<User>({ password: await hashPassword('bar') });
      findOne.mockResolvedValue(expectedUser);

      const result = await usersService.getUserByCredentials('foo', 'bar');

      expect(result).toEqual(expectedUser);
      expect(findOne).toHaveBeenCalledWith({ username: 'foo' });
    });
  });

  describe('getUserById', () => {
    it('throws if a user is not found', async () => {
      findOne.mockResolvedValue(null);

      await expect(usersService.getUserById('abc123')).rejects.toEqual(
        new NotFoundError('User not found with public id abc123'),
      );
      expect(findOne).toHaveBeenCalledWith({ publicId: 'abc123' });
    });

    it('returns found user', async () => {
      const expectedUser = fromPartial<User>({ publicId: 'abc123' });
      findOne.mockResolvedValue(expectedUser);

      const result = await usersService.getUserById('abc123');

      expect(result).toEqual(expectedUser);
      expect(findOne).toHaveBeenCalledWith({ publicId: 'abc123' });
    });
  });

  describe('listUsers', () => {
    it.each([
      {
        page: 1,
        expectedOffset: 0,
        totalUsers: 10,
        expectedTotalPages: 1,
      },
      {
        page: 2,
        expectedOffset: 20,
        totalUsers: 20,
        expectedTotalPages: 1,
      },
      {
        expectedOffset: 0,
        totalUsers: 21,
        expectedTotalPages: 2,
      },
      {
        page: 10,
        expectedOffset: 180,
        totalUsers: 100,
        expectedTotalPages: 5,
      },
      {
        expectedOffset: 0,
        totalUsers: 103,
        expectedTotalPages: 6,
      },
      {
        expectedOffset: 0,
        totalUsers: 119,
        expectedTotalPages: 6,
      },
    ])('returns users list and totals', async ({ totalUsers, page, expectedOffset, expectedTotalPages }) => {
      const users: User[] = [
        fromPartial({}),
        fromPartial({}),
        fromPartial({}),
      ];
      findAndCountUsers.mockResolvedValue([users, totalUsers]);

      const result = await usersService.listUsers({ page });

      expect(findAndCountUsers).toHaveBeenCalledWith(expect.objectContaining({
        offset: expectedOffset,
      }));
      expect(result.users).toEqual(users);
      expect(result.totalUsers).toEqual(totalUsers);
      expect(result.totalPages).toEqual(expectedTotalPages);
    });
  });

  describe('createUser', () => {
    it.each([
      {
        data: {},
        expectedFields: {
          username: 'Invalid input: expected string, received undefined',
          role: 'Invalid option: expected one of "admin"|"advanced-user"|"managed-user"',
        },
      },
      {
        data: {
          username: 'foobar',
          role: 'invalid',
        },
        expectedFields: {
          role: 'Invalid option: expected one of "admin"|"advanced-user"|"managed-user"',
        },
      },
      {
        data: {
          role: 'admin',
        },
        expectedFields: {
          'username': 'Invalid input: expected string, received undefined',
        },
      },
    ])('throws error if provided data is invalid', async ({ data, expectedFields }) => {
      const formData = createFormData(data);

      await expect(usersService.createUser(formData)).rejects.toThrowError(expect.objectContaining({
        message: 'Provided data is invalid',
        invalidFields: expectedFields,
      }));
      expect(createUser).not.toHaveBeenCalled();
    });

    it('throws error if username is duplicated', async () => {
      createUser.mockRejectedValue(new UniqueConstraintViolationException(new Error('')));

      const formData = createFormData({
        username: 'username',
        role: 'managed-user',
      });

      await expect(usersService.createUser(formData)).rejects.toThrowError(new DuplicatedEntryError('username'));
    });

    it('re-throws unknown errors verbatim', async () => {
      const error = new Error('Something failed');
      createUser.mockRejectedValue(error);

      const formData = createFormData({
        username: 'username',
        role: 'managed-user',
      });

      await expect(usersService.createUser(formData)).rejects.toThrowError(error);
    });

    it('creates a user with a randomly generated password', async () => {
      createUser.mockImplementation(async (firstArg) => ({ ...firstArg, password: firstArg.tempPassword }));

      const data = {
        username: 'username',
        displayName: 'Display Name',
        role: 'admin',
      };
      const formData = createFormData(data);

      const [user, plainTextPassword] = await usersService.createUser(formData);

      expect(createUser).toHaveBeenCalledWith(expect.objectContaining(data));
      expect(await verifyPassword(plainTextPassword, user.password)).toEqual(true);
    });
  });

  describe('deleteUser', () => {
    it('deletes user via repository', async () => {
      await usersService.deleteUser('123');
      expect(nativeDelete).toHaveBeenCalledWith({ publicId: '123' });
    });
  });

  describe('editUser', () => {
    it.each([
      {
        providedData: createFormData({}),
        expectedResult: { displayName: 'initial_display_name', role: 'admin' },
      },
      {
        providedData: createFormData({ displayName: 'new one' }),
        expectedResult: { displayName: 'new one', role: 'admin' },
      },
      {
        providedData: createFormData({ role: 'advanced-user' }),
        expectedResult: { displayName: 'initial_display_name', role: 'advanced-user' },
      },
      {
        providedData: createFormData({ role: 'managed-user', displayName: 'another name' }),
        expectedResult: { displayName: 'another name', role: 'managed-user' },
      },
    ])('updates the user with provided data', async ({ providedData, expectedResult }) => {
      const expectedUser = fromPartial<User>(
        { publicId: 'abc123', displayName: 'initial_display_name', role: 'admin' },
      );
      findOne.mockResolvedValue(expectedUser);

      const user = await usersService.editUser('abc123', providedData);

      expect(user).toEqual(expect.objectContaining(expectedResult));
      expect(flush).toHaveBeenCalled();
    });

    it.each([
      {
        allowList: undefined,
        expectedNewDisplayName: 'new display name',
        expectedNewRole: 'managed-user',
      },
      {
        allowList: [],
        expectedNewDisplayName: 'new display name',
        expectedNewRole: 'managed-user',
      },
      {
        allowList: ['displayName' as const],
        expectedNewDisplayName: 'new display name',
        expectedNewRole: 'admin',
      },
      {
        allowList: ['role' as const],
        expectedNewDisplayName: 'initial_display_name',
        expectedNewRole: 'managed-user',
      },
      {
        allowList: ['role' as const, 'displayName' as const],
        expectedNewDisplayName: 'new display name',
        expectedNewRole: 'managed-user',
      },
    ])('skips props not defined in the allowlist', async ({ allowList, expectedNewDisplayName, expectedNewRole }) => {
      findOne.mockResolvedValue(fromPartial<User>({
        publicId: 'abc123',
        displayName: 'initial_display_name',
        role: 'admin',
      }));

      const newData = createFormData({ displayName: 'new display name', role: 'managed-user' });
      const user = await usersService.editUser('abc123', newData, allowList);

      expect(user.displayName).toEqual(expectedNewDisplayName);
      expect(user.role).toEqual(expectedNewRole);
    });
  });

  describe('resetPassword', () => {
    it('sets a new generated password for user', async () => {
      const expectedUser = fromPartial<User>({ publicId: 'abc123', password: 'old_password' });
      findOne.mockResolvedValue(expectedUser);

      const [user, newPassword] = await usersService.resetUserPassword('abc123');

      expect(user.publicId).toEqual(expectedUser.publicId);
      expect(user.tempPassword).toEqual(true);
      expect(await verifyPassword(newPassword, user.password)).toEqual(true);
      expect(flush).toHaveBeenCalled();
    });
  });

  describe('editUserPassword', () => {
    it.each([
      // Missing required fields
      {},
      // New passwords do not match length requirements
      {
        currentPassword: '1234',
        newPassword: 'abc123',
        repeatPassword: 'abc123',
      },
      // New passwords do not match pattern requirements
      {
        currentPassword: '1234',
        newPassword: 'Aa12345678',
        repeatPassword: 'Aa12345678',
      },
    ])('throws error if provided data is invalid', async (passwords) => {
      await expect(usersService.editUserPassword('abc123', createFormData(passwords))).rejects.toThrow(
        expect.objectContaining({ message: 'Provided data is invalid' }),
      );
      expect(findOne).not.toHaveBeenCalled();
      expect(flush).not.toHaveBeenCalled();
    });

    it('throws error if new passwords do not match', async () => {
      const passwords = {
        currentPassword: '1234',
        newPassword: 'Aa12345678!',
        repeatPassword: 'Bb12345678!',
      };

      await expect(usersService.editUserPassword('abc123', createFormData(passwords))).rejects.toThrow(
        expect.objectContaining({
          name: 'PasswordMismatchError',
          message: 'Passwords do not match',
        }),
      );
      expect(findOne).not.toHaveBeenCalled();
      expect(flush).not.toHaveBeenCalled();
    });

    it('throws error if current password does not match logged-in user', async () => {
      findOne.mockResolvedValue(fromPartial<User>({
        password: await hashPassword('old_password'),
      }));
      const passwords = {
        currentPassword: 'not_the_right_one',
        newPassword: 'Aa12345678!',
        repeatPassword: 'Aa12345678!',
      };

      await expect(usersService.editUserPassword('abc123', createFormData(passwords))).rejects.toThrow(
        expect.objectContaining({
          name: 'IncorrectPasswordError',
          message: 'Current password is invalid',
        }),
      );
      expect(findOne).toHaveBeenCalledWith({ publicId: 'abc123' });
      expect(flush).not.toHaveBeenCalled();
    });

    it('updates user password if provided data is correct', async () => {
      findOne.mockResolvedValue(fromPartial<User>({
        password: await hashPassword('old_password'),
      }));
      const passwords = {
        currentPassword: 'old_password',
        newPassword: 'Aa12345678!',
        repeatPassword: 'Aa12345678!',
      };

      const result = await usersService.editUserPassword('abc123', createFormData(passwords));

      expect(await verifyPassword('Aa12345678!', result.password)).toEqual(true);
      expect(findOne).toHaveBeenCalledWith({ publicId: 'abc123' });
      expect(flush).toHaveBeenCalled();
    });
  });

  describe('editUserTempPassword', () => {
    it('throws error if current password is not temporary', async () => {
      findOne.mockResolvedValue(fromPartial<User>({ tempPassword: false }));
      const passwords = {
        newPassword: 'Aa12345678!',
        repeatPassword: 'Aa12345678!',
      };

      await expect(usersService.editUserTempPassword('abc123', createFormData(passwords))).rejects.toThrow(
        expect.objectContaining({
          name: 'NoTempPasswordError',
          message: 'Current password is not temporary. Change your password from the profile',
        }),
      );
      expect(findOne).toHaveBeenCalledWith({ publicId: 'abc123' });
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe('findByOidcSubject', () => {
    it('returns user when found by OIDC subject', async () => {
      const expectedUser = fromPartial<User>({ publicId: 'abc123', oidcSubject: 'oidc-sub-123' });
      findOne.mockResolvedValue(expectedUser);

      const result = await usersService.findByOidcSubject('oidc-sub-123');

      expect(result).toEqual(expectedUser);
      expect(findOne).toHaveBeenCalledWith({ oidcSubject: 'oidc-sub-123' });
    });

    it('returns null when user not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await usersService.findByOidcSubject('oidc-sub-123');

      expect(result).toBeNull();
      expect(findOne).toHaveBeenCalledWith({ oidcSubject: 'oidc-sub-123' });
    });
  });

  describe('findOrCreateFromOidcClaims', () => {
    const createOidcUser = vi.fn();

    beforeEach(() => {
      usersRepo = fromPartial<UsersRepository>({
        findOne,
        findAndCountUsers,
        createUser,
        nativeDelete,
        flush,
        createOidcUser,
      });
      usersService = new UsersService(usersRepo);
    });

    it('returns existing user when found by OIDC subject', async () => {
      const existingUser = fromPartial<User>({
        publicId: 'abc123',
        oidcSubject: 'oidc-sub-123',
        role: 'managed-user', // Default role when OIDC config not set
      });
      findOne.mockResolvedValue(existingUser);

      const claims = { sub: 'oidc-sub-123', groups: [] };
      const result = await usersService.findOrCreateFromOidcClaims(claims);

      expect(result).toEqual(existingUser);
      expect(createOidcUser).not.toHaveBeenCalled();
    });

    it('updates role when existing user groups have changed', async () => {
      const existingUser = fromPartial<User>({
        publicId: 'abc123',
        oidcSubject: 'oidc-sub-123',
        role: 'admin', // User was admin before
      });
      findOne.mockResolvedValue(existingUser);

      // Without OIDC config, any groups map to managed-user
      const claims = { sub: 'oidc-sub-123', groups: ['users'] };
      const result = await usersService.findOrCreateFromOidcClaims(claims);

      expect(result.role).toEqual('managed-user');
      expect(flush).toHaveBeenCalled();
    });

    it('creates new user when not found by OIDC subject', async () => {
      findOne.mockResolvedValue(null);
      const newUser = fromPartial<User>({
        publicId: 'new-123',
        username: 'testuser',
        oidcSubject: 'oidc-sub-123',
        role: 'managed-user',
      });
      createOidcUser.mockResolvedValue(newUser);

      const claims = {
        sub: 'oidc-sub-123',
        preferred_username: 'testuser',
        name: 'Test User',
        groups: [],
      };
      const result = await usersService.findOrCreateFromOidcClaims(claims);

      expect(result).toEqual(newUser);
      expect(createOidcUser).toHaveBeenCalledWith(expect.objectContaining({
        username: 'testuser',
        displayName: 'Test User',
        role: 'managed-user',
        oidcSubject: 'oidc-sub-123',
      }));
    });

    it('falls back to email when preferred_username is not provided', async () => {
      findOne.mockResolvedValue(null);
      const newUser = fromPartial<User>({ publicId: 'new-123' });
      createOidcUser.mockResolvedValue(newUser);

      const claims = {
        sub: 'oidc-sub-123',
        email: 'test@example.com',
        groups: [],
      };
      await usersService.findOrCreateFromOidcClaims(claims);

      expect(createOidcUser).toHaveBeenCalledWith(expect.objectContaining({
        username: 'test@example.com',
      }));
    });

    it('falls back to sub when neither preferred_username nor email is provided', async () => {
      findOne.mockResolvedValue(null);
      const newUser = fromPartial<User>({ publicId: 'new-123' });
      createOidcUser.mockResolvedValue(newUser);

      const claims = {
        sub: 'oidc-sub-123',
        groups: [],
      };
      await usersService.findOrCreateFromOidcClaims(claims);

      expect(createOidcUser).toHaveBeenCalledWith(expect.objectContaining({
        username: 'oidc-sub-123',
      }));
    });

    it('handles username conflict by appending sub suffix', async () => {
      findOne.mockResolvedValue(null);
      const newUser = fromPartial<User>({ publicId: 'new-123' });
      createOidcUser
        .mockRejectedValueOnce(new UniqueConstraintViolationException(new Error('duplicate')))
        .mockResolvedValue(newUser);

      const claims = {
        sub: 'oidc-sub-123',
        preferred_username: 'existinguser',
        groups: [],
      };
      const result = await usersService.findOrCreateFromOidcClaims(claims);

      expect(result).toEqual(newUser);
      expect(createOidcUser).toHaveBeenCalledTimes(2);
      expect(createOidcUser).toHaveBeenLastCalledWith(expect.objectContaining({
        username: 'existinguser_oidc-sub',
      }));
    });

    it('re-throws non-unique-constraint errors', async () => {
      findOne.mockResolvedValue(null);
      const genericError = new Error('Database connection failed');
      createOidcUser.mockRejectedValue(genericError);

      const claims = {
        sub: 'oidc-sub-123',
        preferred_username: 'testuser',
        groups: [],
      };

      await expect(usersService.findOrCreateFromOidcClaims(claims)).rejects.toThrow('Database connection failed');
    });
  });
});
