export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const to = String(body.to ?? "").trim();
    const subject = String(body.subject ?? "Rakhtha Seva emergency match").trim();
    const html = String(body.html ?? "").trim();
    const text = String(body.text ?? "").trim();
    const apiKey = process.env.RESEND_API_KEY?.trim() || "";
    const fromRaw = (process.env.RESEND_FROM?.trim() || "Rakhtha Seva <beth.t@example.com>").replace(
      /^["']|["']$/g,
      "",
    );
    const from =
      /@(gmail|yahoo|outlook|hotmail)\.com/i.test(fromRaw) && !/@resend\.dev/i.test(fromRaw)
        ? "Rakhtha Seva <beth.t@example.com>"
        : fromRaw;

    if (!to || (!html && !text)) {
      res.status(400).json({ error: "Missing to/body" });
      return;
    }
    if (apiKey.length < 10) {
      res.status(503).json({ error: "RESEND_API_KEY missing on server.", configured: false });
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
    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data.message || "Resend failed", configured: true });
      return;
    }
    res.status(200).json({ ok: true, id: data.id, configured: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Email failed" });
  }
}
