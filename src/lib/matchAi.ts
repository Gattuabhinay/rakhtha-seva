import { userKeysForApi } from "@/lib/userKeys";

export type MatchBriefResult = {
  summary: string;
  whatsappTemplate: string;
  banksNote: string;
  source: "openrouter" | "fallback";
};

export async function fetchMatchBrief(input: {
  request: {
    patient_name: string;
    blood_group: string;
    hospital: string;
    city: string;
    area?: string;
    urgency: string;
    units_needed: number;
  };
  topMatches: Array<{
    name: string;
    blood_group: string;
    area: string | null;
    eligible: boolean;
    reason: string;
    rank_score: number;
  }>;
  topBanks: Array<{
    name: string;
    area: string;
    city: string;
    phone: string;
    reason: string;
    rank_score: number;
  }>;
}): Promise<MatchBriefResult> {
  const keys = userKeysForApi();
  const res = await fetch("/api/match-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, apiKey: keys.openrouterApiKey }),
  });

  if (!res.ok) {
    throw new Error("AI brief request failed");
  }

  return (await res.json()) as MatchBriefResult;
}
