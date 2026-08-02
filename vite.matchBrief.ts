import type { Plugin } from "vite";
import { loadEnv } from "vite";

type Body = {
  request?: {
    patient_name?: string;
    blood_group?: string;
    hospital?: string;
    city?: string;
    area?: string;
    urgency?: string;
    units_needed?: number;
  };
  topMatches?: Array<{
    name: string;
    blood_group: string;
    area: string | null;
    eligible: boolean;
    reason: string;
    rank_score: number;
  }>;
  topBanks?: Array<{
    name: string;
    area: string;
    city: string;
    phone: string;
    reason: string;
    rank_score: number;
  }>;
};

function readJson(req: import("http").IncomingMessage): Promise<Body> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw) as Body);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function fallback(body: Body) {
  const request = body.request ?? {};
  const matches = body.topMatches ?? [];
  const banks = body.topBanks ?? [];
  const eligible = matches.filter((m) => m.eligible);
  const top = eligible[0];
  const topBank = banks[0];
  const summary = top
    ? `Found ${matches.length} compatible donors (${eligible.length} eligible now) for ${request.blood_group} near ${request.city}. Start with ${top.name} in ${top.area || request.city} — score ${top.rank_score}. Confirm with the hospital blood bank before travel.`
    : `Found ${matches.length} compatible donors for ${request.blood_group} near ${request.city}, but none are currently eligible by donation gap. Ask the blood bank for inventory while you expand the search.`;

  const whatsappTemplate =
    `Namaste {donorName},\n\n` +
    `Urgent blood request via Rakhtha Seva:\n` +
    `Patient: ${request.patient_name ?? "patient"}\n` +
    `Need: ${request.units_needed ?? 1} unit(s) of ${request.blood_group}\n` +
    `Hospital: ${request.hospital}, ${request.city}\n` +
    `Urgency: ${request.urgency}\n\n` +
    `If you can help, please reply YES and reach the hospital blood bank.\n` +
    `Thank you — you could save a life.`;

  const banksNote = topBank
    ? `While donors are alerted, call ${topBank.name} in ${topBank.area} first for ${request.blood_group} stock, then the next listed banks. Confirm availability before travel.`
    : `Call your hospital blood bank for ${request.blood_group} inventory while you alert donors.`;

  return { summary, whatsappTemplate, banksNote, source: "fallback" as const };
}

async function callOpenRouter(apiKey: string, body: Body) {
  const request = body.request ?? {};
  const matches = body.topMatches ?? [];
  const banks = body.topBanks ?? [];
  const prompt = `You are Rakhtha Seva, an AI blood-emergency assistant for Indian families.
Write JSON only (no markdown) with keys:
- summary: 2 short calm sentences for the requester about which donor to contact first
- whatsappTemplate: WhatsApp message template that MUST include the exact placeholder {donorName} once. Include patient, blood group, hospital, city, urgency. English, polite, no emoji, no medical diagnosis.
- banksNote: 1-2 short calm sentences naming the FIRST blood bank from the provided list to call for inventory, and remind to confirm stock by phone. Do NOT invent banks not in the list. No emoji.

Request:
${JSON.stringify(request)}

Top ranked donor matches:
${JSON.stringify(matches.slice(0, 5))}

Nearby blood banks (directory — use ONLY these names):
${JSON.stringify(banks.slice(0, 5))}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5050",
      "X-Title": "Rakhtha Seva",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      max_tokens: 320,
      temperature: 0.3,
      messages: [
        { role: "system", content: "Return valid JSON only. Never invent blood bank names." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in model response");
  const parsed = JSON.parse(jsonMatch[0]) as {
    summary?: string;
    whatsappTemplate?: string;
    banksNote?: string;
  };

  const fb = fallback(body);
  return {
    summary: parsed.summary?.trim() || fb.summary,
    whatsappTemplate:
      parsed.whatsappTemplate?.includes("{donorName}")
        ? parsed.whatsappTemplate.trim()
        : fb.whatsappTemplate,
    banksNote: parsed.banksNote?.trim() || fb.banksNote,
    source: "openrouter" as const,
  };
}

export function matchBriefApiPlugin(): Plugin {
  return {
    name: "rakhtha-match-brief-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      const envKey =
        env.OPENROUTER_API_KEY?.trim() ||
        env.VITE_OPENROUTER_API_KEY?.trim() ||
        "";

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/match-brief")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        try {
          const body = await readJson(req);
          if (!body.request?.blood_group || !body.request.hospital) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing request fields" }));
            return;
          }

          const userKey = String((body as { apiKey?: string }).apiKey ?? "").trim();
          const apiKey = userKey.length >= 20 ? userKey : envKey;

          let result = fallback(body);
          if (apiKey.length >= 20) {
            try {
              result = await callOpenRouter(apiKey, body);
            } catch {
              result = { ...fallback(body), source: "fallback" };
            }
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: e instanceof Error ? e.message : "AI brief failed",
            }),
          );
        }
      });
    },
  };
}
