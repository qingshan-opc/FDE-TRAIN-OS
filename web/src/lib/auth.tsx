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
import { App } from "antd";
import { ApiError, authApi, setSessionReplacedHandler } from "./api";
import type { AuthMe, Camp, User } from "./types";

interface AuthState {
  user: User | null;
  campId: string | null;
  camps: Camp[];
  loading: boolean;
  error: string | null;
  wxBound: boolean;
  needsWxBind: boolean;
  login: (email: string, password: string, opts?: { campId?: string; remember?: boolean }) => Promise<AuthMe | void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<AuthMe | null>;
  switchCamp: (campId: string) => Promise<void>;
  switchEnrollment: (enrollmentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function learnerNeedsBind(role: string | undefined, wxBound: boolean | undefined, needsFlag: boolean | undefined) {
  if (role !== "learner") return false;
  if (typeof needsFlag === "boolean") return needsFlag;
  if (typeof wxBound === "boolean") return !wxBound;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { message } = App.useApp();
  const [user, setUser] = useState<User | null>(null);
  const [campId, setCampId] = useState<string | null>(null);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wxBound, setWxBound] = useState(true);
  const [needsWxBind, setNeedsWxBind] = useState(false);

  const applyMe = useCallback((me: AuthMe) => {
    setUser(me.user);
    setCampId(me.camp_id);
    setCamps(me.camps || []);
    const bound = me.wx_bound !== false && !me.needs_wx_bind;
    const needs = learnerNeedsBind(me.user.role, me.wx_bound, me.needs_wx_bind);
    setWxBound(bound || me.user.role !== "learner");
    setNeedsWxBind(needs);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setCampId(null);
    setCamps([]);
    setWxBound(true);
    setNeedsWxBind(false);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      applyMe(me);
      setError(null);
      return me;
    } catch (err) {
      clearSession();
      if (!(err instanceof ApiError && err.status === 401)) {
        setError(err instanceof Error ? err.message : "无法获取会话");
      }
      return null;
    }
  }, [applyMe, clearSession]);

  useEffect(() => {
    setSessionReplacedHandler(() => {
      clearSession();
      message.warning("账号已在其他设备登录，当前会话已失效");
    });
    return () => setSessionReplacedHandler(null);
  }, [clearSession, message]);

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

  const login = useCallback(async (email: string, password: string, opts?: { campId?: string; remember?: boolean }) => {
    const res = await authApi.login(email, password, opts?.campId, opts?.remember);
    setUser(res.user);
    setCampId(res.camp_id);
    setCamps(res.camps || []);
    const needs = learnerNeedsBind(res.user.role, res.wx_bound, res.needs_wx_bind);
    setWxBound(!needs);
    setNeedsWxBind(needs);
    setError(null);
    return {
      user: res.user,
      camp_id: res.camp_id,
      camps: res.camps || [],
      wx_bound: res.wx_bound,
      needs_wx_bind: res.needs_wx_bind,
    } satisfies AuthMe;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

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
    () => ({
      user,
      campId,
      camps,
      loading,
      error,
      wxBound,
      needsWxBind,
      login,
      logout,
      refreshMe,
      switchCamp,
      switchEnrollment,
    }),
    [user, campId, camps, loading, error, wxBound, needsWxBind, login, logout, refreshMe, switchCamp, switchEnrollment],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
