import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { Button, Panel } from "@/components/ui";
import { DEMO_ACCOUNT, friendlyAuthError, isPasswordRecoveryPending } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

type AuthMode = "login" | "register" | "forgot";

export function LoginPage() {
  const { login, loginAsDemo, register, requestPasswordReset, user, ready } =
    useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPath = params.get("next") || "/dashboard";
  const modeParam = params.get("mode");
  const initialMode: AuthMode =
    modeParam === "register" ? "register" : modeParam === "forgot" ? "forgot" : "login";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  useEffect(() => setMode(initialMode), [initialMode]);

  useEffect(() => {
    if (!ready || !user) return;
    if (mode === "forgot") return;
    if (isPasswordRecoveryPending()) {
      navigate("/reset-password", { replace: true });
      return;
    }
    navigate(nextPath.startsWith("/") ? nextPath : "/dashboard", { replace: true });
  }, [ready, user, navigate, nextPath, mode]);

  const title = useMemo(() => {
    if (mode === "login") return `Welcome back to ${BRAND.name}`;
    if (mode === "register") return "Create your Rakhtha Seva account";
    return "Forgot password";
  }, [mode]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setResetSentTo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email);
        const clean = email.trim().toLowerCase();
        setResetSentTo(clean);
        setInfo(
          `Supabase sent a reset link to ${clean}. Open that email, tap the link, then set a new password on the reset page.`,
        );
        return;
      }
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      navigate(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : "Could not continue"));
    } finally {
      setLoading(false);
    }
  }

  async function onDemoEnter() {
    setLoading(true);
    setError(null);
    try {
      await loginAsDemo();
      navigate(nextPath.startsWith("/") ? nextPath : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Panel className="auth-panel">
            <p className="eyebrow">Supabase Auth</p>
            <h1 style={{ margin: "0.25rem 0 0.45rem", fontSize: "2rem", color: "var(--ink)" }}>
              {title}
            </h1>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              {mode === "forgot"
                ? "We’ll email you a Supabase reset link. Open it to choose a new password — then login again."
                : "Secure login with Supabase. Use the demo account to try an emergency match."}
            </p>

            {mode !== "forgot" && (
              <div className="cta-row" style={{ marginBottom: "1rem" }}>
                <Button
                  type="button"
                  variant={mode === "login" ? "primary" : "secondary"}
                  onClick={() => switchMode("login")}
                >
                  Login
                </Button>
                <Button
                  type="button"
                  variant={mode === "register" ? "primary" : "secondary"}
                  onClick={() => switchMode("register")}
                >
                  Register
                </Button>
              </div>
            )}

            <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
              {mode === "register" && (
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                />
              </label>
              {mode !== "forgot" && (
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </label>
              )}

              {mode === "login" && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
              )}

              {error && <div className="alert alert-error">{error}</div>}
              {info && <div className="alert alert-info">{info}</div>}

              <Button variant="primary" type="submit" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "forgot"
                    ? "Send reset email"
                    : mode === "login"
                      ? "Login"
                      : "Create account"}
              </Button>
            </form>

            {mode === "forgot" ? (
              <div style={{ marginTop: "1rem" }}>
                {resetSentTo && (
                  <p className="muted" style={{ fontSize: "0.88rem", marginBottom: "0.65rem" }}>
                    Tip: check spam. Link opens <code>/reset-password</code> on this same site.
                  </p>
                )}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => switchMode("login")}
                >
                  ← Back to login
                </button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  style={{ width: "100%", marginTop: "1rem" }}
                  onClick={() => void onDemoEnter()}
                  disabled={loading}
                >
                  Enter with demo · {DEMO_ACCOUNT.email}
                </Button>
                <p className="muted" style={{ marginTop: "0.7rem", fontSize: "0.85rem" }}>
                  Password: {DEMO_ACCOUNT.password}
                </p>
              </>
            )}
          </Panel>
        </motion.div>

        <aside className="auth-stage" aria-label="How account security works">
          <div className="auth-stage-glow" aria-hidden />
          <p className="donor-stage-kicker">
            {mode === "forgot" ? "Forgot password" : "Your seva identity"}
          </p>
          <h2 className="donor-stage-title">
            {mode === "forgot" ? (
              <>
                One email from Supabase
                <em> unlocks a new password.</em>
              </>
            ) : (
              <>
                Login once —
                <em> donors &amp; alerts stay yours.</em>
              </>
            )}
          </h2>
          <ol className="donor-stage-steps">
            {mode === "forgot" ? (
              <>
                <li>
                  <strong>Send</strong>
                  <span>Supabase emails a one-time reset link</span>
                </li>
                <li>
                  <strong>Open</strong>
                  <span>Link brings you to Set a new password</span>
                </li>
                <li>
                  <strong>Login</strong>
                  <span>Use the new password — demo account stays separate</span>
                </li>
              </>
            ) : (
              <>
                <li>
                  <strong>Register</strong>
                  <span>Real email → donor wall + emergency requests</span>
                </li>
                <li>
                  <strong>Forgot?</strong>
                  <span>Reset via Supabase email — never share passwords</span>
                </li>
                <li>
                  <strong>Demo</strong>
                  <span>Judges can enter without creating an account</span>
                </li>
              </>
            )}
          </ol>
          <p className="donor-stage-foot">
            {mode === "forgot"
              ? "Use the email you registered with — not the demo inbox."
              : "Wrong password? Tap Forgot password under the field."}
          </p>
        </aside>
      </div>
    </div>
  );
}
