import { userKeysStatus } from "@/lib/userKeys";

export type AlertStatus = {
  openrouter: boolean;
  elevenlabs: boolean;
  twilio: boolean;
  resend: boolean;
};

export async function fetchAlertStatus(): Promise<AlertStatus> {
  const res = await fetch("/api/alert-status");
  const localAi = userKeysStatus().openrouter;
  if (!res.ok) {
    return {
      openrouter: localAi,
      elevenlabs: false,
      twilio: false,
      resend: false,
    };
  }
  const remote = (await res.json()) as AlertStatus;
  return {
    // User OpenRouter key OR admin env
    openrouter: remote.openrouter || localAi,
    // Voice + call + email = admin .env only
    elevenlabs: remote.elevenlabs,
    twilio: remote.twilio,
    resend: remote.resend,
  };
}

export async function sendAlertEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string; configured?: boolean }> {
  const res = await fetch("/api/alert-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string; configured?: boolean };
  if (!res.ok) return { ok: false, error: data.error || "Email failed", configured: data.configured };
  return { ok: true, configured: true };
}

export async function placeAutoCall(input: {
  toPhone: string;
  message: string;
  lang?: "en" | "hi";
}): Promise<{ ok: boolean; callSid?: string; status?: string; error?: string; configured?: boolean }> {
  const res = await fetch("/api/place-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    callSid?: string;
    status?: string;
    error?: string;
    configured?: boolean;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "Call failed",
      configured: data.configured,
    };
  }
  return {
    ok: true,
    callSid: data.callSid,
    status: data.status,
    configured: true,
  };
}

/** MVP free-tier safe: call top N eligible donors for this blood need. */
export const BLAST_CALL_LIMIT = 5;

export async function placeAutoCallBlast(input: {
  phones: string[];
  message: string;
  lang?: "en" | "hi";
  limit?: number;
}): Promise<{
  ok: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  configured?: boolean;
  errors: string[];
}> {
  const limit = input.limit ?? BLAST_CALL_LIMIT;
  const phones = [...new Set(input.phones.map((p) => p.trim()).filter(Boolean))].slice(0, limit);
  if (phones.length === 0) {
    return { ok: false, attempted: 0, succeeded: 0, failed: 0, errors: ["No phones"] };
  }

  let succeeded = 0;
  let failed = 0;
  let configured: boolean | undefined;
  const errors: string[] = [];

  for (const toPhone of phones) {
    const result = await placeAutoCall({
      toPhone,
      message: input.message,
      lang: input.lang,
    });
    if (configured === undefined) configured = result.configured;
    if (result.ok) {
      succeeded += 1;
    } else {
      failed += 1;
      if (result.error) errors.push(`${toPhone}: ${result.error}`);
      if (result.configured === false) break; // stop if keys missing
    }
  }

  return {
    ok: succeeded > 0,
    attempted: phones.length,
    succeeded,
    failed,
    configured,
    errors,
  };
}

export function telLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+91${digits}` : digits.startsWith("91") ? `+${digits}` : `+${digits}`;
  return `tel:${e164}`;
}
