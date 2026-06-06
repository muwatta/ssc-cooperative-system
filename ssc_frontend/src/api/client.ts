import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from "axios";

// ---------- Environment‑based base URL ----------
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "https://ssc-cooperative-system.onrender.com/api/v1";

// ---------- Token storage (unchanged) ----------
const ACCESS_KEY = "ssc_access";
const REFRESH_KEY = "ssc_refresh";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ---------- Logout handler (callable from anywhere) ----------
type LogoutCallback = () => void;
let onForceLogout: LogoutCallback | null = null;

export function setLogoutCallback(cb: LogoutCallback) {
  onForceLogout = cb;
}

// ---------- Axios instance ----------
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ---------- Request interceptor (unchanged) ----------
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccess();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------- Refresh queue types ----------
interface QueueItem {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token as string);
  });
  failedQueue = [];
}

// ---------- Response interceptor ----------
api.interceptors.response.use(
  (response) => response,
  async (
    error: AxiosError & {
      config: InternalAxiosRequestConfig & { _retry?: boolean };
    },
  ) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        tokenStorage.clearTokens();
        onForceLogout?.();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<{ access: string; refresh?: string }>(
          `${BASE_URL}/auth/refresh/`,
          { refresh: refreshToken },
        );
        tokenStorage.setTokens(data.access, data.refresh ?? refreshToken);
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStorage.clearTokens();
        onForceLogout?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
