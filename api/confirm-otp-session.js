import { otpSecret, toE164India, verifySessionToken } from "./_lib/tickets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const phone = toE164India(String(body.phone ?? ""));
    const verifiedToken = String(body.verifiedToken ?? "").trim();
    if (!phone || !verifiedToken) {
      res.status(400).json({ error: "Missing phone or verified token." });
      return;
    }
    if (!verifySessionToken(otpSecret(process.env), phone, verifiedToken)) {
      res.status(401).json({ error: "Phone verification expired. Verify OTP again." });
      return;
    }
    res.status(200).json({ ok: true, phone });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Session check failed" });
  }
}
