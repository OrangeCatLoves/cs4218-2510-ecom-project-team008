import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import Dashboard from "../../../pages/user/Dashboard.js";
import { AuthProvider } from "../../../context/auth.js";

jest.mock("../../../components/Layout.js", () => ({ children, title }) => {
  return (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
});

describe("Integration: Dashboard ↔ Auth ↔ Layout ↔ Router", () => {
  const baseAuth = {
    user: {
      name: "John Doe",
      email: "john.doe@example.com",
      address: "123 Main Street, City, State",
      phone: "555-1234",
    },
    token: "mock-token",
  };

  const renderWithProviders = (
    auth = baseAuth,
    initialRoute = "/dashboard/user"
  ) => {
    if (auth !== undefined) {
      // allow passing undefined to simulate "no localStorage key set"
      localStorage.setItem("auth", JSON.stringify(auth));
    } else {
      localStorage.removeItem("auth");
    }

    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/dashboard/user" element={<Dashboard />} />
            <Route
              path="/dashboard/user/profile"
              element={<div>Profile Page</div>}
            />
            <Route
              path="/dashboard/user/orders"
              element={<div>Orders Page</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // auth → dashboard data render
  it("renders user data from AuthProvider (bootstrapped from localStorage)", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
      expect(
        screen.getByText("123 Main Street, City, State")
      ).toBeInTheDocument();
    });
  });

  // title propagation
  it("sets the page title via Layout integration", async () => {
    renderWithProviders();

    // verify Layout received the title prop
    await waitFor(() => {
      expect(screen.getByTestId("layout")).toHaveAttribute(
        "data-title",
        "Dashboard - Ecommerce App"
      );
    });
  });

  // router integration through UserMenu: links exist and navigate
  it("exposes working navigation links from UserMenu (Profile & Orders)", async () => {
    renderWithProviders();

    const profileLink = await screen.findByRole("link", { name: "Profile" });
    const ordersLink = await screen.findByRole("link", { name: "Orders" });

    expect(profileLink).toHaveAttribute("href", "/dashboard/user/profile");
    expect(ordersLink).toHaveAttribute("href", "/dashboard/user/orders");

    // simulate navigation by re-rendering at routes to ensure router targets exist
    renderWithProviders(baseAuth, "/dashboard/user/profile");
    await waitFor(() =>
      expect(screen.getByText("Profile Page")).toBeInTheDocument()
    );

    renderWithProviders(baseAuth, "/dashboard/user/orders");
    await waitFor(() =>
      expect(screen.getByText("Orders Page")).toBeInTheDocument()
    );
  });

  // robustness to partial or malformed auth objects
  it("handles partial user data (missing address) without crashing", async () => {
    const partial = {
      ...baseAuth,
      user: { name: "Jane", email: "jane@example.com" },
    };
    renderWithProviders(partial);

    await waitFor(() => {
      expect(screen.getByText("Jane")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    });
  });

  it("handles null user (auth present but user null) without crashing", async () => {
    const nullUser = { user: null, token: "t" };
    renderWithProviders(nullUser);

    // page skeleton should still render via Layout; no crash
    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Dashboard" })
      ).toBeInTheDocument();
    });
  });

  it("handles malformed localStorage auth (invalid JSON) gracefully", async () => {
    localStorage.setItem("auth", "{not-json"); // corrupt
    renderWithProviders(undefined); // do not overwrite the malformed value

    // should still render page skeleton and not crash
    await waitFor(() => {
      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Dashboard" })
      ).toBeInTheDocument();
    });
  });

  // state re-hydration
  it("reflects updated auth data on re-render (simulating user profile update elsewhere)", async () => {
    const { unmount } = renderWithProviders();

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );

    // simulate auth update
    const updated = {
      ...baseAuth,
      user: { ...baseAuth.user, name: "John M. Doe", address: "456 New Ave" },
    };
    localStorage.setItem("auth", JSON.stringify(updated));

    // unmount and remount to force AuthProvider to re-read localStorage
    unmount();
    renderWithProviders(updated);

    await waitFor(() => {
      expect(screen.getByText("John M. Doe")).toBeInTheDocument();
      expect(screen.getByText("456 New Ave")).toBeInTheDocument();
    });
  });

  // special characters / long strings (rendering resilience)
  it("renders special characters and long strings in user data", async () => {
    const special = {
      user: {
        name: "O'Brien & Associates — Alexander Wellington Richardson III",
        email: "very.long.email.address.for.testing@example-domain.com",
        address: '123 "Main" Street, #456\nApartment 4B\nCity, State 12345',
      },
      token: "t",
    };
    renderWithProviders(special);

    await waitFor(() => {
      expect(
        screen.getByText(
          "O'Brien & Associates — Alexander Wellington Richardson III"
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "very.long.email.address.for.testing@example-domain.com"
        )
      ).toBeInTheDocument();
      // only partial check for multi-line address
      expect(screen.getByText(/123 "Main" Street/)).toBeInTheDocument();
    });
  });
});
