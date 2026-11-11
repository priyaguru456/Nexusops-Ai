import { api } from "../../api/client";
import type { User } from "../../types/auth";

export const profileApi = {
  updateProfile: async (data: { name: string }): Promise<{ user: User }> => {
    const res = await api.patch<{ user: User }>("/users/me", data);
    return res.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>("/users/me/password", data);
    return res.data;
  },
};

export const authApi = {
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>("/auth/forgot-password", { email });
    return res.data;
  },

  resetPassword: async (data: {
    token: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>("/auth/reset-password", data);
    return res.data;
  },
};
