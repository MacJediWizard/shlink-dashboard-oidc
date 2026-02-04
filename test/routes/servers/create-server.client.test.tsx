import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import CreateServer from '../../../app/routes/servers/create-server';
import { checkAccessibility } from '../../__helpers__/accessibility';
import { renderWithEvents } from '../../__helpers__/set-up-test';

describe('create-server', () => {
  describe('<CreateServer />', () => {
    const setUp = async () => {
      const path = '/manage-servers/create';
      const Stub = createRoutesStub([
        {
          path,
          Component: CreateServer,
          HydrateFallback: () => null,
          action: () => ({}),
        },
      ]);

      const result = renderWithEvents(<Stub initialEntries={[path]} />);
      await screen.findByText('Add new server');

      return result;
    };

    it('passes a11y checks', () => checkAccessibility(setUp()));

    it('renders form', async () => {
      await setUp();

      expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^URL/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^API key/)).toBeInTheDocument();
    });

    it('disables form while saving', async () => {
      const { user } = await setUp();

      await user.type(screen.getByLabelText(/^Name/), 'The name');
      await user.type(screen.getByLabelText(/^URL/), 'https://example.com');
      await user.type(screen.getByLabelText(/^API key/), 'test-api-key');
      const submitPromise = user.click(screen.getByRole('button', { name: 'Create server' }));

      await waitFor(() => expect(screen.getByText('Saving...')).toBeDisabled());
      await submitPromise;
    });
  });
});
