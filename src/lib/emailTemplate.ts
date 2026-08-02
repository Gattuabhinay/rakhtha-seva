import type { BloodGroup, UrgencyId } from "@/lib/brand";
import type { RankedDonor } from "@/lib/blood";
import { BLAST_CALL_LIMIT } from "@/lib/alerts";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type EmergencyEmailInput = {
  to: string;
  patientName: string;
  bloodGroup: BloodGroup | string;
  units: number;
  hospital: string;
  city: string;
  urgency: UrgencyId | string;
  summary: string;
  requestId?: string | null;
  donors: RankedDonor[];
  lang?: "en" | "hi";
};

export function buildEmergencyEmail(input: EmergencyEmailInput): {
  to: string;
  subject: string;
  text: string;
  html: string;
} {
  const donors = input.donors.slice(0, BLAST_CALL_LIMIT);
  const hi = input.lang === "hi";

  const donorLines = donors.length
    ? donors
        .map(
          (m, i) =>
            `${i + 1}. ${m.full_name} (${m.blood_group}) — ${m.area || m.city} — score ${m.rank_score} — ${m.phone}`,
        )
        .join("\n")
    : hi
      ? "अभी कोई योग्य दाता नहीं"
      : "No eligible donors yet";

  const subject = hi
    ? `आपातकाल · ${input.bloodGroup} · ${input.patientName} · रक्त सेवा`
    : `EMERGENCY · ${input.bloodGroup} · ${input.patientName} · Rakhtha Seva`;

  const text = hi
    ? [
        "रक्त सेवा — आपातकालीन मिलान",
        "",
        input.summary,
        "",
        `मरीज: ${input.patientName}`,
        `आवश्यकता: ${input.bloodGroup} × ${input.units}`,
        `अस्पताल: ${input.hospital}, ${input.city}`,
        `urgency: ${input.urgency}`,
        input.requestId ? `Request: ${input.requestId}` : "",
        "",
        `Twilio blast में शामिल योग्य दाता (अधिकतम ${BLAST_CALL_LIMIT}):`,
        donorLines,
        "",
        "कृपया अस्पताल ब्लड बैंक से पुष्टि करें। यह केवल समन्वय सहायता है।",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        "Rakhtha Seva — EMERGENCY MATCH",
        "",
        input.summary,
        "",
        `Patient: ${input.patientName}`,
        `Need: ${input.bloodGroup} × ${input.units}`,
        `Hospital: ${input.hospital}, ${input.city}`,
        `Urgency: ${input.urgency}`,
        input.requestId ? `Request: ${input.requestId}` : "",
        "",
        `Eligible donors in Twilio blast (max ${BLAST_CALL_LIMIT}):`,
        donorLines,
        "",
        "Always confirm with the hospital blood bank. Coordination support only — not a medical diagnosis.",
      ]
        .filter(Boolean)
        .join("\n");

  const donorRows = donors.length
    ? donors
        .map(
          (m, i) => `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f0e4df;">${i + 1}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0e4df;"><strong>${escapeHtml(m.full_name)}</strong><br/><span style="color:#6b5a56;font-size:13px;">${escapeHtml(m.area || m.city)}</span></td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0e4df;">${escapeHtml(m.blood_group)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0e4df;">${m.rank_score}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0e4df;">${escapeHtml(m.phone)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" style="padding:14px;color:#6b5a56;">${hi ? "अभी कोई योग्य दाता नहीं" : "No eligible donors yet"}</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f0ea;font-family:Georgia,'Times New Roman',serif;color:#1a1210;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f0ea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fffaf6;border:1px solid #eadfd8;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#8b1e1e;color:#fffaf6;padding:22px 24px;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">${hi ? "रक्त सेवा · जीवनरक्षा" : "Rakhtha Seva · Life-saving seva"}</div>
            <div style="font-size:26px;margin-top:6px;font-weight:700;">${hi ? "आपातकालीन मिलान" : "Emergency match"}</div>
            <div style="margin-top:8px;font-size:15px;opacity:0.95;">${escapeHtml(String(input.bloodGroup))} · ${escapeHtml(input.patientName)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(input.summary)}</p>
            <table role="presentation" width="100%" style="background:#fff1ec;border-radius:12px;margin-bottom:18px;">
              <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
                <strong>${hi ? "मरीज" : "Patient"}:</strong> ${escapeHtml(input.patientName)}<br/>
                <strong>${hi ? "आवश्यकता" : "Need"}:</strong> ${escapeHtml(String(input.bloodGroup))} × ${input.units}<br/>
                <strong>${hi ? "अस्पताल" : "Hospital"}:</strong> ${escapeHtml(input.hospital)}, ${escapeHtml(input.city)}<br/>
                <strong>${hi ? "तात्कालिकता" : "Urgency"}:</strong> ${escapeHtml(String(input.urgency))}
                ${input.requestId ? `<br/><strong>ID:</strong> ${escapeHtml(input.requestId.slice(0, 8))}` : ""}
              </td></tr>
            </table>
            <h3 style="margin:0 0 10px;font-size:17px;color:#8b1e1e;">${hi ? "Twilio blast के योग्य दाता" : "Eligible donors in Twilio blast"}</h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #eadfd8;border-radius:12px;overflow:hidden;font-size:14px;">
              <tr style="background:#f7f0ea;text-align:left;">
                <th style="padding:10px 12px;">#</th>
                <th style="padding:10px 12px;">${hi ? "दाता" : "Donor"}</th>
                <th style="padding:10px 12px;">${hi ? "ग्रुप" : "Group"}</th>
                <th style="padding:10px 12px;">${hi ? "स्कोर" : "Score"}</th>
                <th style="padding:10px 12px;">${hi ? "फोन" : "Phone"}</th>
              </tr>
              ${donorRows}
            </table>
            <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#6b5a56;">
              ${hi
                ? "कृपया अस्पताल ब्लड बैंक से पुष्टि करें। रक्त सेवा समन्वय सहायता है — चिकित्सा निदान नहीं।"
                : "Confirm with the hospital blood bank. Rakhtha Seva is coordination support — not a medical diagnosis."}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 20px;background:#fff1ec;font-size:12px;color:#6b5a56;">
            Rakhtha Seva · AI blood emergency seva
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { to: input.to, subject, text, html };
}
