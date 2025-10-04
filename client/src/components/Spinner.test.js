// Spinner.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Spinner from './Spinner';

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/dashboard' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

describe('Spinner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderSpinner = (path) => {
    return render(
      <BrowserRouter>
        <Spinner path={path} />
      </BrowserRouter>
    );
  };

  describe('Initial Render', () => {
    it('should display initial countdown of 3 seconds', () => {
      // Arrange & Act
      renderSpinner();

      // Assert
      expect(screen.getByText(/redirecting to you in 3 second/i)).toBeInTheDocument();
    });

    it('should display loading spinner', () => {
      // Arrange & Act
      renderSpinner();

      // Assert
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Countdown Logic', () => {
    it('should decrement count every second', async () => {
      // Arrange
      renderSpinner();

      // Act & Assert - Initial state
      expect(screen.getByText(/redirecting to you in 3 second/i)).toBeInTheDocument();

      // Act - Advance 1 second
      jest.advanceTimersByTime(1000);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/redirecting to you in 2 second/i)).toBeInTheDocument();
      });

      // Act - Advance another second
      jest.advanceTimersByTime(1000);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/redirecting to you in 1 second/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Logic', () => {
    it('should navigate to default login path when count reaches 0', async () => {
      // Arrange
      renderSpinner();

      // Act - Advance to countdown completion
      jest.advanceTimersByTime(3000);

      // Assert
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          state: '/dashboard',
        });
      });
    });

    it('should navigate to custom path when provided', async () => {
      // Arrange
      renderSpinner('register');

      // Act - Advance to countdown completion
      jest.advanceTimersByTime(3000);

      // Assert
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/register', {
          state: '/dashboard',
        });
      });
    });

    it('should preserve location pathname in navigation state', async () => {
      // Arrange
      renderSpinner();

      // Act
      jest.advanceTimersByTime(3000);

      // Assert
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            state: '/dashboard',
          })
        );
      });
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on component unmount', () => {
      // Arrange
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { unmount } = renderSpinner();

      // Act
      unmount();

      // Assert
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});