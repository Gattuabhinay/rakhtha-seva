export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.status(200).json({
    openrouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    twilio: Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim() &&
        process.env.TWILIO_FROM_NUMBER?.trim(),
    ),
  });
}
