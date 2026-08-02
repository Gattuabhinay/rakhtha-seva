# Rakhtha Seva · Winner demo (2–3 min)

## Pitch line (say this first)
“Emergency for blood group X — Rakhtha Seva ranks eligible donors, then Twilio calls them, with WhatsApp, voice, and email in the same loop.”

## Live path
1. Home — Theme 2 badge + stack (OpenRouter / ElevenLabs / Twilio / Resend)
2. Login: `demo@rakhthaseva.in` / `RakhthaSeva@2026`
3. Dashboard → **Emergency request**
4. Donor path once: Register → **confirm Supabase email** → Login → **Be a donor** → phone (contact) → blood-group proof + attest → photo → save  

4b. Open **Our Donors** — photo, location, blood type (phone private). Only attested donors get emergency alerts.
4b. Tap **Fill judge demo (O− critical)** → confirm share terms tick → **Find donors + AI brief**
4c. Header **Alerts** bell shows: “Your blood group is needed…” (demo + consented donors)
5. Show **AI: OpenRouter live** badge + ranked scores / eligibility reasons
5b. Show **Nearby blood banks** + AI banks note → tap **Open Maps** / **Call bank**
6. **Alert Command Center** → tap **Blast N eligible donors**
   - Meaning: emergency for blood group X → Twilio calls eligible matches (MVP max 5)
   - WhatsApp opens for top match (AI template)
   - Toggle **English / हिन्दी** → Listen = ElevenLabs speaks brief
   - Twilio blast = same language outbound voice to eligible phones
   - Email = Resend receipt to requester with who was called
   - Do NOT claim Telugu live — that needs Eleven v3 Conversational later
7. Honest free-tier note if asked: “MVP blasts top eligible matches; production scales the same loop.”
8. Optional: History → mark fulfilled

## Keys that make judges gasp
- **OpenRouter:** admin key in `.env.local` by default; user may paste own key in Profile (optional override)
- **Admin only:** Twilio voice blast, ElevenLabs Listen, Resend email  

  Restart `npm run dev` after changing admin `.env.local` keys.

Sidebar chips show **ready / off** so you never fake a channel.

## Honest judge answer
“We are not a blood bank. We are the coordination layer between panic and the right donor — Theme 2 healthcare AI with a complete multi-channel alert loop.”
