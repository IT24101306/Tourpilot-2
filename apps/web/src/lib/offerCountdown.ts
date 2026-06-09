export function offerCountdownParts(validUntil: string, nowMs = Date.now()) {
  const ms = new Date(validUntil).getTime() - nowMs;
  if (ms <= 0) {
    return { ended: true as const, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.floor(ms / 1000);
  return {
    ended: false as const,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatOfferCountdown(validUntil: string, nowMs = Date.now()) {
  const parts = offerCountdownParts(validUntil, nowMs);
  if (parts.ended) return "Ended";

  const pad = (n: number) => String(n).padStart(2, "0");
  if (parts.days > 0) {
    return `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
  }
  if (parts.hours > 0) {
    return `${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
  }
  return `${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
}
