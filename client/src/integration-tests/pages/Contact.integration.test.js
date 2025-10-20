// client/src/integration-tests/pages/Contact.integration.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

jest.mock('../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <main data-testid="layout-main">{children}</main>,
}));

import Contact from '../../pages/Contact';

// helpers
const renderWithRouter = (ui) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Contact — integration (page + Layout composition)', () => {
  it('renders inside Layout', () => {
    // Arrange

    // Act
    const { getByTestId } = renderWithRouter(<Contact />);

    // Assert
    expect(getByTestId('layout-main')).toBeInTheDocument();
    expect(screen.getByText('CONTACT US')).toBeInTheDocument();
  });

  it('exposes accessible heading and image', () => {
    // Arrange

    // Act
    renderWithRouter(<Contact />);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'CONTACT US' })).toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'contactus' });
    expect(img).toHaveAttribute('src', '/images/contactus.jpeg');
  });

  it('shows static contact info, including emoji bug-fix text', () => {
    // Arrange

    // Act
    renderWithRouter(<Contact />);

    // Assert
    expect(screen.getByText(/For any query or info about product/i)).toBeInTheDocument();
    expect(screen.getByText(/We are\s+available 24X7/i)).toBeInTheDocument();
    expect(screen.getByText(/📧 Email:\s*www\.help@ecommerceapp\.com/)).toBeInTheDocument();
    expect(screen.getByText(/📞 Phone:\s*012-3456789/)).toBeInTheDocument();
    expect(screen.getByText(/💬 Support:\s*1800-0000-0000 \(toll free\)/)).toBeInTheDocument();
  });
});
