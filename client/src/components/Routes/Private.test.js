import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import axios from "axios";
import PrivateRoute from "./Private";
import React from "react";

// mocks
jest.mock("axios");
jest.mock("../../context/auth");
jest.mock("../Spinner", () => {
  return function MockSpinner() {
    return <div data-testid="spinner">Loading...</div>;
  };
});

jest.mock("react-router-dom", () => ({
  Outlet: () => <div data-testid="outlet">Protected Content</div>,
}));

import { useAuth } from "../../context/auth";

describe("PrivateRoute (Unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // success path
  describe("Authentication Success Path", () => {
    it("renders protected content when authentication is successful", async () => {
      // Arrange
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      // Act
      render(<PrivateRoute />);

      // Assert
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId("outlet")).toBeInTheDocument()
      );

      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  // failure path
  describe("Authentication Failure Paths", () => {
    it("shows spinner when API returns ok: false", async () => {
      useAuth.mockReturnValue([{ token: "invalid-token" }]);
      axios.get.mockResolvedValue({ data: { ok: false } });

      render(<PrivateRoute />);

      await waitFor(() => expect(axios.get).toHaveBeenCalled());
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });

    it("shows spinner and never calls API when token is null", () => {
      useAuth.mockReturnValue([{ token: null }]);

      render(<PrivateRoute />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("shows spinner and never calls API when token is undefined", () => {
      useAuth.mockReturnValue([{ token: undefined }]);

      render(<PrivateRoute />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("shows spinner and never calls API when auth is null", () => {
      useAuth.mockReturnValue([null]);

      render(<PrivateRoute />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  // error handling
  describe("Error Handling", () => {
    it("shows spinner when API call rejects (network error)", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockRejectedValue(new Error("Network Error"));

      render(<PrivateRoute />);

      await waitFor(() => expect(axios.get).toHaveBeenCalled());
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });

    it("shows spinner when API returns 401", async () => {
      useAuth.mockReturnValue([{ token: "expired-token" }]);
      axios.get.mockRejectedValue({
        response: { status: 401, data: { message: "Unauthorized" } },
      });

      render(<PrivateRoute />);

      await waitFor(() => expect(axios.get).toHaveBeenCalled());
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });

    it("shows spinner when API returns 500", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockRejectedValue({
        response: { status: 500, data: { message: "Internal Server Error" } },
      });

      render(<PrivateRoute />);

      await waitFor(() => expect(axios.get).toHaveBeenCalled());
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });
  });

  // lifecycle and state
  describe("Component Lifecycle & State Management", () => {
    it("does not update state after unmount (isMounted guard)", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      let resolveAuth;
      const pending = new Promise((resolve) => (resolveAuth = resolve));
      axios.get.mockReturnValueOnce(pending);

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { unmount } = render(<PrivateRoute />);
      unmount();

      await act(async () => {
        resolveAuth({ data: { ok: true } }); // resolve after unmount
      });

      const combined = consoleSpy.mock.calls
        .map((args) => (args && args[0] ? String(args[0]) : ""))
        .join("\n");
      expect(combined).not.toMatch(
        /Can't perform a React state update on an unmounted component/
      );

      consoleSpy.mockRestore();
    });

    it("re-authenticates when token changes", async () => {
      useAuth.mockReturnValue([{ token: "token1" }]);
      axios.get.mockResolvedValueOnce({ data: { ok: true } });

      const { rerender } = render(<PrivateRoute />);
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

      useAuth.mockReturnValue([{ token: "token2" }]);
      axios.get.mockResolvedValueOnce({ data: { ok: true } });
      rerender(<PrivateRoute />);

      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    it("does NOT re-authenticate when token stays the same", async () => {
      useAuth.mockReturnValue([{ token: "stable" }]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      const { rerender } = render(<PrivateRoute />);
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

      // same token -> should not call again
      rerender(<PrivateRoute />);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it("transitions from spinner to content on successful auth", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      render(<PrivateRoute />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByTestId("outlet")).toBeInTheDocument()
      );
      expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    });

    it("transitions from authenticated to unauthenticated when token is removed", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      const { rerender } = render(<PrivateRoute />);
      await waitFor(() =>
        expect(screen.getByTestId("outlet")).toBeInTheDocument()
      );

      useAuth.mockReturnValue([{ token: null }]);
      rerender(<PrivateRoute />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });
  });

  // edge cases
  describe("Edge Cases & Boundary Conditions", () => {
    it("handles empty-string token as unauthenticated (no API call)", () => {
      useAuth.mockReturnValue([{ token: "" }]);

      render(<PrivateRoute />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("treats missing 'ok' field as falsy", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockResolvedValue({ data: {} });

      render(<PrivateRoute />);

      await waitFor(() => expect(axios.get).toHaveBeenCalled());
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });

    it("accepts truthy non-boolean ok (e.g., 1) as authenticated", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockResolvedValue({ data: { ok: 1 } });

      render(<PrivateRoute />);

      await waitFor(() =>
        expect(screen.getByTestId("outlet")).toBeInTheDocument()
      );
      expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    });
  });

  // dependency interaction (verifies axios call shape)
  describe("Interaction with Dependencies (Mocked)", () => {
    it("calls the expected endpoint exactly once on mount when token exists", async () => {
      useAuth.mockReturnValue([{ token: "valid-token" }]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      render(<PrivateRoute />);

      await waitFor(() =>
        expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth")
      );
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it("consumes useAuth context", async () => {
      const mockAuth = { token: "test-token", user: { id: 1, name: "Test" } };
      useAuth.mockReturnValue([mockAuth]);

      axios.get.mockResolvedValue({ data: { ok: true } });

      render(<PrivateRoute />);

      expect(useAuth).toHaveBeenCalled();
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    });
  });
});
