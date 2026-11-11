import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";
import { authApi } from "./api";

vi.mock("./api", () => ({
  profileApi: {
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
  authApi: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

describe("ForgotPasswordPage & ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits forgot password email and displays confirmation message", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({
      message: "If an account with that email exists, a password reset link has been sent.",
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/work email/i), "alice@nexusops.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith("alice@nexusops.com");
    });
    expect(
      screen.getByText(/if an account with that email exists/i)
    ).toBeInTheDocument();
  });

  it("shows missing token alert on ResetPasswordPage when token query param is absent", () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/missing password reset token/i)).toBeInTheDocument();
  });

  it("submits new password with query token on ResetPasswordPage", async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
      message: "Password has been reset successfully.",
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reset-password?token=abc123"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/^new password$/i), "NewPassword123!");
    await user.type(screen.getByLabelText(/confirm new password/i), "NewPassword123!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith({
        token: "abc123",
        newPassword: "NewPassword123!",
      });
    });
    expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument();
  });
});
