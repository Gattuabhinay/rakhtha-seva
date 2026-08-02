import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { listMyRequests, updateRequestStatus, type EmergencyRequest } from "@/lib/requests";

function Inner() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EmergencyRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      setRows(await listMyRequests(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function setStatus(id: string, status: EmergencyRequest["status"]) {
    if (!user) return;
    await updateRequestStatus(user.id, id, status);
    await refresh();
  }

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">History</p>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "clamp(1.9rem,4vw,2.7rem)", fontFamily: "var(--display)" }}>
          Your requests
        </h1>
        <p className="section-lede">Track open emergencies and mark them fulfilled.</p>
        {loading && <p className="muted">Loading…</p>}
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && rows.length === 0 && (
          <div className="panel">
            <p className="muted" style={{ margin: 0 }}>
              No requests yet. <Link to="/request">Create an emergency request</Link>.
            </p>
          </div>
        )}
        <div className="match-list">
          {rows.map((r) => (
            <article key={r.id} className="match-card">
              <div className="match-head">
                <div>
                  <strong>
                    {r.blood_group} · {r.patient_name}
                  </strong>
                  <div className="muted" style={{ fontSize: "0.9rem" }}>
                    {r.hospital}, {r.city} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="badge badge-blood">{r.status}</span>
              </div>
              {r.ai_summary && <p className="muted">{r.ai_summary}</p>}
              <div className="cta-row">
                {r.status === "open" && (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={() => void setStatus(r.id, "helping")}>
                      Mark helping
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void setStatus(r.id, "fulfilled")}>
                      Mark fulfilled
                    </button>
                  </>
                )}
                {r.status !== "cancelled" && r.status !== "fulfilled" && (
                  <button type="button" className="btn btn-secondary" onClick={() => void setStatus(r.id, "cancelled")}>
                    Cancel
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function HistoryPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
