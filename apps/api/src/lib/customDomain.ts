import { promises as dns } from "node:dns";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

export type DomainRow = {
  customDomain: string | null;
  customDomainStatus: string;
  customDomainVerifiedAt: Date | null;
};

export const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .split(":")[0];
}

export function serializeDomain(row: DomainRow) {
  const { aTarget, cnameTarget } = config.customDomain;
  return {
    domain: row.customDomain,
    status: row.customDomainStatus,
    verifiedAt: row.customDomainVerifiedAt,
    instructions: {
      aRecord: aTarget ? { type: "A", host: "@", value: aTarget } : null,
      cname: cnameTarget ? { type: "CNAME", host: "www", value: cnameTarget } : null,
    },
  };
}

/** True if another agency or influencer already claimed this exact domain. */
export async function isDomainTaken(
  domain: string,
  except?: { agencyId?: string; influencerId?: string }
): Promise<boolean> {
  const [agency, influencer] = await Promise.all([
    prisma.agency.findFirst({
      where: {
        customDomain: domain,
        ...(except?.agencyId ? { NOT: { id: except.agencyId } } : {}),
      },
      select: { id: true },
    }),
    prisma.influencerProfile.findFirst({
      where: {
        customDomain: domain,
        ...(except?.influencerId ? { NOT: { id: except.influencerId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  return Boolean(agency || influencer);
}

export async function verifyDomainDns(host: string): Promise<{
  ok: boolean;
  resolved: string[];
}> {
  const { aTarget, cnameTarget } = config.customDomain;
  const addrs = await dns.resolve4(host).catch(() => [] as string[]);
  let ok = false;
  if (aTarget && addrs.includes(aTarget)) {
    ok = true;
  } else if (cnameTarget) {
    const cnames = await dns.resolveCname(host).catch(() => [] as string[]);
    ok = cnames.some(
      (c) => c.replace(/\.$/, "").toLowerCase() === cnameTarget.toLowerCase()
    );
  }
  return { ok, resolved: addrs };
}

export function dnsExpectedHint(): string {
  const { aTarget, cnameTarget } = config.customDomain;
  if (aTarget) return `an A record pointing to ${aTarget}`;
  if (cnameTarget) return `a CNAME pointing to ${cnameTarget}`;
  return "the DNS record we provided";
}
