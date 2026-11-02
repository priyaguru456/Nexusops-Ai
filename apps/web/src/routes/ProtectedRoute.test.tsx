import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import * as AuthContextModule from "../features/auth/AuthContext";

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

describe("React Testing Library: ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialRoute: string, protectedRouteElement: React.ReactNode) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<div>Login Page Mock</div>} />
          <Route path="/403" element={<div>403 Forbidden Page Mock</div>} />
          <Route path="/protected" element={protectedRouteElement} />
        </Routes>
      </MemoryRouter>
    );
  };

  it("redirects unauthenticated user to /login", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      role: null,
    });

    renderWithRouter(
      "/protected",
      <ProtectedRoute>
        <div>Secret Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Login Page Mock")).toBeInTheDocument();
    expect(screen.queryByText("Secret Content")).not.toBeInTheDocument();
  });

  it("redirects authenticated user with wrong role to /403 page", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", role: "EMPLOYEE", name: "Alice", email: "alice@test.com" },
      role: "EMPLOYEE",
    });

    // Route requires ADMIN role
    renderWithRouter(
      "/protected",
      <ProtectedRoute roles={["ADMIN"]}>
        <div>Admin Audit Dashboard</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("403 Forbidden Page Mock")).toBeInTheDocument();
    expect(screen.queryByText("Admin Audit Dashboard")).not.toBeInTheDocument();
  });

  it("renders protected content when user has the allowed role", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "2", role: "ADMIN", name: "Bob Admin", email: "bob@test.com" },
      role: "ADMIN",
    });

    renderWithRouter(
      "/protected",
      <ProtectedRoute roles={["ADMIN"]}>
        <div>Admin Audit Dashboard</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Admin Audit Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("403 Forbidden Page Mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Login Page Mock")).not.toBeInTheDocument();
  });

  it("renders protected content when no specific roles are required (any authenticated user)", () => {
    (AuthContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: "3", role: "EMPLOYEE", name: "Charlie", email: "charlie@test.com" },
      role: "EMPLOYEE",
    });

    renderWithRouter(
      "/protected",
      <ProtectedRoute>
        <div>Standard User Profile</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Standard User Profile")).toBeInTheDocument();
  });
});
