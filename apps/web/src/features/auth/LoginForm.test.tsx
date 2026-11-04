import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { LoginPage } from "./LoginPage";
import * as AuthContextModule from "./AuthContext";

// Mock the AuthContext
vi.mock("./AuthContext", () => ({
  useAuth: vi.fn(),
}));

describe("React Testing Library: LoginPage / LoginForm", () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (AuthContextModule.useAuth as any).mockReturnValue({
      login: mockLogin,
      isAuthenticated: false,
      isLoading: false,
      user: null,
      role: null,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

  it("renders email and password inputs and a submit button", () => {
    renderComponent();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("displays client-side validation errors when submitting empty inputs", async () => {
    const user = userEvent.setup();
    renderComponent();

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("displays validation error when entering an invalid email format", async () => {
    const user = userEvent.setup();
    renderComponent();

    const emailInput = screen.getByLabelText(/work email/i);
    await user.type(emailInput, "not-an-email");

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("successfully calls the login API with valid credentials", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);
    renderComponent();

    await user.type(screen.getByLabelText(/work email/i), "employee@nexusops.com");
    await user.type(screen.getByLabelText(/password/i), "Secret123!");

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledWith("employee@nexusops.com", "Secret123!");
    });
  });

  it("displays server error alert when login fails with an error message", async () => {
    const user = userEvent.setup();
    const errorObj = new AxiosError(
      "Request failed with status code 401",
      "401",
      undefined,
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        data: { error: "Invalid email or password" },
        headers: {},
        config: {} as any,
      }
    );
    mockLogin.mockRejectedValueOnce(errorObj);
    renderComponent();

    await user.type(screen.getByLabelText(/work email/i), "employee@nexusops.com");
    await user.type(screen.getByLabelText(/password/i), "WrongPassword!");

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });
});
