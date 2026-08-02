export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.status(200).json({
    twilioOtp: Boolean(
      (process.env.TWILIO_OTP_ACCOUNT_SID?.trim() || process.env.TWILIO_ACCOUNT_SID?.trim()) &&
        (process.env.TWILIO_OTP_AUTH_TOKEN?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim()) &&
        (process.env.TWILIO_OTP_FROM_NUMBER?.trim() || process.env.TWILIO_FROM_NUMBER?.trim()),
    ),
    fast2sms: Boolean(process.env.FAST2SMS_API_KEY?.trim()),
    preferredChannel: "auto",
    twilioVoiceBackup: true,
  });
}
