import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import UserMenu from "../../components/UserMenu.js";

describe("UserMenu Integration Tests", () => {
  const renderWithRoutes = (initialPath = "/dashboard/user/profile") => {
    // dummy pages
    const ProfilePage = () => (
      <div data-testid="profile-page">Profile Page</div>
    );
    const OrdersPage = () => <div data-testid="orders-page">Orders Page</div>;

    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <div className="container">
          <div className="row">
            <div className="col-md-3">
              <UserMenu />
            </div>
            <div className="col-md-9">
              <Routes>
                <Route
                  path="/dashboard/user/profile"
                  element={<ProfilePage />}
                />
                <Route path="/dashboard/user/orders" element={<OrdersPage />} />
              </Routes>
            </div>
          </div>
        </div>
      </MemoryRouter>
    );
  };

  describe("Navigation Integration", () => {
    it("renders menu items and routes to /profile by default initial entry", async () => {
      renderWithRoutes("/dashboard/user/profile");

      // menu present with expected labels
      expect(
        screen.getByRole("heading", { name: "Dashboard" })
      ).toBeInTheDocument();
      const profileLink = screen.getByRole("link", { name: /profile/i });
      const ordersLink = screen.getByRole("link", { name: /orders/i });

      expect(profileLink).toHaveAttribute("href", "/dashboard/user/profile");
      expect(ordersLink).toHaveAttribute("href", "/dashboard/user/orders");

      // assert routed page rendered
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    });

    it("navigates to Orders when Orders link is clicked (full router integration)", async () => {
      renderWithRoutes("/dashboard/user/profile");

      await userEvent.click(screen.getByRole("link", { name: /orders/i }));

      // target page should render after navigation
      expect(screen.getByTestId("orders-page")).toBeInTheDocument();
      // and previous page should no longer be visible
      expect(screen.queryByTestId("profile-page")).not.toBeInTheDocument();
    });
  });

  describe("Active State & Accessibility Integration", () => {
    it("applies active class and aria-current to the active link only (Profile)", async () => {
      renderWithRoutes("/dashboard/user/profile");

      const profileLink = screen.getByRole("link", { name: /profile/i });
      const ordersLink = screen.getByRole("link", { name: /orders/i });

      // NavLink should tag active route
      expect(profileLink).toHaveClass("active");
      expect(profileLink).toHaveAttribute("aria-current", "page");

      // non-active link should not be flagged
      expect(ordersLink).not.toHaveClass("active");
      expect(ordersLink).not.toHaveAttribute("aria-current", "page");
    });

    it("updates active state when route changes (Orders becomes active)", async () => {
      renderWithRoutes("/dashboard/user/profile");

      const profileLink = screen.getByRole("link", { name: /profile/i });
      const ordersLink = screen.getByRole("link", { name: /orders/i });

      await userEvent.click(ordersLink);

      expect(ordersLink).toHaveClass("active");
      expect(ordersLink).toHaveAttribute("aria-current", "page");

      expect(profileLink).not.toHaveClass("active");
      expect(profileLink).not.toHaveAttribute("aria-current", "page");
    });
  });

  describe("Structure / Styling Integration", () => {
    it("renders Bootstrap list-group with two actionable items in correct column", async () => {
      const { container } = renderWithRoutes("/dashboard/user/profile");

      const listGroup = container.querySelector(".list-group");
      expect(listGroup).toBeInTheDocument();

      const items = container.querySelectorAll(".list-group-item");
      expect(items.length).toBe(2);

      // menu in left column (integration with page layout expectations)
      expect(container.querySelector(".col-md-3")?.contains(listGroup)).toBe(
        true
      );
    });
  });
});
