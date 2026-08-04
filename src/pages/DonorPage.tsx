import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { CameraCapture, requestCameraStream, stopCameraStream } from "@/components/CameraCapture";
import { getMyProfile, upsertMyProfile, type RakhthaProfile } from "@/lib/auth";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/brand";
import { normalizePhoneInput } from "@/lib/phone";
import { uploadDonorMedia } from "@/lib/donorMedia";
import { Link, useNavigate } from "react-router-dom";

type MediaKind = "photo" | "proof";

function MediaPickers({
  kind,
  busy,
  onPick,
}: {
  kind: MediaKind;
  busy: boolean;
  onPick: (kind: MediaKind, file: File | null) => void;
}) {
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    kind === "photo" ? "user" : "environment",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputId = `donor-gallery-${kind}`;
  const nativeCameraId = `donor-native-camera-${kind}`;
  const galleryAccept = kind === "photo" ? "image/*" : "image/*,application/pdf,.pdf";

  function closeCamera() {
    stopCameraStream(cameraStream);
    setCameraStream(null);
    setCameraOpen(false);
    setCameraError(null);
  }

  async function onOpenCamera() {
    if (busy) return;
    setCameraError(null);
    const facing = kind === "photo" ? "user" : "environment";
    setCameraFacing(facing);

    // Must call getUserMedia HERE (button tap) so browser shows "Allow camera?" prompt.
    try {
      stopCameraStream(cameraStream);
      const stream = await requestCameraStream(facing);
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      // Fallback: native phone camera app (also shows system permission)
      nativeCameraRef.current?.click();
    }
  }

  async function onFlipCamera() {
    const next = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(next);
    setCameraError(null);
    try {
      stopCameraStream(cameraStream);
      const stream = await requestCameraStream(next);
      setCameraStream(stream);
    } catch {
      setCameraError("Could not switch camera. Tap Allow, or use gallery.");
    }
  }

  function onNativeCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (file) onPick(kind, file);
  }

  function onGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (file) onPick(kind, file);
  }

  return (
    <div className="media-pick-row">
      <input
        id={nativeCameraId}
        ref={nativeCameraRef}
        type="file"
        accept="image/*"
        capture={kind === "photo" ? "user" : "environment"}
        className="media-file-input"
        onChange={onNativeCameraChange}
      />
      <input
        id={inputId}
        ref={galleryRef}
        type="file"
        accept={galleryAccept}
        className="media-file-input"
        onChange={onGalleryChange}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => void onOpenCamera()}
      >
        {busy ? "Uploading…" : "Open camera"}
      </button>
      <p className="camera-permit-hint">
        Tap Open camera — your browser will ask <strong>Allow</strong> to use the camera.
      </p>
      <label htmlFor={inputId} className={`btn btn-secondary${busy ? " btn-disabled" : ""}`}>
        {busy ? "Uploading…" : kind === "proof" ? "Gallery / PDF" : "Choose from gallery"}
      </label>
      <CameraCapture
        open={cameraOpen}
        title={kind === "photo" ? "Donor photo — camera" : "Blood-group proof — camera"}
        stream={cameraStream}
        facing={cameraFacing}
        error={cameraError}
        onClose={closeCamera}
        onFlip={() => void onFlipCamera()}
        onCapture={(file) => onPick(kind, file)}
      />
    </div>
  );
}

