/** Trip-room contact-sharing policy. Server is the source of truth. */

export const CHAT_POLICY_PINNED_NOTICE =
  "Sharing phone numbers, email, social links, or other personal contact details is a policy violation.";

export const CHAT_POLICY_REMOVED_NOTICE =
  "Message removed — sharing personal details is not allowed.";

export const CHAT_POLICY_PAUSED_NOTICE =
  "This chat is paused for a policy review. An admin will reopen it after review.";

export type ChatPolicyCategory =
  | "PHONE"
  | "EMAIL"
  | "SOCIAL"
  | "MESSAGING_INVITE"
  | "ADDRESS"
  | "IDENTITY"
  | "OFF_PLATFORM_PAY";

export type ChatPolicyHit = {
  categories: ChatPolicyCategory[];
};

const CATEGORY_LABELS: Record<ChatPolicyCategory, string> = {
  PHONE: "Phone number",
  EMAIL: "Email address",
  SOCIAL: "Social media / off-platform link",
  MESSAGING_INVITE: "Off-platform messaging invite",
  ADDRESS: "Personal address",
  IDENTITY: "ID / passport",
  OFF_PLATFORM_PAY: "Off-platform payment details",
};

export function chatPolicyCategoryLabel(category: ChatPolicyCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

function fold(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[＠]/g, "@")
    .toLowerCase();
}

function around(text: string, index: number, before = 18, after = 22): string {
  return text.slice(Math.max(0, index - before), Math.min(text.length, index + after));
}

function hasNegationNear(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 28), index);
  return /\b(don'?t|do not|never|avoid|not|no)\b/i.test(before);
}

function looksLikeMoney(context: string): boolean {
  return /\b(lkr|rs\.?|rupees?|usd|eur|gbp|price|cost|budget|total|per person|\/pax|credits?)\b/i.test(
    context
  );
}

function looksLikeDate(digits: string, raw: string): boolean {
  if (/^\d{8}$/.test(digits) && /[\/.\-]/.test(raw)) return true;
  if (/^(19|20)\d{6}$/.test(digits)) return true;
  return false;
}

function collectPhoneHits(text: string, categories: Set<ChatPolicyCategory>) {
  const chunkRe = /(?:\+\s*)?\d(?:[\s().\-]*\d){7,14}/g;
  let m: RegExpExecArray | null;
  while ((m = chunkRe.exec(text))) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, "");
    const ctx = around(text, m.index);
    if (looksLikeMoney(ctx) || looksLikeDate(digits, raw)) continue;

    const slMobile =
      /^0?7\d{8}$/.test(digits) ||
      /^947\d{8}$/.test(digits) ||
      /^0947\d{8}$/.test(digits);
    const intl = raw.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15;
    const slLandline = /^0[1-9]\d{8}$/.test(digits) || /^94[1-9]\d{8}$/.test(digits);

    if (slMobile || intl || slLandline) {
      categories.add("PHONE");
      return;
    }
  }

  if (
    /\b(?:zero|oh)\s*(?:seven|7)\s*(?:seven|7)\b/.test(text) ||
    /\b(?:plus\s*)?(?:ninety[\s-]*four|94)\s*(?:seven|7)\b/.test(text)
  ) {
    categories.add("PHONE");
  }
}

function collectEmailHits(text: string, categories: Set<ChatPolicyCategory>) {
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    categories.add("EMAIL");
    return;
  }
  if (
    /[a-z0-9._%+-]+\s*(?:\[at\]|\(at\)|\bat\b)\s*[a-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*[a-z]{2,}/i.test(
      text
    )
  ) {
    categories.add("EMAIL");
    return;
  }
  if (/\b(?:gmail|yahoo|hotmail|outlook)\s*(?:is|:)\s*[\w.]+/.test(text)) {
    categories.add("EMAIL");
  }
}

