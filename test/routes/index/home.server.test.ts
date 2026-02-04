import { fromPartial } from '@total-typescript/shoehorn';
import { redirect } from 'react-router';
import type { AuthHelper } from '../../../app/auth/auth-helper.server';
import type { SessionData } from '../../../app/auth/session-context';
import type { Server } from '../../../app/entities/Server';
import { loader } from '../../../app/routes/index/home';
import type { ServersService } from '../../../app/servers/ServersService.server';

describe('home', () => {
  describe('loader', () => {
    const getSession = vi.fn();
    const authHelper: AuthHelper = fromPartial({ getSession });
    const getUserServers = vi.fn();
    const serversService: ServersService = fromPartial({ getUserServers });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns list of servers', async () => {
      const sessionData: SessionData = fromPartial({ publicId: '1' });
      getSession.mockResolvedValue(sessionData);

      const servers: Server[] = [fromPartial({})];
      getUserServers.mockResolvedValue(servers);

      const request: Request = fromPartial({});
      const data = await loader(fromPartial({ request }), serversService, authHelper);

      expect(data.servers).toStrictEqual(servers);
      expect(getSession).toHaveBeenCalledWith(request, '/login');
      expect(getUserServers).toHaveBeenCalledWith(sessionData.publicId);
    });

    it('redirects to login if session is not set', async () => {
      getSession.mockImplementation(() => {
        throw redirect('/login');
      });

      const request: Request = fromPartial({});

      await expect(loader(fromPartial({ request }), serversService, authHelper)).rejects.toEqual(redirect('/login'));
      expect(getSession).toHaveBeenCalledWith(request, '/login');
      expect(getUserServers).not.toHaveBeenCalled();
    });
  });
});
