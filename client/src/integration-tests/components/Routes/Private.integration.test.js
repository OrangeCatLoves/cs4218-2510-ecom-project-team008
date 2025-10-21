import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import PrivateRoute from "../../../components/Routes/Private.js";
import { AuthProvider } from "../../../context/auth.js";

// make Spinner predictable/fast. Keep semantics ("redirecting"/"loading").
jest.mock("../../../components/Spinner.js", () => () => (
  <div>redirecting... (loading)</div>
));
jest.mock("axios");

const Protected = () => <div>Protected Content</div>;
const Login = () => <div>Login Page</div>;
const Home = () => <div>Home</div>;

const renderWithProviders = (
  initial = "/protected",
  children = <Protected />
) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/protected" element={<PrivateRoute />}>
            <Route index element={children} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

describe("Integration: PrivateRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    delete axios.defaults.headers.common["Authorization"];
  });

  // happy path
  it("grants access when token exists and backend ok=true", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "valid" })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    renderWithProviders("/protected");

    // calls verification API
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
    });

    // shows protected content
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    // spinner is gone
    expect(screen.queryByText(/redirecting/i)).not.toBeInTheDocument();
  });

  it("renders Outlet children when authenticated (nested case)", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "valid" })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    renderWithProviders(
      "/protected",
      <div data-testid="nested">Nested Protected</div>
    );

    await waitFor(() => {
      expect(screen.getByTestId("nested")).toBeInTheDocument();
    });
  });

  // redirects or failures
  it("redirects to /login when backend ok=false (auth failure)", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "expired" })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: false } });

    renderWithProviders("/protected");

    // spinner first
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();

    // ends up on login
    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to /login on network error during auth verification", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "validish" })
    );
    axios.get.mockRejectedValueOnce(new Error("Network Error"));

    renderWithProviders("/protected");

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  it("redirects immediately to /login when no token (no API call)", async () => {
    // no localStorage auth set
    renderWithProviders("/protected");

    // should not hit backend at all
    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });

    // lands on login
    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  // loading or transition
  it("shows Spinner while the auth check is pending, then reveals content", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "valid" })
    );

    let resolveAuth;
    axios.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuth = resolve; // hold it to simulate latency
      })
    );

    renderWithProviders("/protected");

    // spinner visible during pending request
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();

    // complete request
    resolveAuth({ data: { ok: true } });

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  // edge cases for localStorage / context bootstrap
  it("handles malformed localStorage auth gracefully (redirects)", async () => {
    localStorage.setItem("auth", "not-json");

    renderWithProviders("/protected");

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("handles empty token string (redirects without API call)", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "" })
    );

    renderWithProviders("/protected");

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  // lifecycle robustness
  it("does not update state after unmount while request is in-flight", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "valid" })
    );

    let resolveAuth;
    axios.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuth = resolve;
      })
    );

    const { unmount } = renderWithProviders("/protected");
    unmount();

    // finishes after unmount; should not throw or set state on unmounted component
    resolveAuth({ data: { ok: true } });
  });

  // multiple guarded routes concurrently (race-free)
  it("protects multiple routes independently (no cross-talk)", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { name: "U" }, token: "valid" })
    );
    axios.get.mockResolvedValue({ data: { ok: true } });

    const Route1 = () => <div>R1</div>;
    const Route2 = () => <div>R2</div>;

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/r1"]}>
          <Routes>
            <Route path="/r1" element={<PrivateRoute />}>
              <Route index element={<Route1 />} />
            </Route>
            <Route path="/r2" element={<PrivateRoute />}>
              <Route index element={<Route2 />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("R1")).toBeInTheDocument();
    });
  });
});
