import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AuthUser,
  type RegisterResult,
  getSessionUser,
  login as loginUser,
  loginAsDemo as loginAsDemoUser,
  logout as logoutUser,
  markPasswordRecovery,
  register as registerUser,
  requestPasswordReset as requestPasswordResetUser,
} from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    async function boot() {
      try {
        const sessionUser = await getSessionUser();
        if (mounted) setUser(sessionUser);
      } finally {
        if (mounted) setReady(true);
      }
    }

    void boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecovery();
        if (typeof window !== "undefined" && !window.location.pathname.includes("/reset-password")) {
          window.location.assign("/reset-password");
          return;
        }
      }
      const sessionUser = await getSessionUser();
      if (mounted) setUser(sessionUser);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await loginUser(email, password));
  }, []);

  const loginAsDemo = useCallback(async () => {
    setUser(await loginAsDemoUser());
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await registerUser(name, email, password);
      if (result.status === "signed_in") setUser(result.user);
      return result;
    },
    [],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    await requestPasswordResetUser(email);
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      loginAsDemo,
      register,
      requestPasswordReset,
      logout,
    }),
    [user, ready, login, loginAsDemo, register, requestPasswordReset, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
