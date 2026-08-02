/** Browser-held OpenRouter key (BYOK) for AI match brief / WhatsApp text.
 * Twilio + ElevenLabs always use admin .env.local — never user keys.
 */

const KEY = "rakhtha_user_keys_v1";

export type UserKeys = {
  openrouterApiKey: string;
};

const EMPTY: UserKeys = {
  openrouterApiKey: "",
};

export function getUserKeys(): UserKeys {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<UserKeys> & Record<string, string>;
    return {
      openrouterApiKey: parsed.openrouterApiKey?.trim() || "",
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveUserKeys(keys: UserKeys) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ openrouterApiKey: keys.openrouterApiKey.trim() }),
  );
}

export function clearUserKeys() {
  localStorage.removeItem(KEY);
}

/** Only OpenRouter is sent from the browser. */
export function userKeysForApi() {
  const k = getUserKeys();
  return {
    openrouterApiKey: k.openrouterApiKey.trim() || undefined,
  };
}

export function userKeysStatus() {
  const k = getUserKeys();
  return {
    openrouter: k.openrouterApiKey.trim().length >= 20,
  };
}
