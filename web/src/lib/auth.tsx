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
import type { AuthMe, AuthPortal, Camp, User } from "./types";

interface AuthState {
  user: User | null;
  campId: string | null;
  camps: Camp[];
  loading: boolean;
  error: string | null;
  wxBound: boolean;
  needsWxBind: boolean;
  profileIncomplete: boolean;
  defaultHome: string;
  portals: AuthPortal[];
  login: (email: string, password: string, opts?: { campId?: string; remember?: boolean }) => Promise<AuthMe | void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<AuthMe | null>;
  switchCamp: (campId: string) => Promise<void>;
  switchEnrollment: (enrollmentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function learnerNeedsBind(role: string | undefined, wxBound: boolean | undefined, needsFlag: boolean | undefined) {
  // Partners are also learners for OA bind when server says needs_wx_bind
  if (role !== "learner" && role !== "partner") return false;
  if (typeof needsFlag === "boolean") return needsFlag;
  if (typeof wxBound === "boolean") return !wxBound;
  return false;
}

function applyPortals(me: AuthMe): { defaultHome: string; portals: AuthPortal[] } {
  const portals = Array.isArray(me.portals) ? me.portals : [];
  const defaultHome =
    (me.default_home || "").trim() ||
    portals.find((p) => p.kind === "learner")?.path ||
    portals[0]?.path ||
    "/app/courses";
  return { defaultHome, portals };
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
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [defaultHome, setDefaultHome] = useState("/app/courses");
  const [portals, setPortals] = useState<AuthPortal[]>([]);

  const applyMe = useCallback((me: AuthMe) => {
    setUser(me.user);
    setCampId(me.camp_id);
    setCamps(me.camps || []);
    const needs = learnerNeedsBind(me.user.role, me.wx_bound, me.needs_wx_bind);
    setWxBound(!needs);
    setNeedsWxBind(needs);
    setProfileIncomplete(
      (me.user.role === "learner" || me.user.role === "partner") && Boolean(me.profile_incomplete),
    );
    const p = applyPortals(me);
    setDefaultHome(p.defaultHome);
    setPortals(p.portals);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setCampId(null);
    setCamps([]);
    setWxBound(true);
    setNeedsWxBind(false);
    setProfileIncomplete(false);
    setDefaultHome("/app/courses");
    setPortals([]);
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
    const me: AuthMe = {
      user: res.user,
      camp_id: res.camp_id,
      camps: res.camps || [],
      wx_bound: res.wx_bound,
      needs_wx_bind: res.needs_wx_bind,
      profile_incomplete: res.profile_incomplete,
      default_home: res.default_home,
      portals: res.portals,
    };
    applyMe(me);
    setError(null);
    return me;
  }, [applyMe]);

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
      profileIncomplete,
      defaultHome,
      portals,
      login,
      logout,
      refreshMe,
      switchCamp,
      switchEnrollment,
    }),
    [
      user,
      campId,
      camps,
      loading,
      error,
      wxBound,
      needsWxBind,
      profileIncomplete,
      defaultHome,
      portals,
      login,
      logout,
      refreshMe,
      switchCamp,
      switchEnrollment,
    ],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
