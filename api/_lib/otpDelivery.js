import {
  mintOtpTicket,
  mintSmsPendingTicket,
  newOtpCode,
  otpSecret,
} from "./tickets.js";
import { startSmsVerification } from "./twilioVerify.js";

function twilioAuth(env) {
  const sid = env.TWILIO_OTP_ACCOUNT_SID?.trim() || env.TWILIO_ACCOUNT_SID?.trim() || "";
  const token = env.TWILIO_OTP_AUTH_TOKEN?.trim() || env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from = env.TWILIO_OTP_FROM_NUMBER?.trim() || env.TWILIO_FROM_NUMBER?.trim() || "";
  return { sid, token, from };
}

function spokenCode(code) {
  return code.split("").join(", ");
}

function isTrialBlockError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /21608|573002|unverified|trial|verified caller|not allowed on Twilio trial/i.test(msg);
}

/** Place a Twilio voice call that speaks the OTP (Twilio backup when SMS is blocked). */
export async function deliverVoiceOtp(env, phone, meta = {}) {
  const { sid, token, from } = twilioAuth(env);
  if (!sid || !token || !from) {
    throw new Error("Twilio voice not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM_NUMBER).");
  }

  const code = newOtpCode();
  const { ticket } = mintOtpTicket(otpSecret(env), phone, code);
  const say =
    `Your Rakhtha Seva one time password is ${spokenCode(code)}. ` +
    `I repeat: ${spokenCode(code)}. Enter this code in the app.`;
  const twiml =
    `<Response><Say voice="Polly.Aditi" language="en-IN">${say}</Say>` +
    `<Pause length="1"/><Say voice="Polly.Aditi" language="en-IN">${say}</Say></Response>`;
  const voiceUrl =
    env.TWILIO_VOICE_URL?.trim() ||
    `https://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: phone, From: from, Url: voiceUrl });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || "Twilio could not place OTP call.";
    if (data.code === 573002 || data.code === 21608 || /verified|trial/i.test(msg)) {
      throw new Error(
        "Twilio trial blocked this number for calls too. Add it under Twilio → Phone Numbers → Verified Caller IDs, complete verification, then retry. Production: upgrade Twilio or finish India DLT SMS.",
      );
    }
    throw new Error(msg);
  }

  return {
    phone,
    otpTicket: ticket,
    channel: "voice",
    provider: "twilio-voice",
    callSid: data.sid,
    smsSent: false,
    voiceSent: true,
    usedBackup: Boolean(meta.usedBackup),
    backupReason: meta.backupReason || null,
  };
}

/** Fast2SMS OTP — optional India SMS when DLT/API key ready. */
export async function deliverFast2SmsOtp(env, phone) {
  const apiKey = env.FAST2SMS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("FAST2SMS_API_KEY not set.");
  }
  const digits = phone.replace(/\D/g, "");
  const ten = digits.length >= 10 ? digits.slice(-10) : "";
  if (ten.length !== 10) throw new Error("Enter a valid 10-digit Indian mobile.");

  const code = newOtpCode();
  const { ticket } = mintOtpTicket(otpSecret(env), phone, code);

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "otp",
      variables_values: code,
      numbers: ten,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return === false) {
    throw new Error(
      data.message ||
        `Fast2SMS failed (${data.status_code || res.status}). Complete DLT/KYC if required.`,
    );
  }

  return {
    phone,
    otpTicket: ticket,
    channel: "sms",
    provider: "fast2sms",
    smsSent: true,
    voiceSent: false,
    usedBackup: false,
    backupReason: null,
  };
}

/** Twilio Verify SMS — primary SMS path on Twilio. */
export async function deliverTwilioVerifySms(env, phone) {
  const started = await startSmsVerification(env, phone);
  const { ticket } = mintSmsPendingTicket(otpSecret(env), phone, started.serviceSid);
  return {
    phone,
    otpTicket: ticket,
    channel: "sms",
    provider: "twilio-verify",
    smsSent: true,
    voiceSent: false,
    usedBackup: false,
    backupReason: null,
  };
}

async function trySms(env, phone) {
  const errors = [];
  if (env.FAST2SMS_API_KEY?.trim()) {
    try {
      return await deliverFast2SmsOtp(env, phone);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Fast2SMS failed");
    }
  }
  try {
    return await deliverTwilioVerifySms(env, phone);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Twilio SMS failed");
    const err = new Error(errors.filter(Boolean).join(" | "));
    err.cause = e;
    throw err;
  }
}

/**
 * Twilio-backed OTP with automatic backup:
 * 1) SMS (Fast2SMS if set, else Twilio Verify)
 * 2) If SMS blocked (trial / unverified) → Twilio VOICE call speaks OTP
 *
 * channel:
 *  - auto (default): SMS then voice backup
 *  - sms: SMS then voice backup
 *  - voice: voice only
 */
export async function deliverOtp(env, phone, channel = "auto") {
  const want = String(channel || "auto").toLowerCase();

  if (want === "voice") {
    return deliverVoiceOtp(env, phone);
  }

  // auto + sms: try SMS, then Twilio voice backup
  try {
    return await trySms(env, phone);
  } catch (smsErr) {
    const smsMsg = smsErr instanceof Error ? smsErr.message : "SMS failed";
    try {
      const voice = await deliverVoiceOtp(env, phone, {
        usedBackup: true,
        backupReason: isTrialBlockError(smsErr)
          ? "Twilio blocked SMS to this number (trial/unverified). Fell back to voice OTP call."
          : `SMS failed (${smsMsg}). Fell back to voice OTP call.`,
      });
      return voice;
    } catch (voiceErr) {
      const voiceMsg = voiceErr instanceof Error ? voiceErr.message : "Voice failed";
      throw new Error(
        `OTP could not be delivered. SMS: ${smsMsg} Voice backup: ${voiceMsg}`,
      );
    }
  }
}
