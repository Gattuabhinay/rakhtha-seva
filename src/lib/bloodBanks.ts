export type BloodBank = {
  id: string;
  name: string;
  area: string;
  city: string;
  phone: string;
  mapsQuery: string;
};

export type RankedBloodBank = BloodBank & {
  rank_score: number;
  reason: string;
};

/** Curated Hyderabad directory — not live inventory. Confirm stock by phone. */
export const HYDERABAD_BLOOD_BANKS: BloodBank[] = [
  {
    id: "bb-redcross-vidyanagar",
    name: "Indian Red Cross Society Blood Bank",
    area: "Vidyanagar",
    city: "Hyderabad",
    phone: "04027634455",
    mapsQuery: "Indian Red Cross Society Blood Bank Vidyanagar Hyderabad",
  },
  {
    id: "bb-niilofer",
    name: "Niloufer Hospital Blood Bank",
    area: "Red Hills",
    city: "Hyderabad",
    phone: "04023548221",
    mapsQuery: "Niloufer Hospital Blood Bank Hyderabad",
  },
  {
    id: "bb-care-hitech",
    name: "Care Hospitals Blood Bank",
    area: "Hitech City",
    city: "Hyderabad",
    phone: "04067258888",
    mapsQuery: "Care Hospitals Blood Bank Hitech City Hyderabad",
  },
  {
    id: "bb-yashoda-somajiguda",
    name: "Yashoda Hospitals Blood Bank",
    area: "Somajiguda",
    city: "Hyderabad",
    phone: "04045674567",
    mapsQuery: "Yashoda Hospitals Blood Bank Somajiguda Hyderabad",
  },
  {
    id: "bb-apollo-jubilee",
    name: "Apollo Hospitals Blood Bank",
    area: "Jubilee Hills",
    city: "Hyderabad",
    phone: "04023607777",
    mapsQuery: "Apollo Hospitals Blood Bank Jubilee Hills Hyderabad",
  },
  {
    id: "bb-kims-secunderabad",
    name: "KIMS Hospitals Blood Bank",
    area: "Secunderabad",
    city: "Hyderabad",
    phone: "04044885000",
    mapsQuery: "KIMS Hospitals Blood Bank Secunderabad",
  },
  {
    id: "bb-continental-gachibowli",
    name: "Continental Hospitals Blood Bank",
    area: "Gachibowli",
    city: "Hyderabad",
    phone: "04067000000",
    mapsQuery: "Continental Hospitals Blood Bank Gachibowli Hyderabad",
  },
  {
    id: "bb-aig-gachibowli",
    name: "AIG Hospitals Blood Bank",
    area: "Gachibowli",
    city: "Hyderabad",
    phone: "04042444222",
    mapsQuery: "AIG Hospitals Blood Bank Gachibowli Hyderabad",
  },
  {
    id: "bb-gandhi-sec",
    name: "Gandhi Hospital Blood Bank",
    area: "Secunderabad",
    city: "Hyderabad",
    phone: "04027505566",
    mapsQuery: "Gandhi Hospital Blood Bank Secunderabad",
  },
  {
    id: "bb-osmania",
    name: "Osmania General Hospital Blood Bank",
    area: "Afzalgunj",
    city: "Hyderabad",
    phone: "04024600107",
    mapsQuery: "Osmania General Hospital Blood Bank Hyderabad",
  },
];

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function rankNearbyBanks(input: {
  city: string;
  area?: string;
  hospital?: string;
  limit?: number;
}): RankedBloodBank[] {
  const city = norm(input.city || "Hyderabad");
  const area = norm(input.area || "");
  const hospital = norm(input.hospital || "");
  const limit = input.limit ?? 5;

  return HYDERABAD_BLOOD_BANKS.map((b) => {
    let score = 40;
    const reasons: string[] = [];
    const bArea = norm(b.area);
    const bCity = norm(b.city);
    const bName = norm(b.name);

    if (bCity.includes(city) || city.includes(bCity) || city.includes("hyderabad")) {
      score += 20;
      reasons.push("Same city directory");
    }
    if (area && (bArea.includes(area) || area.includes(bArea))) {
      score += 35;
      reasons.push(`Near your area (${b.area})`);
    }
    if (hospital) {
      const tokens = hospital.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
      const hit = tokens.some((t) => bName.includes(t) || bArea.includes(t));
      if (hit) {
        score += 25;
        reasons.push("Matches hospital / area keywords");
      }
    }
    if (["gachibowli", "hitech", "madhapur"].some((a) => area.includes(a)) &&
        ["gachibowli", "hitech"].some((a) => bArea.includes(a))) {
      score += 10;
    }

    return {
      ...b,
      rank_score: Math.min(99, score),
      reason: reasons[0] || `Hyderabad blood bank · ${b.area}`,
    };
  })
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, limit);
}

export function openMapsLink(bank: Pick<BloodBank, "mapsQuery" | "name" | "area" | "city">) {
  const q = encodeURIComponent(bank.mapsQuery || `${bank.name} ${bank.area} ${bank.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function fallbackBanksNote(banks: RankedBloodBank[], bloodGroup: string, area?: string) {
  const top = banks[0];
  if (!top) {
    return `Call your hospital blood bank for ${bloodGroup} inventory while you alert donors.`;
  }
  return `While donors are alerted, call ${top.name} in ${top.area}${area ? ` (near ${area})` : ""} first for ${bloodGroup} stock — then check the next listed banks. Confirm availability before travel.`;
}
