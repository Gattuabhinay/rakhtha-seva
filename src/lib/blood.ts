import type { BloodGroup } from "@/lib/brand";

/** Whole-blood donation gap used by Indian blood banks (approx). */
export const MIN_DONATION_GAP_DAYS = 90;

export function daysSince(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const then = new Date(dateIso);
  if (Number.isNaN(then.getTime())) return null;
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isEligibleByDate(lastDonationDate: string | null | undefined): boolean {
  const days = daysSince(lastDonationDate);
  if (days === null) return true;
  return days >= MIN_DONATION_GAP_DAYS;
}

/** Compatible donors for a patient blood group (simplified RBC matching). */
export function compatibleDonorGroups(needed: BloodGroup): BloodGroup[] {
  const map: Record<BloodGroup, BloodGroup[]> = {
    "O-": ["O-"],
    "O+": ["O-", "O+"],
    "A-": ["O-", "A-"],
    "A+": ["O-", "O+", "A-", "A+"],
    "B-": ["O-", "B-"],
    "B+": ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  };
  return map[needed];
}

export function areaScore(donorArea: string | null | undefined, requestArea: string | null | undefined): number {
  if (!donorArea || !requestArea) return 40;
  const a = donorArea.toLowerCase().trim();
  const b = requestArea.toLowerCase().trim();
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  return 45;
}

export type RankableDonor = {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  area: string | null;
  blood_group: BloodGroup;
  last_donation_date: string | null;
  available: boolean;
  phone_verified?: boolean;
  source: "profile" | "directory";
};

export type RankedDonor = RankableDonor & {
  rank_score: number;
  eligible: boolean;
  reason: string;
};

export function rankDonors(input: {
  needed: BloodGroup;
  city: string;
  area?: string | null;
  urgency: "critical" | "urgent" | "soon";
  donors: RankableDonor[];
}): RankedDonor[] {
  const compatible = new Set(compatibleDonorGroups(input.needed));
  const urgencyBoost = input.urgency === "critical" ? 12 : input.urgency === "urgent" ? 6 : 0;

  return input.donors
    .filter((d) => d.available && compatible.has(d.blood_group))
    .map((d) => {
      const eligible = isEligibleByDate(d.last_donation_date);
      const days = daysSince(d.last_donation_date);
      const cityMatch =
        d.city.toLowerCase().trim() === input.city.toLowerCase().trim() ? 30 : 5;
      const area = areaScore(d.area, input.area);
      const exactGroup = d.blood_group === input.needed ? 25 : 10;
      const eligibilityPts = eligible ? 25 : -40;
      const verifiedPts = d.phone_verified ? 15 : 0;
      const freshness =
        days === null ? 8 : Math.min(20, Math.floor(days / 10));

      const rank_score = Math.max(
        0,
        Math.min(
          100,
          cityMatch +
            area * 0.25 +
            exactGroup +
            eligibilityPts +
            freshness +
            urgencyBoost +
            verifiedPts,
        ),
      );

      let reason = "";
      if (!eligible) {
        reason = `Too soon to donate again (${days ?? 0} days since last donation; need ${MIN_DONATION_GAP_DAYS}+).`;
      } else if (d.blood_group === input.needed) {
        reason = `Exact ${d.blood_group} match in ${d.area || d.city}${d.phone_verified ? " · registered donor" : ""}.`;
      } else {
        reason = `Compatible ${d.blood_group} donor for patient ${input.needed} · ${d.area || d.city}${d.phone_verified ? " · registered donor" : ""}.`;
      }

      return { ...d, rank_score: Math.round(rank_score), eligible, reason };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (Boolean(a.phone_verified) !== Boolean(b.phone_verified)) {
        return a.phone_verified ? -1 : 1;
      }
      return b.rank_score - a.rank_score;
    });
}

export function whatsappAlertMessage(opts: {
  donorName: string;
  patientName: string;
  bloodGroup: string;
  hospital: string;
  city: string;
  urgency: string;
  units: number;
  template?: string | null;
}): string {
  if (opts.template?.includes("{donorName}")) {
    return opts.template.replaceAll("{donorName}", opts.donorName);
  }
  return (
    `Namaste ${opts.donorName},\n\n` +
    `Urgent blood request via Rakhtha Seva:\n` +
    `Patient: ${opts.patientName}\n` +
    `Need: ${opts.units} unit(s) of ${opts.bloodGroup}\n` +
    `Hospital: ${opts.hospital}, ${opts.city}\n` +
    `Urgency: ${opts.urgency}\n\n` +
    `If you can help, please reply YES and reach the hospital blood bank.\n` +
    `Thank you — you could save a life.`
  );
}

export function waMeLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}
