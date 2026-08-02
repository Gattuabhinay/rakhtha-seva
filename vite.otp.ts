import type { Plugin } from "vite";
import { loadEnv } from "vite";
import {
  OTP_TTL_MS,
  SESSION_TTL_MS,
  mintSessionToken,
  otpSecret,
  readSmsPendingTicket,
  toE164India,
  verifyOtpTicket,
  verifySessionToken,
} from "./api/_lib/tickets.js";
import { checkSmsVerification } from "./api/_lib/twilioVerify.js";
import { deliverOtp } from "./api/_lib/otpDelivery.js";

function readJson(req: import("http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(
  res: import("http").ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export function otpApiPlugin(): Plugin {
  return {
    name: "rakhtha-otp-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";

        if (url === "/api/otp-status" && req.method === "GET") {
          json(res, 200, {
            twilioOtp: Boolean(
              (env.TWILIO_OTP_ACCOUNT_SID?.trim() || env.TWILIO_ACCOUNT_SID?.trim()) &&
                (env.TWILIO_OTP_AUTH_TOKEN?.trim() || env.TWILIO_AUTH_TOKEN?.trim()) &&
                (env.TWILIO_OTP_FROM_NUMBER?.trim() || env.TWILIO_FROM_NUMBER?.trim()),
            ),
            fast2sms: Boolean(env.FAST2SMS_API_KEY?.trim()),
            preferredChannel: "auto",
            twilioVoiceBackup: true,
          });
          return;
        }

        if (url === "/api/send-otp" && req.method === "POST") {
          try {
            const body = await readJson(req);
            const phone = toE164India(String(body.phone ?? ""));
            if (!phone) {
              json(res, 400, { error: "Enter a valid Indian mobile number." });
              return;
            }
            const raw = String(body.channel ?? "auto").toLowerCase();
            const channel = raw === "voice" || raw === "sms" ? raw : "auto";
            const result = await deliverOtp(env, phone, channel);
            json(res, 200, {
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
            });
          } catch (e) {
            json(res, 502, { error: e instanceof Error ? e.message : "OTP send failed" });
          }
          return;
        }

        if (url === "/api/verify-otp" && req.method === "POST") {
          try {
            const body = await readJson(req);
            const phone = toE164India(String(body.phone ?? ""));
            const code = String(body.code ?? "").replace(/\D/g, "");
            const otpTicket = String(body.otpTicket ?? "").trim();
            if (!phone || code.length !== 6) {
              json(res, 400, { error: "Enter the 6-digit OTP from the call or SMS." });
              return;
            }
            if (!otpTicket) {
              json(res, 400, { error: "No OTP pending. Request a call/SMS first." });
              return;
            }

            const secret = otpSecret(env);
            const smsPending = readSmsPendingTicket(secret, phone, otpTicket);
            if (smsPending) {
              try {
                await checkSmsVerification(env, phone, code, smsPending.serviceSid);
              } catch (e) {
                json(res, 400, {
                  error: e instanceof Error ? e.message : "Incorrect or expired OTP.",
                });
                return;
              }
            } else if (!verifyOtpTicket(secret, phone, code, otpTicket)) {
              json(res, 400, { error: "Incorrect or expired OTP. Request a new code." });
              return;
            }

            const { token } = mintSessionToken(secret, phone);
            json(res, 200, {
              ok: true,
              phone,
              verifiedToken: token,
              expiresInSec: Math.floor(SESSION_TTL_MS / 1000),
            });
          } catch (e) {
            json(res, 500, { error: e instanceof Error ? e.message : "OTP verify failed" });
          }
          return;
        }

        if (url === "/api/confirm-otp-session" && req.method === "POST") {
          try {
            const body = await readJson(req);
            const phone = toE164India(String(body.phone ?? ""));
            const verifiedToken = String(body.verifiedToken ?? "").trim();
            if (!phone || !verifiedToken) {
              json(res, 400, { error: "Missing phone or verified token." });
              return;
            }
            if (!verifySessionToken(otpSecret(env), phone, verifiedToken)) {
              json(res, 401, { error: "Phone verification expired. Verify OTP again." });
              return;
            }
            json(res, 200, { ok: true, phone });
          } catch (e) {
            json(res, 500, { error: e instanceof Error ? e.message : "Session check failed" });
          }
          return;
        }

        return next();
      });
    },
  };
}
