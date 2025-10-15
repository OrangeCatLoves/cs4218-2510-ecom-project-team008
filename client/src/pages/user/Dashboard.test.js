import React from "react";
import { render, screen } from "@testing-library/react";
import Dashboard from "./Dashboard";

// mocks
jest.mock("../../components/Layout", () => {
  return function MockLayout({ title, children }) {
    return (
      <div data-testid="layout" data-title={title}>
        {children}
      </div>
    );
  };
});

jest.mock("../../components/UserMenu", () => {
  return function MockUserMenu() {
    return <nav data-testid="user-menu" />;
  };
});

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "../../context/auth";

// helper
const renderWithAuth = (authValue) => {
  useAuth.mockReturnValue([authValue]);
  return render(<Dashboard />);
};

describe("Dashboard (Unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders within Layout and passes the exact title prop", () => {
    renderWithAuth({ user: { name: "A", email: "a@x.com", address: "Addr" } });
    const layout = screen.getByTestId("layout");
    expect(layout).toBeInTheDocument();
    expect(layout).toHaveAttribute("data-title", "Dashboard - Ecommerce App");
  });

  it("renders UserMenu in the left column and the card in the right column", () => {
    const { container } = renderWithAuth({
      user: { name: "A", email: "a@x.com", address: "Addr" },
    });

    const leftCol = container.querySelector(".col-md-3");
    const rightCol = container.querySelector(".col-md-9");
    expect(leftCol).toBeInTheDocument();
    expect(rightCol).toBeInTheDocument();

    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(rightCol.querySelector(".card.w-75.p-3")).toBeInTheDocument();
  });

  it("calls useAuth (collaborator contract)", () => {
    renderWithAuth({ user: { name: "A" } });
    expect(useAuth).toHaveBeenCalled();
  });

  it("displays name, email, and address in three h3 headings (happy path)", () => {
    const user = {
      name: "Jane Doe",
      email: "jane@example.com",
      address: "221B Baker St",
    };
    const { container } = renderWithAuth({ user });

    const h3s = container.querySelectorAll("h3");
    expect(h3s).toHaveLength(3);
    expect(h3s[0]).toHaveTextContent("Jane Doe");
    expect(h3s[1]).toHaveTextContent("jane@example.com");
    expect(h3s[2]).toHaveTextContent("221B Baker St");
  });

  it("renders special characters safely in user fields", () => {
    const user = {
      name: "François & Co.",
      email: "user+tag@example.co.uk",
      address: 'Apt <#5> & "Unit"',
    };
    const { container } = renderWithAuth({ user });

    const h3s = container.querySelectorAll("h3");
    expect(h3s[0]).toHaveTextContent("François & Co.");
    expect(h3s[1]).toHaveTextContent("user+tag@example.co.uk");
    expect(h3s[2]).toHaveTextContent('Apt <#5> & "Unit"');
  });

  it("renders empty headings when user is null (no crash)", () => {
    const { container } = renderWithAuth({ user: null });
    const h3s = container.querySelectorAll("h3");
    expect(h3s).toHaveLength(3);
    expect(h3s[0].textContent).toBe("");
    expect(h3s[1].textContent).toBe("");
    expect(h3s[2].textContent).toBe("");
  });

  it("renders empty headings when user is undefined (no crash)", () => {
    const { container } = renderWithAuth({});
    const h3s = container.querySelectorAll("h3");
    expect(h3s).toHaveLength(3);
    expect(h3s[0].textContent).toBe("");
    expect(h3s[1].textContent).toBe("");
    expect(h3s[2].textContent).toBe("");
  });

  it("renders available fields and leaves missing ones empty (partial user)", () => {
    const { container } = renderWithAuth({ user: { name: "Only Name" } });
    const h3s = container.querySelectorAll("h3");
    expect(h3s).toHaveLength(3);
    expect(h3s[0]).toHaveTextContent("Only Name");
    expect(h3s[1].textContent).toBe("");
    expect(h3s[2].textContent).toBe("");
  });

  it("keeps core container structure (.container-fluid .row) for layout consistency", () => {
    const { container } = renderWithAuth({ user: { name: "A" } });
    expect(container.querySelector(".container-fluid")).toBeInTheDocument();
    expect(container.querySelector(".row")).toBeInTheDocument();
  });
});
