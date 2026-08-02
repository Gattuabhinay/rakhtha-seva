import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type RakhthaNotification,
} from "@/lib/notifications";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function NotificationBell() {
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RakhthaNotification[]>([]);

  async function refresh() {
    if (!user) return;
    try {
      const rows = await listMyNotifications(user.id);
      setItems(rows);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!ready || !user) return;
    void refresh();
    const t = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(t);
  }, [ready, user?.id]);

  useEffect(() => {
    if (!user || user.id.startsWith("demo-")) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`rakhtha-notif-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "rakhtha_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      return;
    }
  }, [user?.id]);

  if (!ready || !user) return null;

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="notif-wrap">
      <button
        type="button"
        className="notif-bell"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        Alerts
        {unread > 0 ? <span className="notif-dot">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Emergency alerts</strong>
            <button
              type="button"
              className="text-link"
              onClick={() => void markAllNotificationsRead(user.id).then(refresh)}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              No alerts yet. When your blood group is needed, it appears here.
            </p>
          ) : (
            <ul className="notif-list">
              {items.slice(0, 8).map((n) => (
                <li key={n.id} className={n.read ? "" : "unread"}>
                  <button
                    type="button"
                    className="notif-item"
                    onClick={() => void markNotificationRead(user.id, n.id).then(refresh)}
                  >
                    <strong>{n.title}</strong>
                    <span>{n.body}</span>
                    <em>{new Date(n.created_at).toLocaleString()}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="text-link" onClick={() => setOpen(false)}>
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
