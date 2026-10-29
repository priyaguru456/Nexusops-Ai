import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

let memoryAccessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

const authFailureCallbacks: Array<() => void> = [];

export const setAccessToken = (token: string | null) => {
  memoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return memoryAccessToken;
};

export const onAuthFailure = (callback: () => void) => {
  authFailureCallbacks.push(callback);
  return () => {
    const idx = authFailureCallbacks.indexOf(callback);
    if (idx !== -1) authFailureCallbacks.splice(idx, 1);
  };
};

const notifyAuthFailure = () => {
  memoryAccessToken = null;
  authFailureCallbacks.forEach((cb) => cb());
};

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (memoryAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    // Only attempt refresh on 401 for non-auth requests and if not previously retried
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject: (err) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post<{ accessToken: string }>(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.accessToken;
        setAccessToken(newAccessToken);

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        notifyAuthFailure();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const apiClient = api;
export default api;
