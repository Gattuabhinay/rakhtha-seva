import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isDemoUser } from "@/lib/auth";

export type RakhthaNotification = {
  id: string;
  user_id: string;
  request_id: string | null;
  title: string;
  body: string;
  blood_group: string | null;
  urgency: string | null;
  read: boolean;
  created_at: string;
};

const LOCAL_KEY = "rakhtha_notifications_v1";

function readLocal(userId: string): RakhthaNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as RakhthaNotification[];
    return all.filter((n) => n.user_id === userId);
  } catch {
    return [];
  }
}

function writeLocalAll(rows: RakhthaNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 80)));
}

export async function listMyNotifications(userId: string): Promise<RakhthaNotification[]> {
  if (userId.startsWith("demo-") || isDemoUser({ id: userId, email: "", name: "" })) {
    return readLocal(userId).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("rakhtha_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []) as RakhthaNotification[];
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  if (userId.startsWith("demo-")) {
    const raw = localStorage.getItem(LOCAL_KEY);
    const all = raw ? (JSON.parse(raw) as RakhthaNotification[]) : [];
    writeLocalAll(all.map((n) => (n.id === id ? { ...n, read: true } : n)));
    return;
  }
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("rakhtha_notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (userId.startsWith("demo-")) {
    const raw = localStorage.getItem(LOCAL_KEY);
    const all = raw ? (JSON.parse(raw) as RakhthaNotification[]) : [];
    writeLocalAll(all.map((n) => (n.user_id === userId ? { ...n, read: true } : n)));
    return;
  }
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("rakhtha_notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw new Error(error.message);
}

/** Fan-out in-app alerts to consented donors for this blood need. */
export async function notifyConsentedDonors(input: {
  requestId: string;
  bloodGroup: string;
  urgency: string;
  hospital: string;
  city: string;
  patientName: string;
  compatibleGroups: string[];
}): Promise<number> {
  const title = `Your blood group is needed — ${input.urgency} emergency`;
  const body =
    `${input.bloodGroup} needed for ${input.patientName} at ${input.hospital}, ${input.city}. ` +
    `Open Rakhtha Seva Emergency / check WhatsApp if you can help. Confirm with the hospital blood bank.`;

  // Demo path: notify the local demo donor account
  if (input.requestId.startsWith("local-")) {
    if (typeof window === "undefined") return 0;
    const demoId = "demo-local-rakhtha";
    const raw = localStorage.getItem(LOCAL_KEY);
    const all = raw ? (JSON.parse(raw) as RakhthaNotification[]) : [];
    const note: RakhthaNotification = {
      id: `n-${Date.now()}`,
      user_id: demoId,
      request_id: input.requestId,
      title,
      body,
      blood_group: input.bloodGroup,
      urgency: input.urgency,
      read: false,
      created_at: new Date().toISOString(),
    };
    writeLocalAll([note, ...all]);
    return 1;
  }

  const supabase = getSupabaseBrowserClient();
  const { data: donors, error } = await supabase
    .from("rakhtha_profiles")
    .select("id, blood_group")
    .eq("is_donor", true)
    .eq("available", true)
    .eq("emergency_consent", true)
    .in("blood_group", input.compatibleGroups);

  if (error) throw new Error(error.message);
  const rows = (donors ?? []).map((d) => ({
    user_id: d.id as string,
    request_id: input.requestId,
    title,
    body,
    blood_group: input.bloodGroup,
    urgency: input.urgency,
    read: false,
  }));
  if (!rows.length) return 0;

  const { error: insertError } = await supabase.from("rakhtha_notifications").insert(rows);
  if (insertError) throw new Error(insertError.message);
  return rows.length;
}
