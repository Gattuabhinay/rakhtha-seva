import { toE164India } from "./_lib/tickets.js";

function escapeXml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const to = toE164India(String(body.toPhone ?? ""));
    const message = String(body.message ?? "").trim();
    const lang = String(body.lang ?? "en").toLowerCase() === "hi" ? "hi" : "en";
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
    const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
    const from = process.env.TWILIO_FROM_NUMBER?.trim() ?? "";

    if (!to) {
      res.status(400).json({ error: "Invalid donor phone" });
      return;
    }
    if (!sid || !token || !from) {
      res.status(503).json({ error: "Twilio not configured on server.", configured: false });
      return;
    }

    const sayText =
      message.slice(0, 500) ||
      (lang === "hi"
        ? "रक्त सेवा से जरूरी रक्त अनुरोध। कृपया व्हाट्सऐप देखें या अस्पताल ब्लड बैंक से संपर्क करें।"
        : "Urgent blood request from Rakhtha Seva. Please open WhatsApp or contact the hospital blood bank if you can donate.");
    const voice = "Polly.Aditi";
    const language = lang === "hi" ? "hi-IN" : "en-IN";
    const thanks = lang === "hi" ? "जीवन बचाने के लिए धन्यवाद।" : "Thank you for saving a life.";
    const twiml = `<Response><Say voice="${voice}" language="${language}">${escapeXml(sayText)}</Say><Pause length="1"/><Say voice="${voice}" language="${language}">${escapeXml(thanks)}</Say></Response>`;
    const voiceUrl =
      process.env.TWILIO_VOICE_URL?.trim() ||
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
    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: data.message || `Twilio error ${data.code ?? upstream.status}`,
        configured: true,
      });
      return;
    }
    res.status(200).json({
      ok: true,
      callSid: data.sid,
      status: data.status,
      configured: true,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Call failed" });
  }
}
