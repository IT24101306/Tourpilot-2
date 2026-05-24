export function buildReferralSharePath(tour: {
  slug: string;
  agency: { slug: string };
} | null | undefined) {
  if (tour?.agency?.slug && tour.slug) {
    return `/tours/${tour.agency.slug}/${tour.slug}`;
  }
  return "/agencies";
}

export function buildReferralShareUrl(
  origin: string,
  tour: { slug: string; agency: { slug: string } } | null | undefined,
  code: string
) {
  const path = buildReferralSharePath(tour);
  return `${origin.replace(/\/$/, "")}${path}?ref=${encodeURIComponent(code)}`;
}
