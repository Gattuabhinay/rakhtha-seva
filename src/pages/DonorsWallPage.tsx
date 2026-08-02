import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { isImageUrl, listDonorWall, type DonorWallCard } from "@/lib/donorMedia";
import { ButtonLink } from "@/components/ui";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function cardImage(d: DonorWallCard): string | null {
  if (d.photo_url) return d.photo_url;
  if (d.blood_proof_url && isImageUrl(d.blood_proof_url)) return d.blood_proof_url;
  return null;
}

export function DonorsWallPage() {
  const location = useLocation();
  const justJoined = Boolean(
    (location.state as { justJoined?: boolean } | null)?.justJoined,
  );
  const [rows, setRows] = useState<DonorWallCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await listDonorWall());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load donors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, location.key]);

  useEffect(() => {
    const onFocus = () => void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Our donors</p>
        <h1
          style={{
            margin: "0 0 0.35rem",
            fontSize: "clamp(1.9rem,4vw,2.7rem)",
            fontFamily: "var(--display)",
          }}
        >
          Heroes on standby
        </h1>
        <p className="section-lede">
          Live wall — updates when a donor finishes registration with photo and blood-group
          proof. Phone numbers stay private.
        </p>

        {justJoined && (
          <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
            Welcome to the wall — your photo and details are listed below (refresh if you
            do not see yourself yet).
          </div>
        )}

        <div className="cta-row" style={{ marginBottom: "1.25rem" }}>
          <ButtonLink to="/donor" variant="primary">
            Join as a donor
          </ButtonLink>
          <ButtonLink to="/request" variant="secondary">
            Need blood help
          </ButtonLink>
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Refresh list
          </button>
        </div>

        {!loading && !error && (
          <p className="donor-wall-count">
            <strong>{rows.length}</strong>{" "}
            {rows.length === 1 ? "donor" : "donors"} on the wall
          </p>
        )}

        {loading && <p className="muted">Loading our donors…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && rows.length === 0 && (
          <div className="panel donor-wall-empty">
            <h2 style={{ marginTop: 0, fontFamily: "var(--display)" }}>
              Be the first on the wall
            </h2>
            <p className="muted">
              Complete Be a donor: confirm email → blood-group proof → your photo → Save. You
              appear here with name, location, and blood type.
            </p>
            <Link to="/donor" className="btn btn-primary">
              Register &amp; appear here
            </Link>
          </div>
        )}

        <div className="donor-wall-grid">
          {rows.map((d, i) => {
            const img = cardImage(d);
            const place = [d.area, d.city].filter(Boolean).join(", ") || "Hyderabad";
            return (
              <motion.article
                key={d.id}
                className="donor-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
              >
                <div className="donor-card-photo">
                  {img ? (
                    <img
                      src={img}
                      alt={`${d.full_name} donor`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="donor-card-initials">{initials(d.full_name)}</span>
                  )}
                  {d.blood_group && (
                    <span className="donor-card-group">{d.blood_group}</span>
                  )}
                </div>
                <div className="donor-card-body">
                  <strong title={d.full_name}>{d.full_name}</strong>
                  <span className="donor-card-place" title={place}>
                    {place}
                  </span>
                  <div className="donor-card-meta">
                    <em className="donor-card-badge">Proof attested</em>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
