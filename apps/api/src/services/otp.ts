import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { asJson } from "../utils/json.js";
import { finalizeEmailTemplate, otpEmail, sendPlatformEmail } from "./email.js";

function generateOtp(): string {
  if (config.devBypassOtp) return config.devBypassOtpCode;
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function deliverOtpByEmail(
  phone: string,
  otp: string,
  purpose: string,
  payload?: Record<string, unknown>
) {
  let email =
    typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  let name = typeof payload?.name === "string" ? payload.name.trim() : "";

  if (!email) {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { email: true, name: true },
    });
    email = user?.email?.trim().toLowerCase() || "";
    if (!name) name = user?.name?.trim() || "";
  }

  if (!email) return;

  try {
    const content = await finalizeEmailTemplate(
      "otp",
      otpEmail({ recipientName: name || undefined, otp, purpose }),
      {
        recipientName: name || "there",
        otp,
        purpose,
      }
    );
    const result = await sendPlatformEmail({ to: email, ...content });
    if (!result.delivered) {
      console.error("[otp email]", result.error || "not delivered");
    }
  } catch (err) {
    console.error("[otp email]", err);
  }
}

export async function createOtpChallenge(
  phone: string,
  purpose: string,
  payload?: Record<string, unknown>
) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const challenge = await prisma.otpChallenge.create({
    data: {
      phone,
      otpHash,
      purpose,
      payload: asJson(payload ?? {}),
      expiresAt,
    },
  });

  if (config.logOtpToConsole) {
    const mins = Math.round((expiresAt.getTime() - Date.now()) / 60000);
    console.log(
      [
        "",
        "┌─────────────────────────────────────────",
        "│ TourPilot DEV OTP",
        `│ Phone:    ${phone}`,
        `│ Purpose:  ${purpose}`,
        `│ OTP:      ${otp}`,
        `│ Challenge: ${challenge.id}`,
        `│ Expires:  ~${mins} min`,
        config.devBypassOtp ? `│ Bypass:   also accepts ${config.devBypassOtpCode}` : "",
        "└─────────────────────────────────────────",
        "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  void deliverOtpByEmail(phone, otp, purpose, payload);

  return {
    challengeId: challenge.id,
    otp: config.demoOtpInResponse || config.devBypassOtp ? otp : undefined,
    bypassOtp: config.devBypassOtp ? config.devBypassOtpCode : undefined,
    expiresAt,
  };
}

export async function verifyOtpChallenge(
  challengeId: string,
  phone: string,
  otp: string,
  purpose: string
) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: { id: challengeId, phone, purpose },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    const err = new Error("OTP expired or invalid");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const bypassed =
    config.devBypassOtp && otp.trim() === config.devBypassOtpCode;
  const valid = bypassed || (await bcrypt.compare(otp, challenge.otpHash));
  if (!valid) {
    const err = new Error("Invalid OTP");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  await prisma.otpChallenge.delete({ where: { id: challenge.id } });
  return (challenge.payload as Record<string, unknown>) || {};
}

export function createShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

const LOGIN_TOPUP_PURPOSES = ["login", "login_pending"] as const;

export async function assertLoginTopupChallenge(challengeId: string, phone: string) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      id: challengeId,
      phone,
      purpose: { in: [...LOGIN_TOPUP_PURPOSES] },
    },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    const err = new Error("Login session expired. Go back and enter your phone again.");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  return challenge;
}
