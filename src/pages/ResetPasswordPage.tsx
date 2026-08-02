import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ensurePasswordRecoverySession,
  friendlyAuthError,
  updatePassword,
} from "@/lib/auth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ensurePasswordRecoverySession();
        if (alive) setReady(true);
      } catch (err) {
        if (alive) {
          setBootError(
            friendlyAuthError(
              err instanceof Error ? err.message : "Could not open reset session",
            ),
          );
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      setInfo("Password updated with Supabase. Redirecting to login…");
      window.setTimeout(() => navigate("/login", { replace: true }), 1100);
    } catch (err) {
      setError(
        friendlyAuthError(err instanceof Error ? err.message : "Could not update password"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-layout">
        <motion.section
          className="panel auth-panel"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="eyebrow">Supabase recovery</p>
          <h1 style={{ margin: "0.25rem 0 0.45rem", fontSize: "2rem" }}>
            Set a new password
          </h1>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            You opened the reset link from your email. Choose a new password for this
            Rakhtha Seva account.
          </p>

          {bootError && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {bootError}
              <div style={{ marginTop: "0.65rem" }}>
                <Link to="/login?mode=forgot" className="btn btn-secondary">
                  Request a new reset email
                </Link>
              </div>
            </div>
          )}

          {!bootError && !ready && (
            <p className="muted">Verifying Supabase reset link…</p>
          )}

          {ready && !bootError && (
            <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
              <label>
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </label>
              {error && <div className="alert alert-error">{error}</div>}
              {info && <div className="alert alert-info">{info}</div>}
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </motion.section>

        <aside className="auth-stage" aria-label="Password reset help">
          <div className="auth-stage-glow" aria-hidden />
          <p className="donor-stage-kicker">Secure recovery</p>
          <h2 className="donor-stage-title">
            Supabase email link
            <em> proves it is you.</em>
          </h2>
          <ol className="donor-stage-steps">
            <li>
              <strong>Inbox</strong>
              <span>Open the latest “Reset password” email</span>
            </li>
            <li>
              <strong>Link</strong>
              <span>Lands here with a one-time recovery session</span>
            </li>
            <li>
              <strong>New password</strong>
              <span>Then login and continue donor / emergency flows</span>
            </li>
          </ol>
          <p className="donor-stage-foot">
            Links expire quickly — if this page errors, request a fresh email from Login.
          </p>
        </aside>
      </div>
    </div>
  );
}
