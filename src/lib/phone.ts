/** Normalize / display Indian phone numbers for contact fields. */

export function normalizePhoneInput(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return phone.trim();
}

/** Mask for UI: +918309030400 → +91••••••0400 */
export function maskPhoneDisplay(phone: string): string {
  const e164 = normalizePhoneInput(phone);
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 10) return e164 || "your phone";
  const last4 = digits.slice(-4);
  const cc = digits.length >= 12 && digits.startsWith("91") ? "+91" : "+";
  return `${cc}••••••${last4}`;
}
