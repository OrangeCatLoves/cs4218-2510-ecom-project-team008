import React from "react";
import { render, screen, within } from "@testing-library/react";
import UserMenu from "./UserMenu";

jest.mock("react-router-dom", () => ({
  NavLink: ({ to, className, children }) => (
    <a
      href={to}
      className={className}
      data-testid={`link-${String(children).toLowerCase()}`}
    >
      {children}
    </a>
  ),
}));

describe("UserMenu (Unit)", () => {
  const renderComponent = () => render(<UserMenu />);

  it("renders the Dashboard heading (h4) with correct accessible name", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    const heading = screen.getByRole("heading", {
      name: /dashboard/i,
      level: 4,
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders the container structure and Bootstrap classes", () => {
    // Arrange & Act
    const { container } = renderComponent();

    // Assert
    expect(container.querySelector(".text-center")).toBeInTheDocument();
    const listGroup = container.querySelector(".list-group");
    expect(listGroup).toBeInTheDocument();
  });

  it("renders exactly two navigation links with correct labels", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /orders/i })).toBeInTheDocument();
  });

  it("Profile link has correct href and classes", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    const profile = screen.getByRole("link", { name: /profile/i });
    expect(profile).toHaveAttribute("href", "/dashboard/user/profile");
    expect(profile).toHaveClass("list-group-item", "list-group-item-action");
  });

  it("Orders link has correct href and classes", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    const orders = screen.getByRole("link", { name: /orders/i });
    expect(orders).toHaveAttribute("href", "/dashboard/user/orders");
    expect(orders).toHaveClass("list-group-item", "list-group-item-action");
  });

  it("renders links in the intended order inside the list group (Profile then Orders)", () => {
    // Arrange
    const { container } = renderComponent();

    // Act
    const listGroup = container.querySelector(".list-group");
    const rendered = within(listGroup)
      .getAllByRole("link")
      .map((a) => a.textContent?.trim());

    // Assert
    expect(rendered).toEqual(["Profile", "Orders"]);
  });

  it("does not render any unexpected links", () => {
    // Arrange & Act
    renderComponent();

    // Assert
    const names = screen
      .getAllByRole("link")
      .map((a) => a.textContent?.trim().toLowerCase());
    expect(names).toEqual(["profile", "orders"]); // exact set
  });

  it("mounts without crashing (smoke)", () => {
    // Arrange & Act
    expect(() => renderComponent()).not.toThrow();
  });
});
