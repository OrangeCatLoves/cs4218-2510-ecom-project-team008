import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Register from "../../pages/Auth/Register";

jest.mock("axios");
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="mock-layout">{children}</div>,
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Integration between Register page and frontend dependencies", () => {
  const validUser = {
    name: "Mock User",
    email: "mockuser@email.com",
    password: "mockpassword",
    phone: "91234567",
    address: "Mock Address",
    DOB: "2000-01-01",
    answer: "football",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders registration form correctly", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Register />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("REGISTER FORM")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Phone")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your DOB")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What is Your Favorite sports")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REGISTER" })).toBeInTheDocument();
  });

  it("registers successfully and navigates to login page", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: true, message: "Register Successfully, please login" },
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/login" element={<div>🔑 Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("Enter Your Name"), validUser.name);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), validUser.email);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Password"), validUser.password);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Phone"), validUser.phone);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Address"), validUser.address);
    await userEvent.type(screen.getByPlaceholderText("Enter Your DOB"), validUser.DOB);
    await userEvent.type(screen.getByPlaceholderText("What is Your Favorite sports"), validUser.answer);

    await userEvent.click(screen.getByRole("button", { name: "REGISTER" }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith("/api/v1/auth/register", validUser));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Register Successfully, please login")
    );

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("shows backend error message when registration fails", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "User already exists" },
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Register />} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("Enter Your Name"), validUser.name);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), validUser.email);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Password"), validUser.password);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Phone"), validUser.phone);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Address"), validUser.address);
    await userEvent.type(screen.getByPlaceholderText("Enter Your DOB"), validUser.DOB);
    await userEvent.type(screen.getByPlaceholderText("What is Your Favorite sports"), validUser.answer);

    await userEvent.click(screen.getByRole("button", { name: "REGISTER" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("User already exists")
    );
  });

  it("shows generic error message when API call fails", async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { message: "Server unavailable" } },
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Register />} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText("Enter Your Name"), validUser.name);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Email"), validUser.email);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Password"), validUser.password);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Phone"), validUser.phone);
    await userEvent.type(screen.getByPlaceholderText("Enter Your Address"), validUser.address);
    await userEvent.type(screen.getByPlaceholderText("Enter Your DOB"), validUser.DOB);
    await userEvent.type(screen.getByPlaceholderText("What is Your Favorite sports"), validUser.answer);

    await userEvent.click(screen.getByRole("button", { name: "REGISTER" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Server unavailable")
    );
  });
});
