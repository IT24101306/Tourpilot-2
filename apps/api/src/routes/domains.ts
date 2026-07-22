import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { publicAgencyWhere } from "../lib/publicVisibility.js";

export const domainsRouter = Router();

function normalizeHost(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/\.$/, "").split(":")[0];
}

function isPlatformHost(host: string): boolean {
  const bare = host.replace(/^www\./, "");
  return config.customDomain.platformDomains.includes(bare);
}

/** Match a host against its apex and www variants. */
function hostVariants(host: string): string[] {
  const bare = host.replace(/^www\./, "");
  return Array.from(new Set([host, bare, `www.${bare}`]));
}

async function findActiveAgencyByHost(host: string) {
  if (!host) return null;
  return prisma.agency.findFirst({
    where: {
      customDomain: { in: hostVariants(host) },
      customDomainStatus: "ACTIVE",
      ...publicAgencyWhere(),
    },
    select: { slug: true, name: true },
  });
}

/**
 * Caddy On-Demand TLS "ask" endpoint. Caddy calls this before issuing a
 * certificate for a host; we only allow platform domains and verified,
 * active agency custom domains so cert issuance can't be abused.
 */
domainsRouter.get("/tls/check", async (req, res, next) => {
  try {
    const host = normalizeHost(req.query.domain);
    if (!host) return res.status(400).json({ error: "domain required" });
    if (isPlatformHost(host)) return res.status(200).json({ ok: true });
    const agency = await findActiveAgencyByHost(host);
    if (agency) return res.status(200).json({ ok: true });
    return res.status(404).json({ error: "unknown host" });
  } catch (e) {
    next(e);
  }
});

/**
 * Resolve an incoming Host to the agency storefront it should render. The SPA
 * calls this on load when it detects it is not running on a platform domain.
 */
domainsRouter.get("/public-site", async (req, res, next) => {
  try {
    const host = normalizeHost(req.query.host);
    if (!host || isPlatformHost(host)) {
      return res.status(404).json({ error: "not a custom domain" });
    }
    const agency = await findActiveAgencyByHost(host);
    if (!agency) return res.status(404).json({ error: "not found" });
    return res.json({ slug: agency.slug, name: agency.name });
  } catch (e) {
    next(e);
  }
});
