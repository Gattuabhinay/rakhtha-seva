const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const text = String(body.text ?? "").trim();
    if (!text || text.length > 1200) {
      res.status(400).json({ error: "Provide text (max 1200 chars)." });
      return;
    }
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim() || "";
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
    if (apiKey.length < 10) {
      res.status(503).json({ error: "ELEVENLABS_API_KEY missing on server." });
      return;
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75 },
        }),
      },
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      const paidBlock = /paid_plan_required|Free users cannot use library voices/i.test(errText);
      res.status(upstream.status).json({
        error: paidBlock
          ? "ElevenLabs free plan blocks library voices on API. Set ELEVENLABS_VOICE_ID to your own voice."
          : `ElevenLabs ${upstream.status}: ${errText.slice(0, 180)}`,
        code: paidBlock ? "paid_plan_required" : undefined,
      });
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.end(audio);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Speak failed" });
  }
}
