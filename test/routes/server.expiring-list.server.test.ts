import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { loader } from '../../app/routes/server.$serverId.expiring-list';

describe('server.$serverId.expiring-list', () => {
  describe('loader', () => {
    it('throws 400 when serverId is missing', () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
      });

      expect(() => loader(args)).toThrow();
    });

    it('redirects to expiring page', () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
      });

      const result = loader(args);

      expect(result).toEqual(redirect('/server/server-1/expiring'));
    });
  });
});
