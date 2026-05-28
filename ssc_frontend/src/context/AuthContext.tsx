import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi } from "@/api/services";
import { tokenStorage } from "@/api/client";
import type { AuthUser, Role, LoginRequest } from "@/types";

function decodeJWT(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return {
      user_id: decoded.user_id,
      staff_id: decoded.staff_id,
      role: decoded.role,
      file_number: decoded.file_number,
      full_name: decoded.full_name,
    };
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isFirstLogin: boolean;
  login: (data: LoginRequest) => Promise<{ is_first_login: boolean }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  // Role helpers
  isAdmin: boolean;
  isCommittee: boolean;
  isHOS: boolean;
  isStaff: boolean;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const token = tokenStorage.getAccess();
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded) setUser(decoded);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const res = await authApi.login(data);
    const { access, refresh, is_first_login } = res.data;

    tokenStorage.setTokens(access, refresh);
    const decoded = decodeJWT(access);
    setUser(decoded);
    setIsFirstLogin(is_first_login);

    return { is_first_login };
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // Blacklist may fail if token already expired
      }
    }
    tokenStorage.clearTokens();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const hasRole = useCallback(
    (roles: Role[]) => !!user && roles.includes(user.role),
    [user],
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    isFirstLogin,
    login,
    logout,
    updateUser,
    isAdmin: user?.role === "admin",
    isCommittee: user?.role === "committee",
    isHOS: user?.role === "head_of_school",
    isStaff: user?.role === "staff",
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
