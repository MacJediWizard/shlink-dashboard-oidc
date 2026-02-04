import { redirect } from 'react-router';

const mockCanManageLocalUsers = vi.fn();

// Mock env.server module with all required exports
vi.mock('../../../app/utils/env.server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../app/utils/env.server')>();
  return {
    ...actual,
    canManageLocalUsers: mockCanManageLocalUsers,
  };
});

describe('manage-users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('redirects to home when canManageLocalUsers returns false', async () => {
      mockCanManageLocalUsers.mockReturnValue(false);

      const { loader } = await import('../../../app/routes/users/manage-users');

      await expect(loader()).rejects.toEqual(redirect('/'));
    });

    it('returns null when canManageLocalUsers returns true', async () => {
      mockCanManageLocalUsers.mockReturnValue(true);

      const { loader } = await import('../../../app/routes/users/manage-users');
      const result = await loader();

      expect(result).toBeNull();
    });
  });
});
