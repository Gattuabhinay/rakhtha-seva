import type { Plugin } from "vite";
import { loadEnv } from "vite";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel — calm, clear

function readJson(
  req: import("http").IncomingMessage,
): Promise<{ text?: string; apiKey?: string; voiceId?: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      try {
        resolve(
          JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as {
            text?: string;
            apiKey?: string;
            voiceId?: string;
          },
        );
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function elevenLabsSpeakPlugin(): Plugin {
  return {
    name: "rakhtha-elevenlabs-speak",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      const envApiKey = env.ELEVENLABS_API_KEY?.trim() || "";
      const envVoiceId = env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/speak")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        try {
          const body = await readJson(req);
          const text = body.text?.trim() ?? "";
          if (!text || text.length > 1200) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Provide text (max 1200 chars)." }));
            return;
          }

          // Admin ElevenLabs only — ignore any client-supplied keys
          const apiKey = envApiKey;
          const voiceId = envVoiceId || DEFAULT_VOICE_ID;

          if (apiKey.length < 10) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error:
                  "ELEVENLABS_API_KEY missing in admin .env.local. Add it and restart npm run dev.",
              }),
            );
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
                // Multilingual v2 = strong English + Hindi (matches ElevenLabs Speech UI default)
                model_id: env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.45,
                  similarity_boost: 0.75,
                },
              }),
            },
          );

          if (!upstream.ok) {
            const errText = await upstream.text();
            const paidBlock = /paid_plan_required|Free users cannot use library voices/i.test(
              errText,
            );
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: paidBlock
                  ? "ElevenLabs free plan blocks library voices on API. Create your own voice (Voice Design / Instant Clone), copy Voice ID into ELEVENLABS_VOICE_ID in .env.local, restart — or upgrade. Demo will fall back to browser speech."
                  : `ElevenLabs ${upstream.status}: ${errText.slice(0, 180)}`,
                code: paidBlock ? "paid_plan_required" : undefined,
              }),
            );
            return;
          }

          const audio = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = 200;
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Cache-Control", "no-store");
          res.end(audio);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: e instanceof Error ? e.message : "Speak failed",
            }),
          );
        }
      });
    },
  };
}
