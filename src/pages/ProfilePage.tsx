import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { getMyProfile, upsertMyProfile } from "@/lib/auth";
import { UserKeysPanel } from "@/components/UserKeysPanel";

function Inner() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.name || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const p = await getMyProfile(user.id);
        if (p) {
          setFullName(p.full_name);
          setPhone(p.phone || "");
          setCity(p.city || "Hyderabad");
        }
      } catch {
        // ignore
      }
    })();
  }, [user]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await upsertMyProfile(user.id, {
        full_name: fullName.trim(),
        email: user.email,
        phone: phone.trim() || null,
        city: city.trim() || "Hyderabad",
      });
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Profile</p>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "clamp(1.9rem,4vw,2.7rem)", fontFamily: "var(--display)" }}>
          Your Rakhtha Seva profile
        </h1>
        <p className="section-lede">
          Account email is managed by Supabase Auth. AI WhatsApp/match text uses the admin
          OpenRouter key unless you paste your own below. Twilio and ElevenLabs stay admin-only.
        </p>
        <form className="panel form-grid" onSubmit={(e) => void onSave(e)} style={{ maxWidth: 520 }}>
          <label>
            Email
            <input value={user?.email || ""} disabled />
          </label>
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-info">{message}</div>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>

        <UserKeysPanel />
      </motion.div>
    </div>
  );
}

export function ProfilePage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
