export const BRAND = {
  name: "Rakhtha Seva",
  shortName: "RS",
  tagline: "Life-saving seva.",
  lede: "AI ranks eligible donors, then alerts them by call, WhatsApp, voice, and email — when minutes decide life.",
  state: "Telangana",
  city: "Hyderabad",
} as const;

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const URGENCY_OPTIONS = [
  { id: "critical", label: "Critical — under 2 hours", hours: 2 },
  { id: "urgent", label: "Urgent — today", hours: 12 },
  { id: "soon", label: "Soon — within 48 hours", hours: 48 },
] as const;

export type UrgencyId = (typeof URGENCY_OPTIONS)[number]["id"];
