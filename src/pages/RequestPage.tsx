import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui";
import { BLOOD_GROUPS, URGENCY_OPTIONS, type BloodGroup, type UrgencyId } from "@/lib/brand";
import { createEmergencyRequest } from "@/lib/requests";
import { waMeLink, whatsappAlertMessage, type RankedDonor } from "@/lib/blood";
import { speakText, stopSpeaking } from "@/lib/speak";
import {
  BLAST_CALL_LIMIT,
  fetchAlertStatus,
  placeAutoCall,
  placeAutoCallBlast,
  sendAlertEmail,
  telLink,
  type AlertStatus,
} from "@/lib/alerts";
import {
  ALERT_LANGS,
  buildCallScript,
  buildListenScript,
  type AlertLang,
} from "@/lib/voiceLocales";
import { buildEmergencyEmail } from "@/lib/emailTemplate";
import { openMapsLink, type RankedBloodBank } from "@/lib/bloodBanks";

type ChannelKey = "whatsapp" | "voice" | "call" | "email";
type ChannelState = "idle" | "running" | "done" | "error" | "skipped";

function Inner() {
  const { user } = useAuth();
  const [patientName, setPatientName] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [units, setUnits] = useState(1);
  const [hospital, setHospital] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("Gachibowli");
  const [urgency, setUrgency] = useState<UrgencyId>("urgent");
  const [notes, setNotes] = useState("");
  const [shareConsent, setShareConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [matches, setMatches] = useState<RankedDonor[]>([]);
  const [banks, setBanks] = useState<RankedBloodBank[]>([]);
  const [banksNote, setBanksNote] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<"openrouter" | "fallback" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speakError, setSpeakError] = useState<string | null>(null);
  const [alertLang, setAlertLang] = useState<AlertLang>("en");
  const [alertStatus, setAlertStatus] = useState<AlertStatus | null>(null);
  const [channels, setChannels] = useState<Record<ChannelKey, ChannelState>>({
    whatsapp: "idle",
    voice: "idle",
    call: "idle",
    email: "idle",
  });
  const [channelNotes, setChannelNotes] = useState<Record<ChannelKey, string>>({
    whatsapp: "",
    voice: "",
    call: "",
    email: "",
  });
  const [blasting, setBlasting] = useState(false);

  useEffect(() => {
    void fetchAlertStatus().then(setAlertStatus);
  }, []);

  const eligible = useMemo(() => matches.filter((m) => m.eligible), [matches]);
  const topDonor = eligible[0] ?? null;

  function fillJudgeDemo() {
    setPatientName("Ananya Reddy");
    setBloodGroup("O-");
    setUnits(2);
    setHospital("Care Hospitals, Hitech City");
    setCity("Hyderabad");
    setArea("Gachibowli");
    setUrgency("critical");
    setNotes("OT running — rare O− needed for trauma. Judges demo scenario.");
    setShareConsent(true);
    setError(null);
  }

  function setChannel(key: ChannelKey, state: ChannelState, note = "") {
    setChannels((c) => ({ ...c, [key]: state }));
    setChannelNotes((n) => ({ ...n, [key]: note }));
  }

  async function onListenBrief() {
    if (!summary) return;
    setSpeakError(null);
    setSpeaking(true);
    setChannel("voice", "running");
    try {
      const spoken = buildListenScript({
        lang: alertLang,
        summary,
        topDonorName: topDonor?.full_name,
        topDonorGroup: topDonor?.blood_group,
        topDonorArea: topDonor?.area || topDonor?.city,
      });
      const result = await speakText(spoken, { lang: alertLang });
      setChannel(
        "voice",
        "done",
        result.source === "elevenlabs"
          ? `ElevenLabs played AI brief (${alertLang === "hi" ? "Hindi" : "English"})`
          : `Browser voice played (${alertLang === "hi" ? "Hindi" : "English"}) — set ELEVENLABS_VOICE_ID to your own free voice for real ElevenLabs`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Voice failed";
      setSpeakError(msg);
      setChannel("voice", "error", msg);
    } finally {
      setSpeaking(false);
    }
  }

  function onStopListen() {
    stopSpeaking();
    setSpeaking(false);
    setChannel("voice", "idle");
  }

  function openWhatsAppTop() {
    if (!topDonor) {
      setChannel("whatsapp", "skipped", "No eligible donor");
      return;
    }
    const msg = whatsappAlertMessage({
      donorName: topDonor.full_name,
      patientName,
      bloodGroup,
      hospital,
      city,
      urgency,
      units,
      template: whatsappTemplate,
    });
    window.open(waMeLink(topDonor.phone, msg), "_blank", "noopener,noreferrer");
    setChannel("whatsapp", "done", `Opened chat with ${topDonor.full_name}`);
  }

  function blastVoiceLine() {
    return buildCallScript({
      lang: alertLang,
      patientName,
      bloodGroup,
      units,
      hospital,
      city,
    });
  }

  async function onAutoCallEligible() {
    const targets = eligible.slice(0, BLAST_CALL_LIMIT);
    if (targets.length === 0) {
      setChannel("call", "skipped", "No eligible donor for this blood group");
      return;
    }
    setChannel("call", "running", `Calling ${targets.length} eligible ${bloodGroup} donors…`);
    const result = await placeAutoCallBlast({
      phones: targets.map((t) => t.phone),
      message: blastVoiceLine(),
      lang: alertLang,
      limit: BLAST_CALL_LIMIT,
    });
    if (result.ok) {
      setChannel(
        "call",
        "done",
        `Twilio called ${result.succeeded}/${result.attempted} eligible (${alertLang === "hi" ? "Hindi" : "English"}) for ${bloodGroup}`,
      );
    } else if (result.configured === false) {
      if (topDonor) window.location.href = telLink(topDonor.phone);
      setChannel(
        "call",
        "error",
        "Twilio keys missing — opened dialer for top donor. Add TWILIO_* to .env.local to blast all eligible.",
      );
    } else {
      setChannel(
        "call",
        "error",
        result.errors[0] || `Calls failed (${result.failed}/${result.attempted})`,
      );
    }
  }

  async function onEmailSummary() {
    if (!user?.email || !summary) {
      setChannel("email", "skipped", "No email / summary");
      return;
    }
    setChannel("email", "running");
    const blastTargets = eligible.slice(0, BLAST_CALL_LIMIT);
    const mail = buildEmergencyEmail({
      to: user.email,
      patientName,
      bloodGroup,
      units,
      hospital,
      city,
      urgency,
      summary,
      requestId,
      donors: blastTargets,
      lang: alertLang,
    });
    const result = await sendAlertEmail(mail);
    if (result.ok) {
      setChannel(
        "email",
        "done",
        `Resend template sent to ${user.email} (${blastTargets.length} donors, ${alertLang === "hi" ? "Hindi" : "English"})`,
      );
    } else {
      setChannel("email", "error", result.error || "Email failed");
    }
  }

  async function onAlertBlast() {
    if (!topDonor || !summary) return;
    setBlasting(true);
    openWhatsAppTop();
    await onListenBrief();
    await onAutoCallEligible();
    await onEmailSummary();
    setBlasting(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setLoading(true);
    setChannels({ whatsapp: "idle", voice: "idle", call: "idle", email: "idle" });
    setChannelNotes({ whatsapp: "", voice: "", call: "", email: "" });
    try {
      const {
        request,
        matches: ranked,
        banks: nearbyBanks,
        banksNote: note,
        whatsappTemplate: waTpl,
        aiSource: source,
      } = await createEmergencyRequest(user.id, user.email, {
          patient_name: patientName.trim(),
          blood_group: bloodGroup,
          units_needed: units,
          hospital: hospital.trim(),
          city: city.trim() || "Hyderabad",
          area: area.trim(),
          urgency,
          notes: notes.trim(),
          share_consent: shareConsent,
        });
      setRequestId(request.id);
      setSummary(request.ai_summary);
      setMatches(ranked);
      setBanks(nearbyBanks);
      setBanksNote(note || null);
      setWhatsappTemplate(waTpl || null);
      setAiSource(source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create request");
    } finally {
      setLoading(false);
    }
  }

  const statusChip = (on: boolean | undefined, label: string) => (
    <span className={`badge ${on ? "badge-ok" : "badge-no"}`}>{label}: {on ? "ready" : "off"}</span>
  );

  const channelBadge = (state: ChannelState) => {
    if (state === "done") return "badge-ok";
    if (state === "error") return "badge-no";
    if (state === "running") return "badge-blood";
    return "badge-blood";
  };

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">AI healthcare · Blood emergency</p>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "clamp(1.9rem,4vw,2.7rem)", fontFamily: "var(--display)" }}>
          Request blood help
        </h1>
        <p className="section-lede">
          Emergency for blood group X → rank every eligible match → Twilio calls them,
          email logs the blast, ElevenLabs speaks the AI brief. MVP free-tier blast = top{" "}
          {BLAST_CALL_LIMIT} eligible.
        </p>

        <div className="dash-grid">
          <form className="panel form-grid" onSubmit={(e) => void onSubmit(e)}>
            <div className="cta-row" style={{ marginBottom: "0.25rem" }}>
              <Button type="button" variant="secondary" onClick={fillJudgeDemo}>
                Fill judge demo (O− critical)
              </Button>
            </div>
            <label>
              Patient name
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
            </label>
            <div className="two-col">
              <label>
                Blood group needed
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Units
                <input type="number" min={1} max={10} value={units} onChange={(e) => setUnits(Number(e.target.value) || 1)} />
              </label>
            </div>
            <label>
              Hospital / blood bank
              <input value={hospital} onChange={(e) => setHospital(e.target.value)} required placeholder="Care Hospitals, Hitech City" />
            </label>
            <div className="two-col">
              <label>
                City
                <input value={city} onChange={(e) => setCity(e.target.value)} required />
              </label>
              <label>
                Area
                <input value={area} onChange={(e) => setArea(e.target.value)} />
              </label>
            </div>
            <label>
              Urgency
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as UrgencyId)}>
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes (optional)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <label className="consent-box">
              <input
                type="checkbox"
                checked={shareConsent}
                onChange={(e) => setShareConsent(e.target.checked)}
                required
                style={{ width: "auto", marginTop: "0.2rem" }}
              />
              <span>
                I accept the terms: patient need, hospital, blood group, and urgency may be
                shared with matched donors and used for WhatsApp, voice, call, email, and
                Supabase in-app emergency notifications.
              </span>
            </label>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading || !shareConsent}>
              {loading ? "Matching donors…" : "Find donors + AI brief"}
            </button>
          </form>

          <aside className="request-stage" aria-label="How the emergency blast works">
            <div className="request-stage-glow" aria-hidden />
            <div className="request-radar" aria-hidden>
              <span className="request-radar-ring" />
              <span className="request-radar-ring request-radar-ring-2" />
              <span className="request-radar-core">{bloodGroup}</span>
            </div>
            <p className="donor-stage-kicker">Minutes, not hours</p>
            <h2 className="donor-stage-title">
              Every field you fill
              <em> aims the blast.</em>
            </h2>
            <ol className="donor-stage-steps">
              <li>
                <strong>Need</strong>
                <span>
                  {patientName.trim() || "Patient"} · {units} unit
                  {units === 1 ? "" : "s"} · {urgency}
                </span>
              </li>
              <li>
                <strong>Place</strong>
                <span>
                  {[hospital.trim() || "Hospital", area.trim() || city.trim() || "Hyderabad"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
              <li>
                <strong>Blast</strong>
                <span>AI ranks → call · WhatsApp · voice · email</span>
              </li>
            </ol>
            <div className="request-channel-pills">
              {statusChip(alertStatus?.openrouter, "OpenRouter")}
              {statusChip(alertStatus?.elevenlabs, "ElevenLabs")}
              {statusChip(alertStatus?.twilio, "Twilio")}
              {statusChip(alertStatus?.resend, "Resend")}
            </div>
            <p className="donor-stage-foot">
              Call the hospital blood bank first. We coordinate donors — we do not replace clinical care.
            </p>
            <Link to="/donor" className="btn btn-secondary" style={{ justifySelf: "start" }}>
              Be a donor →
            </Link>
          </aside>
        </div>

        {matches.length > 0 && (
          <section className="section alert-center" style={{ paddingTop: "1.5rem" }}>
            <h2>Alert Command Center</h2>
            <p className="section-lede">
              {summary}
              {requestId ? ` · #${requestId.slice(0, 8)}` : ""} · {eligible.length} eligible
              {aiSource ? (
                <>
                  {" · "}
                  <span className={`badge ${aiSource === "openrouter" ? "badge-ok" : "badge-blood"}`}>
                    AI: {aiSource === "openrouter" ? "OpenRouter live" : "local fallback"}
                  </span>
                </>
              ) : null}
            </p>

            <div className="panel alert-blast">
              <div className="lang-row" style={{ marginBottom: "0.85rem" }}>
                <span className="muted" style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                  Voice language (ElevenLabs + Twilio)
                </span>
                <div className="cta-row" style={{ marginTop: "0.4rem" }}>
                  {ALERT_LANGS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`btn ${alertLang === l.id ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setAlertLang(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.82rem" }}>
                  Final MVP: English + Hindi on Flash v2.5. Telugu needs Eleven v3 later — not claimed today.
                </p>
              </div>
              <div className="alert-blast-head">
                <div>
                  <strong>Fire the {bloodGroup} emergency blast</strong>
                  <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.92rem" }}>
                    WhatsApp (top) → ElevenLabs listen → Twilio calls up to {BLAST_CALL_LIMIT}{" "}
                    eligible {bloodGroup} matches → email receipt to you.
                    {eligible.length
                      ? ` ${Math.min(eligible.length, BLAST_CALL_LIMIT)} donors ready to call.`
                      : " No eligible donor yet."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!topDonor || blasting}
                  onClick={() => void onAlertBlast()}
                >
                  {blasting
                    ? "Blasting donors…"
                    : `Blast ${Math.min(eligible.length, BLAST_CALL_LIMIT) || 0} eligible donors`}
                </Button>
              </div>

              <div className="channel-grid">
                {(
                  [
                    ["whatsapp", "WhatsApp", "AI template to top match"],
                    ["voice", "Listen", "ElevenLabs speaks AI brief"],
                    ["call", "Twilio blast", `Call all eligible (max ${BLAST_CALL_LIMIT})`],
                    ["email", "Email", "Resend emergency receipt"],
                  ] as const
                ).map(([key, title, sub]) => (
                  <div key={key} className="channel-card">
                    <div className="match-head">
                      <div>
                        <strong>{title}</strong>
                        <div className="muted" style={{ fontSize: "0.85rem" }}>{sub}</div>
                      </div>
                      <span className={`badge ${channelBadge(channels[key])}`}>{channels[key]}</span>
                    </div>
                    {channelNotes[key] ? (
                      <p className="muted" style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>
                        {channelNotes[key]}
                      </p>
                    ) : null}
                    <div className="cta-row" style={{ marginTop: "0.65rem" }}>
                      {key === "whatsapp" && (
                        <Button type="button" variant="primary" disabled={!topDonor} onClick={openWhatsAppTop}>
                          Open WhatsApp
                        </Button>
                      )}
                      {key === "voice" && (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => void onListenBrief()}
                            disabled={speaking || !summary}
                          >
                            {speaking ? "Speaking…" : "Listen"}
                          </Button>
                          {speaking && (
                            <Button type="button" variant="secondary" onClick={onStopListen}>
                              Stop
                            </Button>
                          )}
                        </>
                      )}
                      {key === "call" && (
                        <Button
                          type="button"
                          variant="primary"
                          disabled={!topDonor || channels.call === "running"}
                          onClick={() => void onAutoCallEligible()}
                        >
                          {channels.call === "running"
                            ? "Calling eligible…"
                            : `Call ${Math.min(eligible.length, BLAST_CALL_LIMIT)} eligible`}
                        </Button>
                      )}
                      {key === "email" && (
                        <Button
                          type="button"
                          variant="primary"
                          disabled={!summary || channels.email === "running"}
                          onClick={() => void onEmailSummary()}
                        >
                          {channels.email === "running" ? "Sending…" : "Email me summary"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {speakError && <div className="alert alert-error" style={{ marginTop: "0.85rem" }}>{speakError}</div>}
            </div>

            {banks.length > 0 && (
              <div style={{ marginTop: "1.75rem" }}>
                <h3 style={{ margin: "0 0 0.4rem" }}>Nearby blood banks</h3>
                <p className="section-lede" style={{ marginBottom: "0.85rem" }}>
                  {banksNote}
                  {aiSource ? (
                    <>
                      {" · "}
                      <span className={`badge ${aiSource === "openrouter" ? "badge-ok" : "badge-blood"}`}>
                        AI banks: {aiSource === "openrouter" ? "OpenRouter live" : "local"}
                      </span>
                    </>
                  ) : null}
                </p>
                <p className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.4rem" }}>
                  Directory suggestions — call to confirm {bloodGroup} stock. Not live inventory.
                </p>
                <div className="match-list" style={{ marginTop: "0.85rem" }}>
                  {banks.map((b, idx) => (
                    <article key={b.id} className={`match-card ${idx === 0 ? "top" : ""}`}>
                      <div className="match-head">
                        <div>
                          <strong>{b.name}</strong>
                          <div className="muted" style={{ fontSize: "0.9rem" }}>
                            {b.area}, {b.city} · {b.phone}
                          </div>
                        </div>
                        <div className="score">{b.rank_score}</div>
                      </div>
                      <p className="muted" style={{ margin: 0 }}>
                        {b.reason}
                      </p>
                      <div className="cta-row">
                        <a className="btn btn-primary" href={telLink(b.phone)}>
                          Call bank
                        </a>
                        <a
                          className="btn btn-secondary"
                          href={openMapsLink(b)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Maps
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <h3 style={{ marginTop: "1.75rem" }}>Ranked donors</h3>
            <div className="match-list">
              {matches.slice(0, 10).map((m, idx) => {
                const msg = whatsappAlertMessage({
                  donorName: m.full_name,
                  patientName,
                  bloodGroup,
                  hospital,
                  city,
                  urgency,
                  units,
                  template: whatsappTemplate,
                });
                return (
                  <article key={`${m.id}-${idx}`} className={`match-card ${idx < 3 && m.eligible ? "top" : ""}`}>
                    <div className="match-head">
                      <div>
                        <strong>{m.full_name}</strong>
                        <div className="muted" style={{ fontSize: "0.9rem" }}>
                          {m.area || m.city} · {m.phone}
                        </div>
                      </div>
                      <div className="score">{m.rank_score}</div>
                    </div>
                    <div className="cta-row">
                      <span className="badge badge-blood">{m.blood_group}</span>
                      <span className={`badge ${m.eligible ? "badge-ok" : "badge-no"}`}>
                        {m.eligible ? "Eligible now" : "Not eligible yet"}
                      </span>
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      {m.reason}
                    </p>
                    {m.eligible && (
                      <div className="cta-row">
                        <a className="btn btn-primary" href={waMeLink(m.phone, msg)} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                        <a className="btn btn-secondary" href={telLink(m.phone)}>
                          Dial
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            void placeAutoCall({
                              toPhone: m.phone,
                              message: blastVoiceLine(),
                              lang: alertLang,
                            }).then((r) => {
                              if (!r.ok && r.configured === false) window.location.href = telLink(m.phone);
                            })
                          }
                        >
                          Auto-call
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}

export function RequestPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
