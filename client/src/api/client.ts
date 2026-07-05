import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@invogen/shared';
import {
  clearSession,
  getRefreshToken,
  isAccessTokenExpired,
  redirectToLogin,
  setRefreshToken,
} from '@/lib/auth-session';
import { store } from '@/store';
import { setAccessToken } from '@/store/slices/authSlice';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const isAuthEndpoint = (url?: string) =>
  !!url &&
  (url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/maintenance'));

const isAppAuthFailure = (error: AxiosError) => {
  const message = String(
    (error.response?.data as { message?: string } | undefined)?.message || ''
  ).toLowerCase();
  if (!message) return true;
  return !(
    message.includes('razorpay') ||
    message.includes('cashfree') ||
    message.includes('payment gateway') ||
    message.includes('api credentials')
  );
};

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

const applyAccessToken = (token: string) => {
  localStorage.setItem('accessToken', token);
  store.dispatch(setAccessToken(token));
};

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>(
    `${API_URL}/auth/refresh`,
    refreshToken ? { refreshToken } : {},
    { withCredentials: true }
  );

  const newToken = data.data?.accessToken;
  if (!newToken) {
    throw new Error('Refresh response missing access token');
  }

  applyAccessToken(newToken);
  if (data.data?.refreshToken) {
    setRefreshToken(data.data.refreshToken);
  }
  return newToken;
};

const getQueuedToken = () =>
  new Promise<string>((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  });

const ensureValidAccessToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('accessToken');
  if (!token || !isAccessTokenExpired(token)) return token;

  if (isRefreshing) return getQueuedToken();

  isRefreshing = true;
  try {
    const newToken = await refreshAccessToken();
    processQueue(null, newToken);
    return newToken;
  } catch (error) {
    processQueue(error, null);
    clearSession();
    redirectToLogin(true);
    throw error;
  } finally {
    isRefreshing = false;
  }
};

api.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete (config.headers as Record<string, string>)['Content-Type'];
    }
  }

  if (isAuthEndpoint(config.url)) return config;

  try {
    const token = await ensureValidAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // redirect already triggered
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (
      error.response?.status === 503 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.startsWith('/super-admin') &&
      !window.location.pathname.startsWith('/maintenance')
    ) {
      window.location.assign('/maintenance');
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url) ||
      !isAppAuthFailure(error)
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      try {
        const token = await getQueuedToken();
        return api({
          ...originalRequest,
          headers: {
            ...originalRequest.headers,
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (queueError) {
        return Promise.reject(queueError);
      }
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      return api({
        ...originalRequest,
        headers: {
          ...originalRequest.headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearSession();
      redirectToLogin(true);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
