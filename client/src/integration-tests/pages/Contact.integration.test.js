import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from '../../pages/Contact';
import { AuthProvider } from '../../context/auth';
import { CartProvider } from '../../context/cart';
import { SearchProvider } from '../../context/search';

const MockProviders = ({ children }) => {
  return (
    <MemoryRouter>
      <AuthProvider>
        <SearchProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </SearchProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Contact Page Integration Tests', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  describe('Layout Integration', () => {
    it('should integrate with Layout component and render contact page', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      expect(screen.getByText('CONTACT US')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'contactus' })).toBeInTheDocument();
    });

    it('should render Layout component with contact content', () => {
      // Arrange & Act
      const { container } = render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Layout provides the main wrapper
      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
      
      // Contact content integrated within Layout
      const contactHeading = screen.getByText('CONTACT US');
      expect(contactHeading).toBeInTheDocument();
    });

    it('should render within Layout structure with Header and Footer', () => {
      // Arrange & Act
      const { container } = render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Layout creates main element wrapper
      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
      
      // Contact content should be inside main
      const contactHeading = screen.getByText('CONTACT US');
      expect(main).toContainElement(contactHeading);
    });
  });

  describe('Static Content Display Integration', () => {
    it('should display all contact information correctly', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - All contact info displayed
      expect(screen.getByText('CONTACT US')).toBeInTheDocument();
      expect(screen.getByText(/For any query or info about product/)).toBeInTheDocument();
      expect(screen.getByText(/📧 Email: www.help@ecommerceapp.com/)).toBeInTheDocument();
      expect(screen.getByText(/📞 Phone: 012-3456789/)).toBeInTheDocument();
      expect(screen.getByText(/💬 Support: 1800-0000-0000 \(toll free\)/)).toBeInTheDocument();
    });

    it('should display contact heading with correct styling', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const heading = screen.getByText('CONTACT US');
      expect(heading).toHaveClass('bg-dark', 'p-2', 'text-white', 'text-center');
      expect(heading.tagName).toBe('H1');
    });

    it('should display introductory text about availability', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      expect(screen.getByText(/For any query or info about product/)).toBeInTheDocument();
      expect(screen.getByText(/We are available 24X7/)).toBeInTheDocument();
    });
  });

  describe('Emoji Bug Fix Validation', () => {
    it('should render email emoji correctly instead of react-icons', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Verify emoji is in the text (bug fix validation)
      const emailText = screen.getByText(/📧 Email:/);
      expect(emailText).toBeInTheDocument();
      expect(emailText.textContent).toContain('📧');
      expect(emailText.textContent).toContain('www.help@ecommerceapp.com');
    });

    it('should render phone emoji correctly instead of react-icons', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Verify emoji is in the text (bug fix validation)
      const phoneText = screen.getByText(/📞 Phone:/);
      expect(phoneText).toBeInTheDocument();
      expect(phoneText.textContent).toContain('📞');
      expect(phoneText.textContent).toContain('012-3456789');
    });

    it('should render support emoji correctly instead of react-icons', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Verify emoji is in the text (bug fix validation)
      const supportText = screen.getByText(/💬 Support:/);
      expect(supportText).toBeInTheDocument();
      expect(supportText.textContent).toContain('💬');
      expect(supportText.textContent).toContain('1800-0000-0000');
    });

    it('should display all three emojis simultaneously', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - All emojis present (validates complete bug fix)
      expect(screen.getByText(/📧/)).toBeInTheDocument();
      expect(screen.getByText(/📞/)).toBeInTheDocument();
      expect(screen.getByText(/💬/)).toBeInTheDocument();
    });
  });

  describe('Image Integration', () => {
    it('should render contact image with correct source', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const image = screen.getByRole('img', { name: 'contactus' });
      expect(image).toHaveAttribute('src', '/images/contactus.jpeg');
    });

    it('should render contact image with alt text for accessibility', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const image = screen.getByAltText('contactus');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAccessibleName();
    });

    it('should apply responsive styling to contact image', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const image = screen.getByRole('img', { name: 'contactus' });
      expect(image).toHaveStyle({ width: '100%' });
    });
  });

  describe('Responsive Layout Structure', () => {
    it('should render two-column layout with correct Bootstrap classes', () => {
      // Arrange & Act
      const { container } = render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const row = container.querySelector('.row.contactus');
      expect(row).toBeInTheDocument();

      const imageColumn = container.querySelector('.col-md-6');
      expect(imageColumn).toBeInTheDocument();

      const contentColumn = container.querySelector('.col-md-4');
      expect(contentColumn).toBeInTheDocument();
    });

    it('should organize contact information in proper column structure', () => {
      // Arrange & Act
      const { container } = render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const contentColumn = container.querySelector('.col-md-4');
      const withinColumn = within(contentColumn);

      expect(withinColumn.getByText('CONTACT US')).toBeInTheDocument();
      expect(withinColumn.getByText(/📧 Email:/)).toBeInTheDocument();
      expect(withinColumn.getByText(/📞 Phone:/)).toBeInTheDocument();
      expect(withinColumn.getByText(/💬 Support:/)).toBeInTheDocument();
    });
  });

  describe('Content Formatting', () => {
    it('should apply proper spacing to contact information paragraphs', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const emailParagraph = screen.getByText(/📧 Email:/).closest('p');
      expect(emailParagraph).toHaveClass('mt-3');

      const phoneParagraph = screen.getByText(/📞 Phone:/).closest('p');
      expect(phoneParagraph).toHaveClass('mt-3');

      const supportParagraph = screen.getByText(/💬 Support:/).closest('p');
      expect(supportParagraph).toHaveClass('mt-3');
    });

    it('should format introductory text with proper classes', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const introParagraph = screen.getByText(/For any query or info/).closest('p');
      expect(introParagraph).toHaveClass('text-justify', 'mt-2');
    });
  });

  describe('Component Composition Integration', () => {
    it('should render all sections without crashing', () => {
      // Arrange & Act & Assert
      expect(() => {
        render(
          <MockProviders>
            <Contact />
          </MockProviders>
        );
      }).not.toThrow();
    });

    it('should maintain proper document structure', () => {
      // Arrange & Act
      const { container } = render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Check hierarchical structure
      const row = container.querySelector('.row.contactus');
      expect(row).toBeInTheDocument();
      
      const columns = row.querySelectorAll('[class*="col-md-"]');
      expect(columns).toHaveLength(2);
    });

    it('should render contact details in correct order', () => {
      // Arrange & Act
      const { container } = render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert - Verify order of elements
      const contentColumn = container.querySelector('.col-md-4');
      const paragraphs = contentColumn.querySelectorAll('p');
      
      expect(paragraphs[0]).toHaveTextContent(/For any query/);
      expect(paragraphs[1]).toHaveTextContent(/📧 Email:/);
      expect(paragraphs[2]).toHaveTextContent(/📞 Phone:/);
      expect(paragraphs[3]).toHaveTextContent(/💬 Support:/);
    });
  });

  describe('Accessibility Integration', () => {
    it('should have proper heading hierarchy', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('CONTACT US');
    });

    it('should have accessible image with descriptive alt text', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const image = screen.getByRole('img');
      expect(image).toHaveAccessibleName();
      expect(image.alt).toBe('contactus');
    });

    it('should have readable text contrast with dark background', () => {
      // Arrange & Act
      render(
        <MockProviders>
          <Contact />
        </MockProviders>
      );

      // Assert
      const heading = screen.getByText('CONTACT US');
      expect(heading).toHaveClass('text-white');
      expect(heading).toHaveClass('bg-dark');
    });
  });
});