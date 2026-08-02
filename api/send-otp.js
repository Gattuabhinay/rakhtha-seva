import { OTP_TTL_MS, toE164India } from "./_lib/tickets.js";
import { deliverOtp } from "./_lib/otpDelivery.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const phone = toE164India(String(body.phone ?? ""));
    if (!phone) {
      res.status(400).json({ error: "Enter a valid Indian mobile number." });
      return;
    }

    const raw = String(body.channel ?? "auto").toLowerCase();
    const channel = raw === "voice" || raw === "sms" ? raw : "auto";
    const result = await deliverOtp(process.env, phone, channel);

    res.status(200).json({
      ok: true,
      phone: result.phone,
      channel: result.channel,
      provider: result.provider || (result.channel === "voice" ? "twilio-voice" : "sms"),
      smsSent: Boolean(result.smsSent),
      voiceSent: Boolean(result.voiceSent),
      usedBackup: Boolean(result.usedBackup),
      backupReason: result.backupReason || null,
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      otpTicket: result.otpTicket,
      // Never return the OTP digits — user hears SMS/call only.
    });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "OTP send failed" });
  }
}
