function fallback(body) {
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

  return { summary, whatsappTemplate, banksNote, source: "fallback" };
}

async function callOpenRouter(apiKey, body) {
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
      "HTTP-Referer": "https://rakhtha-seva.vercel.app",
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

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in model response");
  const parsed = JSON.parse(jsonMatch[0]);
  const fb = fallback(body);
  return {
    summary: parsed.summary?.trim() || fb.summary,
    whatsappTemplate: parsed.whatsappTemplate?.includes("{donorName}")
      ? parsed.whatsappTemplate.trim()
      : fb.whatsappTemplate,
    banksNote: parsed.banksNote?.trim() || fb.banksNote,
    source: "openrouter",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (!body.request?.blood_group || !body.request.hospital) {
      res.status(400).json({ error: "Missing request fields" });
      return;
    }
    const envKey = process.env.OPENROUTER_API_KEY?.trim() || "";
    const userKey = String(body.apiKey ?? "").trim();
    const apiKey = userKey.length >= 20 ? userKey : envKey;

    let result = fallback(body);
    if (apiKey.length >= 20) {
      try {
        result = await callOpenRouter(apiKey, body);
      } catch {
        result = { ...fallback(body), source: "fallback" };
      }
    }
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "AI brief failed" });
  }
}
