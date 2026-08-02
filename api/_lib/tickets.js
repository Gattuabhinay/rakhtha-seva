/** Shared phone helpers for Twilio voice alerts (not OTP). */

export function toE164India(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (String(phone || "").trim().startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }
  return String(phone || "").trim();
}
