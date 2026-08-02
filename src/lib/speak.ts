let currentAudio: HTMLAudioElement | null = null;
let browserUtterance: SpeechSynthesisUtterance | null = null;

export type SpeakResult = {
  source: "elevenlabs" | "browser";
};

function stopBrowserSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  browserUtterance = null;
}

function speakWithBrowser(text: string, lang: "en" | "hi"): Promise<SpeakResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      reject(new Error("No browser speech available."));
      return;
    }
    stopBrowserSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    u.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const prefer =
      voices.find((v) =>
        lang === "hi"
          ? /hi(-|_)?IN|Hindi/i.test(`${v.lang} ${v.name}`)
          : /en(-|_)?(IN|GB|US)/i.test(v.lang),
      ) || voices.find((v) => v.lang.toLowerCase().startsWith(lang === "hi" ? "hi" : "en"));
    if (prefer) u.voice = prefer;
    browserUtterance = u;
    u.onend = () => {
      browserUtterance = null;
      resolve({ source: "browser" });
    };
    u.onerror = () => {
      browserUtterance = null;
      reject(new Error("Browser speech failed."));
    };
    window.speechSynthesis.speak(u);
  });
}

function isFreeLibraryVoiceBlock(message: string) {
  return /paid_plan_required|Free users cannot use library voices|payment_required|402/i.test(
    message,
  );
}

export async function speakText(
  text: string,
  opts?: { lang?: "en" | "hi" },
): Promise<SpeakResult> {
  const clean = text.trim();
  if (!clean) throw new Error("Nothing to speak.");
  const lang = opts?.lang ?? "en";

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  stopBrowserSpeech();

  // ElevenLabs = admin .env only (not user BYOK)
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean.slice(0, 1100) }),
  });

  if (!res.ok) {
    let message = "Could not generate voice.";
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // ignore
    }
    // Free ElevenLabs blocks premade library voices — keep demo alive with browser TTS
    if (isFreeLibraryVoiceBlock(message)) {
      return speakWithBrowser(clean, lang);
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      reject(new Error("Audio playback failed."));
    };
    void audio.play().catch(reject);
  });

  return { source: "elevenlabs" };
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  stopBrowserSpeech();
}
