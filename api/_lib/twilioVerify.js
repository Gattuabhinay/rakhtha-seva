/** Twilio Verify — real SMS OTP on the user's phone (no on-screen code). */

function basicAuth(sid, token) {
  return Buffer.from(`${sid}:${token}`).toString("base64");
}

export function twilioCreds(env) {
  const sid = env.TWILIO_OTP_ACCOUNT_SID?.trim() || env.TWILIO_ACCOUNT_SID?.trim() || "";
  const token = env.TWILIO_OTP_AUTH_TOKEN?.trim() || env.TWILIO_AUTH_TOKEN?.trim() || "";
  return { sid, token };
}

export async function resolveVerifyServiceSid(env, sid, token) {
  const configured = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (configured) return configured;

  const auth = basicAuth(sid, token);
  const listRes = await fetch("https://verify.twilio.com/v2/Services?PageSize=20", {
    headers: { Authorization: `Basic ${auth}` },
  });
  const listData = await listRes.json();
  if (listRes.ok) {
    const services = listData.services || [];
    const named =
      services.find((s) => /rakhtha|otp|seva/i.test(String(s.friendly_name || ""))) ||
      services[0];
    if (named?.sid) return named.sid;
  }

  const createRes = await fetch("https://verify.twilio.com/v2/Services", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      FriendlyName: "Rakhtha Seva OTP",
      CodeLength: "6",
    }).toString(),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created.sid) {
    throw new Error(
      created.message ||
        "Could not start Twilio Verify. In Twilio Console → Verify → Create Service, then set TWILIO_VERIFY_SERVICE_SID in .env.local.",
    );
  }
  return created.sid;
}

export async function startSmsVerification(env, phone) {
  const { sid, token } = twilioCreds(env);
  if (!sid || !token) {
    throw new Error(
      "Twilio not configured. Admin: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN to .env.local.",
    );
  }
  const serviceSid = await resolveVerifyServiceSid(env, sid, token);
  const auth = basicAuth(sid, token);
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Channel: "sms" }).toString(),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || "Twilio could not send OTP SMS.";
    const code = data.code;
    if (code === 21608 || /unverified|trial accounts cannot send/i.test(msg)) {
      throw new Error(
        "Twilio trial cannot SMS this number until you verify it. Open https://console.twilio.com/us1/develop/phone-numbers/manage/verified → Add a verified caller ID → enter this mobile → complete the call/SMS verify → then tap Send OTP again. (This is Twilio SMS, not SendGrid.)",
      );
    }
    throw new Error(msg);
  }
  return { serviceSid, status: data.status, to: data.to || phone };
}

export async function checkSmsVerification(env, phone, code, serviceSidHint) {
  const { sid, token } = twilioCreds(env);
  if (!sid || !token) {
    throw new Error("Twilio not configured.");
  }
  const serviceSid =
    serviceSidHint || (await resolveVerifyServiceSid(env, sid, token));
  const auth = basicAuth(sid, token);
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Checks`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, Code: code }).toString(),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Incorrect or expired OTP.");
  }
  if (data.status !== "approved") {
    throw new Error("Incorrect OTP. Check the SMS on your phone and try again.");
  }
  return true;
}