function collectSocialHits(text: string, categories: Set<ChatPolicyCategory>) {
  if (
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am|facebook\.com|fb\.com|fb\.me|tiktok\.com|twitter\.com|linkedin\.com|t\.me|telegram\.me|snapchat\.com|wa\.me|api\.whatsapp\.com|linktr\.ee|bit\.ly|tinyurl\.com|cutt\.ly)(?:\/|\b)/i.test(
      text
    )
  ) {
    categories.add("SOCIAL");
    return;
  }
  if (/(?:^|[^a-z])x\.com\/[a-z0-9_.]+/i.test(text)) {
    categories.add("SOCIAL");
    return;
  }
  if (/youtube\.com\/(?:@|c\/|channel\/)/i.test(text)) {
    categories.add("SOCIAL");
    return;
  }
  if (
    /\b(?:ig|insta|instagram|fb|facebook|tiktok|twitter|telegram|tele|snap|whatsapp)\s*[:\-]\s*@?[\w.]{2,30}\b/.test(
      text
    )
  ) {
    categories.add("SOCIAL");
    return;
  }
  if (
    /\b(?:my\s+)?(?:instagram|insta|ig|facebook|fb|tiktok|telegram)\s+(?:is|handle|user(?:name)?)\s*[:\-]?\s*@?[\w.]{2,30}\b/.test(
      text
    )
  ) {
    categories.add("SOCIAL");
  }
}

function collectInviteHits(text: string, categories: Set<ChatPolicyCategory>) {
  const patterns: RegExp[] = [
    /\b(?:whatsapp|viber|imo|wechat|signal)\s+(?:me|us|this)\b/g,
    /\b(?:call|text|sms|ping)\s+me\b/g,
    /\badd me on\b/g,
    /\bmy (?:whatsapp|viber|imo|wechat|signal)\b/g,
    /\bmessage me (?:on|via|at)\b/g,
    /\bcontact me (?:on|via|at|outside)\b/g,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!hasNegationNear(text, m.index)) {
        categories.add("MESSAGING_INVITE");
        return;
      }
    }
  }
}

function collectAddressHits(text: string, categories: Set<ChatPolicyCategory>) {
  if (
    /\b\d{1,5}[a-z]?\s+[a-z][\w.'-]{1,24}(?:\s+[a-z][\w.'-]{1,24}){0,4}\s+(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|mawatha|mw\.?|watta|place|pl\.?)\b/.test(
      text
    )
  ) {
    categories.add("ADDRESS");
    return;
  }
  if (
    /\b(?:my house|my home|my place|come to my (?:house|home|place|office)|my office address)\b/.test(
      text
    )
  ) {
    categories.add("ADDRESS");
  }
}

function collectIdentityHits(text: string, categories: Set<ChatPolicyCategory>) {
  if (/\b(?:nic|national id)\b.{0,16}\b\d{9}[vx]\b/.test(text)) {
    categories.add("IDENTITY");
    return;
  }
  if (/\b\d{9}[vx]\b.{0,16}\b(?:nic|national id)\b/.test(text)) {
    categories.add("IDENTITY");
    return;
  }
  if (/\bpassport\b.{0,16}\b[a-z]\d{7}\b/.test(text)) {
    categories.add("IDENTITY");
  }
}

function collectPayHits(text: string, categories: Set<ChatPolicyCategory>) {
  if (/paypal\.me\//i.test(text) || /\bvenmo\b/.test(text) || /wise\.com\/pay/i.test(text)) {
    categories.add("OFF_PLATFORM_PAY");
    return;
  }
  if (/\b(?:bank account|account (?:no\.?|number|num)|acc\s*no\.?|iban)\b/.test(text)) {
    categories.add("OFF_PLATFORM_PAY");
  }
}

/** Returns a hit when the message tries to take contact or payment off TourPilot. */
export function scanChatPolicy(raw: string): ChatPolicyHit | null {
  const text = fold(raw).trim();
  if (!text) return null;

  const categories = new Set<ChatPolicyCategory>();
  collectPhoneHits(text, categories);
  collectEmailHits(text, categories);
  collectSocialHits(text, categories);
  collectInviteHits(text, categories);
  collectAddressHits(text, categories);
  collectIdentityHits(text, categories);
  collectPayHits(text, categories);

  if (!categories.size) return null;
  return { categories: [...categories] };
}
