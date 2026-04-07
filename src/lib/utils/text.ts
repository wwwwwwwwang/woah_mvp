import crypto from "node:crypto";

export function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function extractYear(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

export function extractInteger(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ""));
    }
  }

  return null;
}

export function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function summarizeParagraphs(paragraphs: string[], limit = 3) {
  return paragraphs
    .map((paragraph) => compactText(paragraph))
    .filter(Boolean)
    .slice(0, limit)
    .join(" ");
}

export function firstMatchingKeyword(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.find((keyword) => lower.includes(keyword.toLowerCase())) ?? null;
}

export function extractKeywordContext(text: string, keyword: string, radius = 160) {
  const lower = text.toLowerCase();
  const index = lower.indexOf(keyword.toLowerCase());
  if (index === -1) {
    return compactText(text.slice(0, radius * 2));
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + keyword.length + radius);
  return compactText(text.slice(start, end));
}
