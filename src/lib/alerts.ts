import { userKeysStatus } from "@/lib/userKeys";

export type AlertStatus = {
  openrouter: boolean;
  twilio: boolean;
};

export async function fetchAlertStatus(): Promise<AlertStatus> {
  const res = await fetch("/api/alert-status");
  const localAi = userKeysStatus().openrouter;
  if (!res.ok) {
    return { openrouter: localAi, twilio: false };
  }
  const remote = (await res.json()) as AlertStatus;
  return {
    openrouter: remote.openrouter || localAi,
    twilio: remote.twilio,
  };
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

export function telLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+91${digits}` : digits.startsWith("91") ? `+${digits}` : `+${digits}`;
  return `tel:${e164}`;
}
