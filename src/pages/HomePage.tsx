import { motion } from "framer-motion";
import { ButtonLink } from "@/components/ui";
import { HeartHero } from "@/components/HeartHero";
import { BRAND } from "@/lib/brand";

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-bleed" aria-hidden />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              AI for Healthcare · Blood emergency seva
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.55 }}
            >
              {BRAND.name}
              <br />
              <em>when minutes</em>
              <br />
              decide life.
            </motion.h1>
            <motion.p
              className="hero-lede"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              AI finds eligible donors for the blood group you need — then alerts
              them by call, WhatsApp, and voice, while nearby blood banks open
              on Maps.
            </motion.p>
            <motion.div
              className="cta-row"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
            >
              <ButtonLink to="/login?mode=register" variant="primary">
                Start emergency request
              </ButtonLink>
              <ButtonLink to="/login" variant="secondary">
                Login
              </ButtonLink>
            </motion.div>
          </div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12, duration: 0.7 }}
          >
            <HeartHero />
            <motion.p
              className="hero-heart-quote"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.55 }}
            >
              Your blood group could be the reason someone{" "}
              <em>sees tomorrow.</em>
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="shell">
          <h2>From panic to the right help</h2>
          <p className="section-lede">
            Not a blood bank. Not a hospital system. The missing layer between a
            family in crisis and the donors and banks who can act.
          </p>
          <div className="steps">
            {[
              ["01", "Request", "Share blood group, hospital, and how soon you need help."],
              ["02", "AI match", "Rank eligible donors by compatibility, readiness, and area."],
              ["03", "Alert + banks", "Call donors. Open Maps to nearby banks. WhatsApp and voice close the loop."],
            ].map(([num, title, body]) => (
              <article className="step" key={num}>
                <span className="step-num">{num}</span>
                <strong>{title}</strong>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div className="win-band">
            <h2>Meet Our Donors</h2>
            <p>
              Real people who verified their phone and attested their blood group with
              proof — standing ready so a stranger can see tomorrow.
            </p>
            <div className="cta-row">
              <ButtonLink to="/donors" variant="primary">
                See Our Donors
              </ButtonLink>
              <ButtonLink to="/login?next=/donor" variant="secondary">
                Join the wall
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="shell">
          <div className="win-band">
            <h2>AI for public health impact</h2>
            <p>
              Rank eligible donors, alert via WhatsApp, Twilio calls your registered phone.
              calls, and guide families to nearby blood banks — built for Hyderabad
              emergencies when every minute matters.
            </p>
            <div className="cta-row">
              <ButtonLink to="/login?next=/request" variant="ghost">
                Create emergency request
              </ButtonLink>
              <ButtonLink to="/login?next=/donor" variant="secondary">
                Register as donor
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
