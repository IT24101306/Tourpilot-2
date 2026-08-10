import { Router } from "express";
import { z } from "zod";
import { authRequired, getOwnedAgency, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  cancelAgencyReferralInvite,
  createAgencyReferralInvite,
  listAgencyReferrals,
} from "../services/agencyReferral.js";

export const agencyReferralsRouter = Router();

agencyReferralsRouter.use(authRequired, requireRoles("AGENCY"));

agencyReferralsRouter.get("/", async (req, res, next) => {
  try {
    const agency = await getOwnedAgency(req.user!.id);
    if (!agency) {
      return res.status(403).json({ error: "Only the agency owner can manage referrals" });
    }
    res.json(await listAgencyReferrals(agency.id));
  } catch (e) {
    next(e);
  }
});

agencyReferralsRouter.post("/invite", async (req, res, next) => {
  try {
    const body = z.object({ phone: z.string().min(5).max(32) }).parse(req.body);
    const agency = await getOwnedAgency(req.user!.id);
    if (!agency) {
      return res.status(403).json({ error: "Only the agency owner can invite referrals" });
    }
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: agency.ownerId },
      select: { phone: true },
    });
    const invite = await createAgencyReferralInvite({
      referrerAgencyId: agency.id,
      referrerOwnerId: agency.ownerId,
      referrerOwnerPhone: owner.phone,
      referrerStatus: agency.status,
      phoneRaw: body.phone,
    });
    res.status(201).json({
      id: invite.id,
      inviteePhone: invite.inviteePhone,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
      message: "Invite saved. They must register as an agency with this exact phone number.",
    });
  } catch (e) {
    next(e);
  }
});

agencyReferralsRouter.delete("/:id", async (req, res, next) => {
  try {
    const agency = await getOwnedAgency(req.user!.id);
    if (!agency) {
      return res.status(403).json({ error: "Only the agency owner can cancel invites" });
    }
    const invite = await cancelAgencyReferralInvite({
      referrerAgencyId: agency.id,
      inviteId: req.params.id,
    });
    res.json({
      id: invite.id,
      status: invite.status,
      cancelledAt: invite.cancelledAt?.toISOString() ?? null,
    });
  } catch (e) {
    next(e);
  }
});
