import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, authApi } from "./api";
import type { AuthMe, Camp, User } from "./types";

interface AuthState {
  user: User | null;
  campId: string | null;
  camps: Camp[];
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, campId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  switchCamp: (campId: string) => Promise<void>;
  switchEnrollment: (enrollmentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [campId, setCampId] = useState<string | null>(null);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyMe = useCallback((me: AuthMe) => {
    setUser(me.user);
    setCampId(me.camp_id);
    setCamps(me.camps || []);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      applyMe(me);
      setError(null);
    } catch (err) {
      setUser(null);
      setCampId(null);
      setCamps([]);
      if (!(err instanceof ApiError && err.status === 401)) {
        setError(err instanceof Error ? err.message : "无法获取会话");
      }
    }
  }, [applyMe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const me = await authApi.me();
        if (!cancelled) applyMe(me);
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMe]);

  const login = useCallback(
    async (email: string, password: string, camp?: string) => {
      const res = await authApi.login(email, password, camp);
      setUser(res.user);
      setCampId(res.camp_id);
      setCamps(res.camps || []);
      setError(null);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setCampId(null);
      setCamps([]);
    }
  }, []);

  const switchCamp = useCallback(
    async (nextCampId: string) => {
      await authApi.switchCamp(nextCampId);
      await refreshMe();
    },
    [refreshMe],
  );

  const switchEnrollment = useCallback(
    async (enrollmentId: string) => {
      await authApi.switchEnrollment(enrollmentId);
      await refreshMe();
    },
    [refreshMe],
  );

  const value = useMemo(
    () => ({ user, campId, camps, loading, error, login, logout, refreshMe, switchCamp, switchEnrollment }),
    [user, campId, camps, loading, error, login, logout, refreshMe, switchCamp, switchEnrollment],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
