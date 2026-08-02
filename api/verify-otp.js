import {
  SESSION_TTL_MS,
  mintSessionToken,
  otpSecret,
  readSmsPendingTicket,
  toE164India,
  verifyOtpTicket,
} from "./_lib/tickets.js";
import { checkSmsVerification } from "./_lib/twilioVerify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const phone = toE164India(String(body.phone ?? ""));
    const code = String(body.code ?? "").replace(/\D/g, "");
    const otpTicket = String(body.otpTicket ?? "").trim();
    if (!phone || code.length !== 6) {
      res.status(400).json({ error: "Enter the 6-digit OTP from your phone SMS." });
      return;
    }
    if (!otpTicket) {
      res.status(400).json({ error: "No OTP pending. Tap Send OTP to phone first." });
      return;
    }

    const secret = otpSecret(process.env);
    const smsPending = readSmsPendingTicket(secret, phone, otpTicket);
    if (smsPending) {
      try {
        await checkSmsVerification(process.env, phone, code, smsPending.serviceSid);
      } catch (e) {
        res.status(400).json({
          error: e instanceof Error ? e.message : "Incorrect or expired OTP.",
        });
        return;
      }
    } else if (!verifyOtpTicket(secret, phone, code, otpTicket)) {
      res.status(400).json({ error: "Incorrect or expired OTP. Request a new SMS." });
      return;
    }

    const { token } = mintSessionToken(secret, phone);
    res.status(200).json({
      ok: true,
      phone,
      verifiedToken: token,
      expiresInSec: Math.floor(SESSION_TTL_MS / 1000),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "OTP verify failed" });
  }
}
