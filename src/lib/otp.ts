/** Client helpers for phone OTP (Twilio SMS → automatic Twilio voice backup). */

export type OtpChannel = "auto" | "voice" | "sms";

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

export async function fetchOtpStatus(): Promise<{
  twilioOtp: boolean;
  fast2sms: boolean;
  preferredChannel: OtpChannel;
  twilioVoiceBackup: boolean;
}> {
  try {
    const res = await fetch("/api/otp-status");
    const data = (await res.json()) as {
      twilioOtp?: boolean;
      fast2sms?: boolean;
      preferredChannel?: string;
      twilioVoiceBackup?: boolean;
    };
    return {
      twilioOtp: Boolean(data.twilioOtp),
      fast2sms: Boolean(data.fast2sms),
      preferredChannel: "auto",
      twilioVoiceBackup: data.twilioVoiceBackup !== false,
    };
  } catch {
    return {
      twilioOtp: false,
      fast2sms: false,
      preferredChannel: "auto",
      twilioVoiceBackup: true,
    };
  }
}

export async function sendOtp(
  phone: string,
  channel: OtpChannel = "auto",
): Promise<{
  ok: boolean;
  phone?: string;
  channel?: "voice" | "sms";
  expiresInSec?: number;
  otpTicket?: string;
  smsSent?: boolean;
  voiceSent?: boolean;
  usedBackup?: boolean;
  backupReason?: string | null;
  error?: string;
}> {
  const res = await fetch("/api/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, channel }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    phone?: string;
    channel?: string;
    expiresInSec?: number;
    otpTicket?: string;
    smsSent?: boolean;
    voiceSent?: boolean;
    usedBackup?: boolean;
    backupReason?: string | null;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || "Could not send OTP" };
  }
  return {
    ok: true,
    phone: data.phone,
    channel: data.channel === "sms" ? "sms" : "voice",
    expiresInSec: data.expiresInSec,
    otpTicket: data.otpTicket,
    smsSent: data.smsSent === true,
    voiceSent: data.voiceSent === true,
    usedBackup: data.usedBackup === true,
    backupReason: data.backupReason ?? null,
  };
}

export async function verifyOtp(
  phone: string,
  code: string,
  otpTicket: string,
): Promise<{
  ok: boolean;
  phone?: string;
  verifiedToken?: string;
  error?: string;
}> {
  const res = await fetch("/api/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code, otpTicket }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    phone?: string;
    verifiedToken?: string;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Could not verify OTP" };
  return {
    ok: true,
    phone: data.phone,
    verifiedToken: data.verifiedToken,
  };
}

export async function confirmOtpSession(
  phone: string,
  verifiedToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/confirm-otp-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, verifiedToken }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "Verification expired" };
  return { ok: true };
}
