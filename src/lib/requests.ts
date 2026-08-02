import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  rankDonors,
  type RankableDonor,
  type RankedDonor,
} from "@/lib/blood";
import type { BloodGroup, UrgencyId } from "@/lib/brand";
import { isDemoUser } from "@/lib/auth";
import { fetchMatchBrief } from "@/lib/matchAi";
import {
  fallbackBanksNote,
  rankNearbyBanks,
  type RankedBloodBank,
} from "@/lib/bloodBanks";
import { compatibleDonorGroups } from "@/lib/blood";
import { notifyConsentedDonors } from "@/lib/notifications";

export type EmergencyRequestInput = {
  patient_name: string;
  blood_group: BloodGroup;
  units_needed: number;
  hospital: string;
  city: string;
  area?: string;
  urgency: UrgencyId;
  notes?: string;
  share_consent: boolean;
};

export type EmergencyRequest = EmergencyRequestInput & {
  id: string;
  requester_id: string;
  status: "open" | "helping" | "fulfilled" | "cancelled";
  ai_summary: string | null;
  created_at: string;
};

export type CreateRequestResult = {
  request: EmergencyRequest;
  matches: RankedDonor[];
  banks: RankedBloodBank[];
  banksNote: string;
  whatsappTemplate: string;
  aiSource: "openrouter" | "fallback";
};

const LOCAL_REQUESTS_KEY = "rakhtha_local_requests_v1";

function readLocalRequests(): EmergencyRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_REQUESTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmergencyRequest[];
  } catch {
    return [];
  }
}

function writeLocalRequests(rows: EmergencyRequest[]) {
  localStorage.setItem(LOCAL_REQUESTS_KEY, JSON.stringify(rows));
}

async function loadDonors(): Promise<RankableDonor[]> {
  const supabase = getSupabaseBrowserClient();
  const donors: RankableDonor[] = [];

  try {
    const { data: profiles } = await supabase
      .from("rakhtha_profiles")
      .select(
        "id,full_name,phone,phone_e164,phone_verified_at,blood_attested_at,city,area,blood_group,last_donation_date,available,is_donor,emergency_consent",
      )
      .eq("is_donor", true)
      .eq("available", true)
      .eq("emergency_consent", true);

    for (const p of profiles ?? []) {
      if (!p.blood_group || !p.phone) continue;
      // Emergency blast: email-confirmed account (logged-in donor) + blood-group proof
      if (!p.blood_attested_at) continue;
      donors.push({
        id: p.id,
        full_name: p.full_name,
        phone: p.phone_e164 || p.phone,
        city: p.city || "Hyderabad",
        area: p.area,
        blood_group: p.blood_group,
        last_donation_date: p.last_donation_date,
        available: p.available,
        phone_verified: Boolean(p.phone_verified_at),
        source: "profile",
      });
    }
  } catch {
    // demo / offline session
  }

  try {
    const { data: directory } = await supabase
      .from("rakhtha_directory_donors")
      .select("*")
      .eq("available", true);

    for (const d of directory ?? []) {
      donors.push({
        id: d.id,
        full_name: d.full_name,
        phone: d.phone,
        city: d.city,
        area: d.area,
        blood_group: d.blood_group,
        last_donation_date: d.last_donation_date,
        available: d.available,
        source: "directory",
      });
    }
  } catch {
    // fall through to local seed
  }

  if (donors.length === 0) {
    return LOCAL_SEED_DONORS;
  }
  return donors;
}

const LOCAL_SEED_DONORS: RankableDonor[] = [
  {
    id: "seed-1",
    full_name: "Ananya Reddy",
    phone: "9876501001",
    city: "Hyderabad",
    area: "Gachibowli",
    blood_group: "O+",
    last_donation_date: "2025-12-01",
    available: true,
    source: "directory",
  },
  {
    id: "seed-2",
    full_name: "Karthik Rao",
    phone: "9876501002",
    city: "Hyderabad",
    area: "Madhapur",
    blood_group: "O-",
    last_donation_date: "2026-01-10",
    available: true,
    source: "directory",
  },
  {
    id: "seed-3",
    full_name: "Sneha Patel",
    phone: "9876501003",
    city: "Hyderabad",
    area: "Kukatpally",
    blood_group: "A+",
    last_donation_date: "2025-11-20",
    available: true,
    source: "directory",
  },
  {
    id: "seed-4",
    full_name: "Rahul Verma",
    phone: "9876501004",
    city: "Hyderabad",
    area: "Secunderabad",
    blood_group: "B+",
    last_donation_date: "2025-10-05",
    available: true,
    source: "directory",
  },
  {
    id: "seed-5",
    full_name: "Fatima Begum",
    phone: "9876501009",
    city: "Hyderabad",
    area: "Tolichowki",
    blood_group: "O-",
    last_donation_date: "2026-02-01",
    available: true,
    source: "directory",
  },
  {
    id: "seed-6",
    full_name: "Vikram Singh",
    phone: "9876501006",
    city: "Hyderabad",
    area: "Jubilee Hills",
    blood_group: "A-",
    last_donation_date: "2025-12-15",
    available: true,
    source: "directory",
  },
];

