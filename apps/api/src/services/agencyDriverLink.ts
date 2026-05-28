import type { Prisma } from "@prisma/client";
import { isValidInternationalPhone, toStoredPhone } from "../utils/phone.js";

/** Map agency driver status labels to driver profile status values. */
export function profileStatusFromAgency(status: string) {
  if (status === "On Tour") return "on_tour";
  if (status === "Off Duty") return "off_duty";
  return "available";
}

export type ProvisionDriverInput = {
  name: string;
  phone: string;
  licenseNo?: string;
  vehicle?: string;
  status: string;
};

/**
 * Ensure a DRIVER user exists for this phone (create if missing). Returns user id.
 */
export async function ensureDriverUserAccount(
  tx: Prisma.TransactionClient,
  input: ProvisionDriverInput
): Promise<{ userId: string; created: boolean }> {
  const phone = toStoredPhone(input.phone);
  if (!isValidInternationalPhone(phone)) {
    throw Object.assign(new Error("Invalid phone number. Use country code (e.g. +94771234567)."), {
      status: 400,
    });
  }

  const existing = await tx.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.role !== "DRIVER") {
      throw Object.assign(
        new Error("This phone is already used by another account type. Use a different number."),
        { status: 409 }
      );
    }

    const otherAgencyLink = await tx.agencyDriver.findFirst({
      where: { userId: existing.id },
    });
    // Caller checks agency conflict separately when linking

    await tx.driverProfile.upsert({
      where: { userId: existing.id },
      create: {
        userId: existing.id,
        licenseNo: input.licenseNo,
        vehicle: input.vehicle,
        status: profileStatusFromAgency(input.status),
        blockedDates: [],
        metadata: {},
      },
      update: {
        licenseNo: input.licenseNo ?? undefined,
        vehicle: input.vehicle ?? undefined,
        status: profileStatusFromAgency(input.status),
      },
    });

    if (existing.name !== input.name.trim()) {
      await tx.user.update({
        where: { id: existing.id },
        data: { name: input.name.trim() },
      });
    }

    return { userId: existing.id, created: false };
  }

  const created = await tx.user.create({
    data: {
      phone,
      name: input.name.trim(),
      role: "DRIVER",
      walletBalance: 0,
    },
  });

  await tx.driverProfile.create({
    data: {
      userId: created.id,
      licenseNo: input.licenseNo,
      vehicle: input.vehicle,
      status: profileStatusFromAgency(input.status),
      blockedDates: [],
      metadata: {},
    },
  });

  return { userId: created.id, created: true };
}

/**
 * When a driver self-registers, attach to an agency row created without a linked user.
 */
export async function linkAgencyDriverOnDriverSignup(
  tx: Prisma.TransactionClient,
  userId: string,
  phone: string
) {
  const pending = await tx.agencyDriver.findFirst({
    where: { phone, userId: null },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return null;

  const linked = await tx.agencyDriver.update({
    where: { id: pending.id },
    data: { userId },
  });

  const profile = await tx.driverProfile.findUnique({ where: { userId } });
  if (profile) {
    await tx.driverProfile.update({
      where: { userId },
      data: {
        licenseNo: profile.licenseNo || pending.licenseNo,
        vehicle: profile.vehicle || pending.vehicle,
        status: profileStatusFromAgency(pending.status),
      },
    });
  }

  return linked;
}
