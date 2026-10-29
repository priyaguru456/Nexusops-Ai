import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAccessToken, onAuthFailure } from "../../api/client";
import type { User, AuthContextType, AuthResponse, RefreshResponse } from "../../types/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // Load session on app startup via silent token refresh & /auth/me
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const refreshRes = await api.post<RefreshResponse>("/auth/refresh");
        setAccessToken(refreshRes.data.accessToken);

        const meRes = await api.get<{ user: User }>("/auth/me");
        if (isMounted) {
          setUser(meRes.data.user);
        }
      } catch {
        if (isMounted) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    // Listen for 401 refresh failures to reset user state and redirect
    const unsubscribe = onAuthFailure(() => {
      setUser(null);
      navigate("/login", { replace: true });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const login = async (email: string, password: string): Promise<void> => {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  };

  const register = async (name: string, email: string, password: string): Promise<void> => {
    const res = await api.post<AuthResponse>("/auth/register", { name, email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore network/server errors during logout
    } finally {
      setAccessToken(null);
      setUser(null);
      navigate("/login", { replace: true });
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
