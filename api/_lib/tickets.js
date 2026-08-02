import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 15 * 60 * 1000;

export function otpSecret(env) {
  return (
    env.OTP_HMAC_SECRET?.trim() ||
    env.TWILIO_AUTH_TOKEN?.trim() ||
    env.TWILIO_OTP_AUTH_TOKEN?.trim() ||
    "rakhtha-seva-otp-dev"
  );
}

export function hashCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

function b64url(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b.toString("base64url");
}

function signPayload(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function mintOtpTicket(secret, phone, code, now = Date.now()) {
  const expiresAt = now + OTP_TTL_MS;
  const body = JSON.stringify({
    typ: "otp",
    phone,
    h: hashCode(code),
    exp: expiresAt,
  });
  const payload = b64url(body);
  return { ticket: `${payload}.${signPayload(secret, payload)}`, expiresAt, code };
}

/** Pending SMS via Twilio Verify — no code stored client-side. */
export function mintSmsPendingTicket(secret, phone, serviceSid, now = Date.now()) {
  const expiresAt = now + OTP_TTL_MS;
  const body = JSON.stringify({
    typ: "sms",
    phone,
    svc: serviceSid || "",
    exp: expiresAt,
  });
  const payload = b64url(body);
  return { ticket: `${payload}.${signPayload(secret, payload)}`, expiresAt };
}

export function readSmsPendingTicket(secret, phone, ticket) {
  const parsed = parseTicket(secret, ticket);
  if (!parsed || parsed.typ !== "sms" || parsed.phone !== phone) return null;
  return { serviceSid: parsed.svc || "" };
}

export function mintSessionToken(secret, phone, now = Date.now()) {
  const expiresAt = now + SESSION_TTL_MS;
  const body = JSON.stringify({ typ: "sess", phone, exp: expiresAt, n: b64url(randomBytes(8)) });
  const payload = b64url(body);
  return { token: `${payload}.${signPayload(secret, payload)}`, expiresAt };
}

function parseTicket(secret, ticket) {
  const [payload, sig] = ticket.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, signPayload(secret, payload))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.typ || !parsed.phone || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return {
      typ: parsed.typ,
      phone: parsed.phone,
      h: parsed.h,
      svc: parsed.svc,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function verifyOtpTicket(secret, phone, code, ticket) {
  const parsed = parseTicket(secret, ticket);
  if (!parsed || parsed.typ !== "otp" || parsed.phone !== phone || !parsed.h) return false;
  return safeEqual(parsed.h, hashCode(String(code).replace(/\D/g, "")));
}

export function verifySessionToken(secret, phone, token) {
  const parsed = parseTicket(secret, token);
  return Boolean(parsed && parsed.typ === "sess" && parsed.phone === phone);
}

export function newOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function toE164India(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (String(phone).trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}
