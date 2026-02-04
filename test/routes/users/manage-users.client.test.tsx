import { screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import ManageUsers from '../../../app/routes/users/manage-users';
import { renderWithEvents } from '../../__helpers__/set-up-test';

describe('ManageUsers', () => {
  it('renders outlet within layout', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: ManageUsers,
        children: [
          {
            index: true,
            Component: () => <div data-testid="outlet-content">Child Content</div>,
          },
        ],
      },
    ]);

    renderWithEvents(<Stub initialEntries={['/']} />);

    expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });
});
