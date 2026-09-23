import { redirect } from 'react-router';
import type * as EnvServer from '../../../app/utils/env.server';

const mockCanManageLocalUsers = vi.fn();

// Mock env.server module with all required exports
vi.mock('../../../app/utils/env.server', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvServer>();
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