function Inner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "proof" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<RakhthaProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [area, setArea] = useState("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [available, setAvailable] = useState(true);
  const [lastDonation, setLastDonation] = useState("");
  const [consent, setConsent] = useState(false);
  const [commitment, setCommitment] = useState(false);
  const [proofAttest, setProofAttest] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const p = await getMyProfile(user.id);
        setProfile(p);
        setFullName(p?.full_name || user.name);
        setPhone(p?.phone || "");
        setCity(p?.city || "Hyderabad");
        setArea(p?.area || "");
        setBloodGroup((p?.blood_group as BloodGroup) || "");
        setAvailable(p?.available ?? true);
        setLastDonation(p?.last_donation_date || "");
        setConsent(Boolean(p?.emergency_consent));
        setPhotoUrl(p?.photo_url || null);
        setProofUrl(p?.blood_proof_url || null);
        setProofAttest(Boolean(p?.blood_attested_at));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function onUpload(kind: "photo" | "proof", file: File | null) {
    if (!user || !file) return;
    setUploading(kind);
    setError(null);
    try {
      const url = await uploadDonorMedia(user.id, kind, file);
      if (kind === "photo") setPhotoUrl(url);
      else setProofUrl(url);
      setMessage(kind === "photo" ? "Photo uploaded." : "Blood-group proof uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!bloodGroup) throw new Error("Select your blood group.");
      if (!phone.trim()) throw new Error("Phone is required for emergency contact.");
      if (!consent) {
        throw new Error(
          "Please tick the sharing consent box — your details may be shared for emergency matching and alerts.",
        );
      }
      if (!commitment) {
        throw new Error("Please confirm you will be reachable for this blood group emergencies.");
      }
      if (!proofUrl) {
        throw new Error("Upload blood-group proof (donor card / donation slip / lab report).");
      }
      if (!proofAttest) {
        throw new Error("Confirm that your uploaded proof shows this blood group.");
      }
      if (!photoUrl) {
        throw new Error("Add your photo (camera or gallery) — it appears on Our Donors.");
      }

      const e164 = normalizePhoneInput(phone);
      const verifiedAt = new Date().toISOString();
      await upsertMyProfile(user.id, {
        full_name: fullName.trim() || user.name,
        email: user.email,
        phone: phone.trim(),
        phone_e164: e164,
        // Contact on file for an email-confirmed Supabase account (no SMS OTP).
        phone_verified_at: verifiedAt,
        city: city.trim() || "Hyderabad",
        area: area.trim() || null,
        blood_group: bloodGroup,
        is_donor: true,
        available,
        last_donation_date: lastDonation || null,
        emergency_consent: true,
        consent_accepted_at: verifiedAt,
        photo_url: photoUrl,
        blood_proof_url: proofUrl,
        blood_proof_status: "uploaded",
        blood_attested_at: verifiedAt,
        show_on_donor_wall: true,
      });
      const nextProfile: RakhthaProfile = {
        id: user.id,
        full_name: fullName.trim() || user.name,
        email: user.email,
        phone: phone.trim(),
        phone_e164: e164,
        phone_verified_at: verifiedAt,
        city: city.trim() || "Hyderabad",
        area: area.trim() || null,
        blood_group: bloodGroup,
        is_donor: true,
        available,
        last_donation_date: lastDonation || null,
        emergency_consent: true,
        photo_url: photoUrl,
        blood_proof_url: proofUrl,
        blood_proof_status: "uploaded",
        blood_attested_at: verifiedAt,
        show_on_donor_wall: true,
      };
      setProfile(nextProfile);
      try {
        sessionStorage.setItem(
          "rakhtha_donor_wall_ping",
          JSON.stringify({ at: Date.now(), id: user.id }),
        );
      } catch {
        // ignore
      }
      setMessage("Saved — your photo & details are live on Our Donors…");
      window.setTimeout(() => navigate("/donors", { state: { justJoined: true } }), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="shell section">
        <p className="muted">Loading donor profile…</p>
      </div>
    );
  }

  const canSave =
    consent &&
    commitment &&
    proofAttest &&
    Boolean(phone.trim()) &&
    Boolean(bloodGroup) &&
    Boolean(proofUrl) &&
    Boolean(photoUrl);

  return (
    <div className="shell section">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Donor</p>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "clamp(1.9rem,4vw,2.7rem)", fontFamily: "var(--display)" }}>
          Be ready to help
        </h1>
        <p className="section-lede">
          Your account is verified by Supabase email confirmation. Add phone for emergency
          contact, prove your blood group, then save — no SMS OTP.
        </p>

        <div className="dash-grid donor-layout">
        <form className="panel form-grid" onSubmit={(e) => void onSave(e)}>
          <div className="alert alert-info">
            <strong>Email-confirmed account</strong> ({user?.email}). Phone is for WhatsApp /
            call alerts only — ownership is your confirmed email login, not SMS.
          </div>

          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>
            Phone (WhatsApp / emergency contact)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="8309030400"
            />
          </label>

          <label>
            Blood group
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)} required>
              <option value="">Select</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <div className="proof-block">
            <p className="proof-block-title">Prove this blood group</p>
            <p className="muted" style={{ margin: "0 0 0.55rem", fontSize: "0.88rem" }}>
              Use the camera or gallery for your donor card, donation slip, or lab report
              showing <strong>{bloodGroup || "your group"}</strong>. Hospital still confirms
              before transfusion — this is your attested proof.
            </p>
            <MediaPickers
              kind="proof"
              busy={uploading === "proof"}
              onPick={(k, f) => void onUpload(k, f)}
            />
            {proofUrl && (
              <a className="proof-link" href={proofUrl} target="_blank" rel="noreferrer">
                View uploaded proof
              </a>
            )}
            <label className="consent-box" style={{ marginTop: "0.65rem" }}>
              <input
                type="checkbox"
                checked={proofAttest}
                onChange={(e) => setProofAttest(e.target.checked)}
                required
                style={{ width: "auto", marginTop: "0.2rem" }}
              />
              <span>
                I confirm this document shows my blood group as{" "}
                <strong>{bloodGroup || "selected above"}</strong> and is mine.
              </span>
            </label>
          </div>

          <div className="proof-block">
            <p className="proof-block-title">Your photo for Our Donors</p>
            <p className="muted" style={{ margin: "0 0 0.55rem", fontSize: "0.88rem" }}>
              Tap <strong>Open camera</strong> (live selfie) or <strong>Choose from gallery</strong>.
              We square-crop so your card on <Link to="/donors">Our Donors</Link> stays
              perfect. Phone stays private.
            </p>
            <MediaPickers
              kind="photo"
              busy={uploading === "photo"}
              onPick={(k, f) => void onUpload(k, f)}
            />
            {photoUrl && (
              <>
                <img className="donor-photo-preview" src={photoUrl} alt="Your donor photo" />
                <p className="donor-photo-frame-hint">
                  Preview = exact square frame used on the donor wall.
                </p>
              </>
            )}
            <div className="alert alert-info" style={{ marginTop: "0.65rem" }}>
              After save you appear on <Link to="/donors">Our Donors</Link> with photo, name,
              location, and blood group. Phone stays private.
            </div>
          </div>

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
            Last donation date
            <input type="date" value={lastDonation} onChange={(e) => setLastDonation(e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              style={{ width: "auto", marginTop: "0.2rem" }}
            />
            <span>I am available for emergency requests right now</span>
          </label>
          <label className="consent-box">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              style={{ width: "auto", marginTop: "0.2rem" }}
            />
            <span>
              I accept the terms: Rakhtha Seva may share my name, phone, blood group, and
              area with emergency requesters and alert channels (WhatsApp / call /
              in-app notification) when my blood type is needed. I can turn off availability
              anytime.
            </span>
          </label>
          <label className="consent-box">
            <input
              type="checkbox"
              checked={commitment}
              onChange={(e) => setCommitment(e.target.checked)}
              required
              style={{ width: "auto", marginTop: "0.2rem" }}
            />
            <span>
              I confirm this is my contact phone and I am willing to be reached for this blood
              group in emergencies. I understand I stay listed until I turn off availability.
            </span>
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-info">{message}</div>}
          {profile?.is_donor && profile.emergency_consent && (
            <div className="alert alert-warn">
              You are a registered donor{profile.blood_group ? ` (${profile.blood_group})` : ""}.
              Critical needs for your group will notify you in Alerts.
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={saving || !canSave}>
            {saving ? "Saving…" : "Save donor profile"}
          </button>
          {!canSave && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Complete: phone → blood-group proof + attest → photo → consents → Save. Then you
              show on Our Donors.
            </p>
          )}
        </form>

        <aside className="donor-stage" aria-label="Why your registration matters">
          <div className="donor-stage-glow" aria-hidden />
          <div className="donor-drop" aria-hidden>
            <span className="donor-drop-pulse" />
            <svg viewBox="0 0 80 110" className="donor-drop-svg">
              <path
                d="M40 8 C40 8 12 48 12 68 C12 88 24 102 40 102 C56 102 68 88 68 68 C68 48 40 8 40 8 Z"
                fill="url(#dropGrad)"
              />
              <path
                d="M28 62 Q40 52 52 62 Q40 72 28 62"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#9f1239" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <p className="donor-stage-kicker">One unit. One tomorrow.</p>
          <h2 className="donor-stage-title">
            Your blood group is not just a label —
            <em> it is someone&apos;s chance.</em>
          </h2>
          <ol className="donor-stage-steps">
            <li>
              <strong>Confirm</strong>
              <span>Supabase email proves your account</span>
            </li>
            <li>
              <strong>Match</strong>
              <span>AI ranks you when your group is needed</span>
            </li>
            <li>
              <strong>Alert</strong>
              <span>Call · WhatsApp · in-app — minutes matter</span>
            </li>
          </ol>
          <p className="donor-stage-foot">
            {bloodGroup
              ? `${bloodGroup} donors like you keep Hyderabad emergencies moving.`
              : "Pick your blood group on the left — then stand ready."}
          </p>
          <Link to="/donors" className="btn btn-secondary" style={{ justifySelf: "start" }}>
            See Our Donors →
          </Link>
        </aside>
        </div>
      </motion.div>
    </div>
  );
}

export function DonorPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
