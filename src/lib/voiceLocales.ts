export type AlertLang = "en" | "hi";

export const ALERT_LANGS: { id: AlertLang; label: string; note: string }[] = [
  { id: "en", label: "English", note: "Flash v2.5 · demo default" },
  { id: "hi", label: "हिन्दी", note: "Flash v2.5 · Hindi TTS" },
];

export function buildListenScript(input: {
  lang: AlertLang;
  summary: string;
  topDonorName?: string;
  topDonorGroup?: string;
  topDonorArea?: string;
}): string {
  if (input.lang === "hi") {
    const top = input.topDonorName
      ? ` शीर्ष योग्य दाता: ${input.topDonorName}, ब्लड ग्रुप ${input.topDonorGroup || ""}, क्षेत्र ${input.topDonorArea || ""}।`
      : " अभी कोई योग्य दाता तैयार नहीं है। अस्पताल ब्लड बैंक से संपर्क करें।";
    return (
      `रक्त सेवा आपातकालीन मिलान। ${input.summary} ${top} ` +
      `कृपया अस्पताल ब्लड बैंक से पुष्टि करें।`
    ).trim();
  }

  const top = input.topDonorName
    ? ` Top eligible donor: ${input.topDonorName}, blood group ${input.topDonorGroup || ""}, area ${input.topDonorArea || ""}.`
    : " No eligible donor is ready yet. Contact the hospital blood bank.";
  return `${input.summary}${top}`.trim();
}

export function buildCallScript(input: {
  lang: AlertLang;
  patientName: string;
  bloodGroup: string;
  units: number;
  hospital: string;
  city: string;
}): string {
  if (input.lang === "hi") {
    return (
      `रक्त सेवा से जरूरी रक्त अनुरोध। मरीज ${input.patientName} को ${input.hospital}, ${input.city} में ` +
      `${input.units} यूनिट ${input.bloodGroup} रक्त की आवश्यकता है। आपका ब्लड ग्रुप मैच है। ` +
      `यदि आप अभी दान कर सकते हैं, तो व्हाट्सऐप पर जवाब दें या अस्पताल ब्लड बैंक को कॉल करें। जीवन बचाने के लिए धन्यवाद।`
    );
  }

  return (
    `Urgent blood request from Rakhtha Seva. Patient ${input.patientName} needs ${input.units} unit of ${input.bloodGroup} at ${input.hospital}, ${input.city}. ` +
    `Your blood group is a match. If you can donate now, please reply on WhatsApp or call the hospital blood bank. Thank you for saving a life.`
  );
}

/** Twilio Polly voice + language for one-way call read. */
export function twilioVoiceForLang(lang: AlertLang): { voice: string; language: string } {
  if (lang === "hi") return { voice: "Polly.Aditi", language: "hi-IN" };
  return { voice: "Polly.Aditi", language: "en-IN" };
}
