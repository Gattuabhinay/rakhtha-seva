import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BloodGroup } from "@/lib/brand";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export const DEMO_ACCOUNT = {
  name: "Demo Sevak",
  email: "demo@rakhthaseva.in",
  password: "RakhthaSeva@2026",
} as const;

const DEMO_SESSION_KEY = "rakhtha_demo_session_v1";

function readDemoSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDemoSession(user: AuthUser) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
}

function clearDemoSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_SESSION_KEY);
}

export function isDemoUser(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.id?.startsWith("demo-") || user?.email === DEMO_ACCOUNT.email);
}

function localDemoUser(): AuthUser {
  return {
    id: "demo-local-rakhtha",
    name: DEMO_ACCOUNT.name,
    email: DEMO_ACCOUNT.email,
  };
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const demo = readDemoSession();
  if (demo) return demo;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const email = data.user.email ?? "";
  const metaName = String(data.user.user_metadata?.full_name ?? "").trim();

  const { data: profile } = await supabase
    .from("rakhtha_profiles")
    .select("full_name,email")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: profile?.email || email,
    name: profile?.full_name || metaName || email.split("@")[0] || "Member",
  };
}

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit")) {
    return "Email rate limit hit. Wait a bit, try Login, or use the Demo account.";
  }
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return "Confirm your email first — open the Supabase confirmation link we sent, then Login.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "This email already has an account. Switch to Login, or use Forgot password.";
  }
  if (m.includes("redirect") && (m.includes("not allowed") || m.includes("whitelist") || m.includes("allow"))) {
    return "Reset redirect URL is not allowed in Supabase. Add http://localhost:5050/reset-password and your production /reset-password under Auth → URL Configuration.";
  }
  if (m.includes("invalid login credentials")) {
    return "Invalid login credentials. Check email/password, or use Forgot password to reset via Supabase email.";
  }
  return message;
}

const RECOVERY_FLAG = "rakhtha_password_recovery";

export function markPasswordRecovery() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RECOVERY_FLAG, "1");
}

export function clearPasswordRecovery() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RECOVERY_FLAG);
}

export function isPasswordRecoveryPending(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(RECOVERY_FLAG) === "1";
}

/** Consume Supabase recovery link (?code= or #access_token) so updatePassword can run. */
export async function ensurePasswordRecoverySession(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  clearDemoSession();

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const err =
    queryParams.get("error_description") ||
    hashParams.get("error_description") ||
    queryParams.get("error") ||
    hashParams.get("error");
  if (err) {
    throw new Error(decodeURIComponent(err.replace(/\+/g, " ")));
  }

  const code = queryParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(friendlyAuthError(error.message));
    window.history.replaceState({}, "", "/reset-password");
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    markPasswordRecovery();
    return;
  }

  // Hash tokens: detectSessionInUrl usually handles this; give it a moment then re-check
  await new Promise((r) => window.setTimeout(r, 250));
  const again = await supabase.auth.getSession();
  if (again.data.session) {
    markPasswordRecovery();
    return;
  }

  throw new Error(
    "Reset link is missing or expired. Go to Login → Forgot password, request a new Supabase email, then open the latest link.",
  );
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password) {
    return loginAsDemo();
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });
  if (error) throw new Error(error.message);
  clearDemoSession();
  const user = await getSessionUser();
  if (!user) throw new Error("Login succeeded but session was not found.");
  return user;
}

export async function loginAsDemo(): Promise<AuthUser> {
  const supabase = getSupabaseBrowserClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_ACCOUNT.email,
      password: DEMO_ACCOUNT.password,
    });
    if (!error) {
      clearDemoSession();
      const user = await getSessionUser();
      if (user) return user;
    }
  } catch {
    // fall through
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: DEMO_ACCOUNT.email,
      password: DEMO_ACCOUNT.password,
      options: {
        data: { full_name: DEMO_ACCOUNT.name },
      },
    });
    if (!error && data.session && data.user) {
      clearDemoSession();
      await supabase.from("rakhtha_profiles").upsert({
        id: data.user.id,
        full_name: DEMO_ACCOUNT.name,
        email: DEMO_ACCOUNT.email,
        city: "Hyderabad",
        is_donor: true,
        available: true,
        blood_group: "O+",
        phone: "9999900001",
        area: "Gachibowli",
      });
      const user = await getSessionUser();
      if (user) return user;
    }
  } catch {
    // fall through
  }

  const user = localDemoUser();
  writeDemoSession(user);
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  return user;
}

export type RegisterResult =
  | { status: "signed_in"; user: AuthUser }
  | { status: "confirm_email"; email: string };

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<RegisterResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail || password.length < 6) {
    throw new Error("Enter name, valid email, and password (min 6 chars).");
  }

  const supabase = getSupabaseBrowserClient();
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { full_name: cleanName },
      emailRedirectTo,
    },
  });

  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data.user) throw new Error("Could not create account.");

  clearDemoSession();

  await supabase.from("rakhtha_profiles").upsert({
    id: data.user.id,
    full_name: cleanName,
    email: cleanEmail,
    city: "Hyderabad",
  });

  // Supabase "Confirm email" ON → no session until the user opens the email link.
  if (!data.session) {
    return { status: "confirm_email", email: cleanEmail };
  }

  const user = await getSessionUser();
  if (!user) throw new Error("Account created but session was not found.");
  return { status: "signed_in", user };
}

export async function logout() {
  clearDemoSession();
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error("Enter the email linked to your account.");
  if (cleanEmail === DEMO_ACCOUNT.email) {
    throw new Error(
      `Demo account cannot reset by email. Use password ${DEMO_ACCOUNT.password} or “Enter with demo”.`,
    );
  }
  clearDemoSession();
  const supabase = getSupabaseBrowserClient();
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function updatePassword(newPassword: string): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error(
      "Reset link is missing or expired. Request a new forgot-password email, then open the latest link.",
    );
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendlyAuthError(error.message));
  clearPasswordRecovery();
}

export type RakhthaProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  phone_e164?: string | null;
  phone_verified_at?: string | null;
  city: string | null;
  area: string | null;
  blood_group: BloodGroup | null;
  is_donor: boolean;
  available: boolean;
  last_donation_date: string | null;
  emergency_consent?: boolean;
  consent_accepted_at?: string | null;
  blood_proof_url?: string | null;
  blood_proof_status?: string | null;
  blood_attested_at?: string | null;
  photo_url?: string | null;
  show_on_donor_wall?: boolean;
};

export async function getMyProfile(userId: string): Promise<RakhthaProfile | null> {
  if (userId.startsWith("demo-")) {
    return {
      id: userId,
      full_name: DEMO_ACCOUNT.name,
      email: DEMO_ACCOUNT.email,
      phone: "9999900001",
      phone_e164: "+919999900001",
      phone_verified_at: new Date().toISOString(),
      city: "Hyderabad",
      area: "Gachibowli",
      blood_group: "O+",
      is_donor: true,
      available: true,
      last_donation_date: null,
      emergency_consent: true,
      consent_accepted_at: new Date().toISOString(),
    };
  }
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("rakhtha_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as RakhthaProfile | null;
}

export async function upsertMyProfile(
  userId: string,
  patch: Partial<RakhthaProfile> & { full_name: string; email: string },
): Promise<void> {
  if (userId.startsWith("demo-")) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("rakhtha_profiles").upsert({
    id: userId,
    ...patch,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