export async function createEmergencyRequest(
  userId: string,
  userEmail: string,
  input: EmergencyRequestInput,
): Promise<CreateRequestResult> {
  if (!input.share_consent) {
    throw new Error(
      "Please accept the terms: your emergency details may be shared with matched donors and alert channels.",
    );
  }

  const donors = await loadDonors();
  const matches = rankDonors({
    needed: input.blood_group,
    city: input.city,
    area: input.area,
    urgency: input.urgency,
    donors,
  });

  const banks = rankNearbyBanks({
    city: input.city,
    area: input.area,
    hospital: input.hospital,
    limit: 5,
  });

  const eligible = matches.filter((m) => m.eligible);
  const top = eligible[0];
  let ai_summary = top
    ? `Found ${matches.length} compatible donors (${eligible.length} eligible now) for ${input.blood_group} near ${input.city}. Start with ${top.full_name} in ${top.area || top.city} — score ${top.rank_score}. Confirm with the hospital blood bank before travel.`
    : `Found ${matches.length} compatible donors for ${input.blood_group} near ${input.city}, but none are currently eligible by donation gap. Expand search area or ask the blood bank for inventory while you wait.`;

  let whatsappTemplate = "";
  let banksNote = fallbackBanksNote(banks, input.blood_group, input.area);
  let aiSource: "openrouter" | "fallback" = "fallback";

  try {
    const brief = await fetchMatchBrief({
      request: {
        patient_name: input.patient_name,
        blood_group: input.blood_group,
        hospital: input.hospital,
        city: input.city,
        area: input.area,
        urgency: input.urgency,
        units_needed: input.units_needed,
      },
      topMatches: matches.slice(0, 5).map((m) => ({
        name: m.full_name,
        blood_group: m.blood_group,
        area: m.area,
        eligible: m.eligible,
        reason: m.reason,
        rank_score: m.rank_score,
      })),
      topBanks: banks.map((b) => ({
        name: b.name,
        area: b.area,
        city: b.city,
        phone: b.phone,
        reason: b.reason,
        rank_score: b.rank_score,
      })),
    });
    ai_summary = brief.summary;
    whatsappTemplate = brief.whatsappTemplate;
    banksNote = brief.banksNote || banksNote;
    aiSource = brief.source;
  } catch {
    // keep local summary
  }
  if (isDemoUser({ id: userId, email: userEmail, name: "" })) {
    const request: EmergencyRequest = {
      id: `local-${Date.now()}`,
      requester_id: userId,
      ...input,
      status: "open",
      ai_summary,
      created_at: new Date().toISOString(),
    };
    const rows = readLocalRequests();
    writeLocalRequests([request, ...rows].slice(0, 20));
    try {
      await notifyConsentedDonors({
        requestId: request.id,
        bloodGroup: input.blood_group,
        urgency: input.urgency,
        hospital: input.hospital,
        city: input.city,
        patientName: input.patient_name,
        compatibleGroups: compatibleDonorGroups(input.blood_group),
      });
    } catch {
      // non-blocking
    }
    return { request, matches, banks, banksNote, whatsappTemplate, aiSource };
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("rakhtha_requests")
    .insert({
      requester_id: userId,
      patient_name: input.patient_name,
      blood_group: input.blood_group,
      units_needed: input.units_needed,
      hospital: input.hospital,
      city: input.city,
      area: input.area || null,
      urgency: input.urgency,
      notes: input.notes || null,
      status: "open",
      ai_summary,
      share_consent: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const profileTop = matches.filter((m) => m.eligible && m.source === "profile").slice(0, 8);
  if (profileTop.length) {
    try {
      await supabase.from("rakhtha_alerts").insert(
        profileTop.map((m) => ({
          request_id: data.id,
          donor_id: m.id,
          rank_score: m.rank_score,
          reason: m.reason,
        })),
      );
    } catch {
      // non-blocking
    }
  }

  try {
    await notifyConsentedDonors({
      requestId: data.id as string,
      bloodGroup: input.blood_group,
      urgency: input.urgency,
      hospital: input.hospital,
      city: input.city,
      patientName: input.patient_name,
      compatibleGroups: compatibleDonorGroups(input.blood_group),
    });
  } catch {
    // non-blocking for match UX
  }

  return {
    request: data as EmergencyRequest,
    matches,
    banks,
    banksNote,
    whatsappTemplate,
    aiSource,
  };
}

export async function listMyRequests(userId: string): Promise<EmergencyRequest[]> {
  if (userId.startsWith("demo-")) return readLocalRequests();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("rakhtha_requests")
    .select("*")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EmergencyRequest[];
}

export async function updateRequestStatus(
  userId: string,
  requestId: string,
  status: EmergencyRequest["status"],
) {
  if (userId.startsWith("demo-") || requestId.startsWith("local-")) {
    const rows = readLocalRequests().map((r) =>
      r.id === requestId ? { ...r, status } : r,
    );
    writeLocalRequests(rows);
    return;
  }
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("rakhtha_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("requester_id", userId);
  if (error) throw new Error(error.message);
}
