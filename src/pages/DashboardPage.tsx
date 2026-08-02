import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";

function Inner() {
  const { user } = useAuth();
  const first = user?.name?.split(" ")[0] || "friend";

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Command center</p>
        <h1
          style={{
            margin: "0 0 0.4rem",
            fontSize: "clamp(2.1rem,4.4vw,3.1rem)",
            fontFamily: "var(--display)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
          }}
        >
          Hello, {first}.
          <br />
          <span style={{ color: "var(--blood)" }}>What do you need?</span>
        </h1>
        <p className="section-lede">
          Start an emergency match, or stand ready as a donor for Hyderabad families.
        </p>

        <div className="dash-grid">
          <Link to="/request" className="action-card emergency">
            <h3>Emergency request</h3>
            <p>
              Need blood now. AI ranks eligible donors, then blasts Twilio, WhatsApp,
              voice, and email.
            </p>
            <span className="btn btn-secondary" style={{ justifySelf: "start", color: "var(--blood-deep)" }}>
              Start request
            </span>
          </Link>
          <Link to="/donor" className="action-card">
            <h3>Become a donor</h3>
            <p>Add blood group, area, and last donation date so families can find you fast.</p>
            <span className="btn btn-ghost" style={{ justifySelf: "start" }}>
              Update donor profile
            </span>
          </Link>
        </div>

        <div className="panel" style={{ marginTop: "1.2rem" }}>
          <h3 style={{ marginTop: 0 }}>Quick links</h3>
          <div className="cta-row">
            <Link to="/history" className="btn btn-secondary">
              Request history
            </Link>
            <Link to="/profile" className="btn btn-secondary">
              Profile
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function DashboardPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
