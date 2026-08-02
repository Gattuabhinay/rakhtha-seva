import type { Plugin } from "vite";
import { loadEnv } from "vite";

function readJson(req: import("http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function toE164India(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function alertsApiPlugin(): Plugin {
  return {
    name: "rakhtha-alerts-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";

        // --- Resend email ---
        if (url === "/api/alert-email" && req.method === "POST") {
          try {
            const body = await readJson(req);
            const to = String(body.to ?? "").trim();
            const subject = String(body.subject ?? "Rakhtha Seva emergency match").trim();
            const html = String(body.html ?? "").trim();
            const text = String(body.text ?? "").trim();
            const apiKey = env.RESEND_API_KEY?.trim() || "";
            const fromRaw = (env.RESEND_FROM?.trim() || "Rakhtha Seva <beth.t@example.com>").replace(
              /^["']|["']$/g,
              "",
            );
            // Free Resend: personal inboxes can't be From= until a domain is verified
            const from =
              /@(gmail|yahoo|outlook|hotmail)\.com/i.test(fromRaw) && !/@resend\.dev/i.test(fromRaw)
                ? "Rakhtha Seva <beth.t@example.com>"
                : fromRaw;

            if (!to || (!html && !text)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Missing to/body" }));
              return;
            }
            if (apiKey.length < 10) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    "RESEND_API_KEY missing in .env.local. Add it, restart npm run dev.",
                  configured: false,
                }),
              );
              return;
            }

            const upstream = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from,
                to: [to],
                subject,
                html: html || undefined,
                text: text || undefined,
              }),
            });
            const data = (await upstream.json()) as { id?: string; message?: string };
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: data.message || "Resend failed", configured: true }));
              return;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, id: data.id, configured: true }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Email failed" }));
          }
          return;
        }

        // --- Twilio auto-call (Meaning B) ---
        if (url === "/api/place-call" && req.method === "POST") {
          try {
            const body = await readJson(req);
            const toRaw = String(body.toPhone ?? "");
            const message = String(body.message ?? "").trim();
            const lang = String(body.lang ?? "en").toLowerCase() === "hi" ? "hi" : "en";
            const to = toE164India(toRaw);
            // Admin Twilio only — never accept user-supplied call credentials
            const sid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
            const token = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
            const from = env.TWILIO_FROM_NUMBER?.trim() ?? "";

            if (!to) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Invalid donor phone" }));
              return;
            }
            if (!sid || !token || !from) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    "Twilio not configured. Admin: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to .env.local.",
                  configured: false,
                }),
              );
              return;
            }

            const sayText =
              message.slice(0, 500) ||
              (lang === "hi"
                ? "रक्त सेवा से जरूरी रक्त अनुरोध। कृपया व्हाट्सऐप देखें या अस्पताल ब्लड बैंक से संपर्क करें।"
                : "Urgent blood request from Rakhtha Seva. Please open WhatsApp or contact the hospital blood bank if you can donate.");
            const voice = "Polly.Aditi";
            const language = lang === "hi" ? "hi-IN" : "en-IN";
            const thanks =
              lang === "hi" ? "जीवन बचाने के लिए धन्यवाद।" : "Thank you for saving a life.";
            const twiml = `<Response><Say voice="${voice}" language="${language}">${escapeXml(sayText)}</Say><Pause length="1"/><Say voice="${voice}" language="${language}">${escapeXml(thanks)}</Say></Response>`;

            // Trial accounts often block Twiml= REST param — Url= works (twimlets echo or custom bin)
            const voiceUrl =
              env.TWILIO_VOICE_URL?.trim() ||
              `https://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;

            const params = new URLSearchParams();
            params.set("To", to);
            params.set("From", from);
            params.set("Url", voiceUrl);

            const auth = Buffer.from(`${sid}:${token}`).toString("base64");
            const upstream = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
              },
            );
            const data = (await upstream.json()) as {
              sid?: string;
              status?: string;
              message?: string;
              code?: number;
            };
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: data.message || `Twilio error ${data.code ?? upstream.status}`,
                  configured: true,
                }),
              );
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                callSid: data.sid,
                status: data.status,
                configured: true,
              }),
            );
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Call failed" }));
          }
          return;
        }

        // --- Channel readiness for UI badges ---
        if (url === "/api/alert-status" && req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              openrouter: Boolean(env.OPENROUTER_API_KEY?.trim()),
              elevenlabs: Boolean(env.ELEVENLABS_API_KEY?.trim()),
              twilio: Boolean(
                env.TWILIO_ACCOUNT_SID?.trim() &&
                  env.TWILIO_AUTH_TOKEN?.trim() &&
                  env.TWILIO_FROM_NUMBER?.trim(),
              ),
              resend: Boolean(env.RESEND_API_KEY?.trim()),
            }),
          );
          return;
        }

        return next();
      });
    },
  };
}
