import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type RakhthaNotification,
} from "@/lib/notifications";

function Inner() {
  const { user } = useAuth();
  const [items, setItems] = useState<RakhthaNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    try {
      setItems(await listMyNotifications(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications");
    }
  }

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Supabase alerts</p>
        <h1
          style={{
            margin: "0 0 0.35rem",
            fontSize: "clamp(1.9rem,4vw,2.7rem)",
            fontFamily: "var(--display)",
            fontWeight: 800,
          }}
        >
          Emergency notifications
        </h1>
        <p className="section-lede">
          When your blood group is needed for a critical emergency — and you accepted
          sharing terms — you get an alert here.
        </p>
        <div className="cta-row" style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => user && void markAllNotificationsRead(user.id).then(refresh)}
          >
            Mark all read
          </button>
          <Link to="/donor" className="btn btn-ghost">
            Donor consent settings
          </Link>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="match-list">
          {items.length === 0 ? (
            <div className="panel muted">No notifications yet.</div>
          ) : (
            items.map((n) => (
              <article key={n.id} className={`match-card ${n.read ? "" : "top"}`}>
                <div className="match-head">
                  <strong>{n.title}</strong>
                  <span className={`badge ${n.read ? "badge-ok" : "badge-blood"}`}>
                    {n.read ? "Read" : "New"}
                  </span>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {n.body}
                </p>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {new Date(n.created_at).toLocaleString()}
                  {n.blood_group ? ` · ${n.blood_group}` : ""}
                  {n.urgency ? ` · ${n.urgency}` : ""}
                </div>
                {!n.read && user && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void markNotificationRead(user.id, n.id).then(refresh)}
                  >
                    Mark read
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function NotificationsPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
