const COUNTRY_ALIASES: Array<[string, string]> = [
  ["united states of america", "United States"],
  ["united states", "United States"],
  ["usa", "United States"],
  ["u.s.", "United States"],
  ["u.s.a.", "United States"],
  ["bangladesh", "Bangladesh"],
  ["india", "India"],
  ["malaysia", "Malaysia"],
  ["singapore", "Singapore"],
  ["pakistan", "Pakistan"],
  ["senegal", "Senegal"],
  ["mauritania", "Mauritania"],
  ["gambia", "Gambia"],
  ["russia", "Russia"],
  ["russian federation", "Russia"],
  ["cambodia", "Cambodia"],
  ["germany", "Germany"],
  ["nepal", "Nepal"],
  ["china", "China"],
  ["united kingdom", "United Kingdom"],
  ["korea (rep. of)", "South Korea"],
  ["sweden", "Sweden"],
  ["denmark", "Denmark"],
  ["austria", "Austria"],
  ["poland", "Poland"],
  ["romania", "Romania"],
  ["finland", "Finland"],
  ["bhutan", "Bhutan"],
  ["nepal", "Nepal"],
  ["thailand", "Thailand"],
  ["saudi arabia", "Saudi Arabia"],
  ["kenya", "Kenya"],
  ["south africa", "South Africa"],
  ["尼泊尔", "Nepal"],
  ["美国", "United States"],
  ["孟加拉国", "Bangladesh"],
  ["印度", "India"],
  ["马来西亚", "Malaysia"],
  ["新加坡", "Singapore"],
  ["巴基斯坦", "Pakistan"],
  ["塞内加尔", "Senegal"],
  ["毛里塔尼亚", "Mauritania"],
  ["冈比亚", "Gambia"],
  ["俄罗斯", "Russia"],
  ["柬埔寨", "Cambodia"],
  ["德国", "Germany"],
  ["中国", "China"],
  ["英国", "United Kingdom"],
  ["韩国", "South Korea"],
  ["瑞典", "Sweden"],
  ["丹麦", "Denmark"],
  ["奥地利", "Austria"],
  ["波兰", "Poland"],
  ["罗马尼亚", "Romania"],
  ["芬兰", "Finland"],
  ["不丹", "Bhutan"],
  ["泰国", "Thailand"],
  ["沙特", "Saudi Arabia"],
  ["肯尼亚", "Kenya"],
  ["南非", "South Africa"],
];

const REGION_SEPARATORS = [":", ",", "-", "：", "，", "、", "/"];

export interface NormalizedLocation {
  country: string | null;
  region: string | null;
  rawLocation: string | null;
}

export function normalizeLocation(rawValue?: string | null): NormalizedLocation {
  const cleaned = rawValue?.replace(/\s+/g, " ").trim() || null;

  if (!cleaned) {
    return { country: null, region: null, rawLocation: null };
  }

  const lower = cleaned.toLowerCase();
  const country = COUNTRY_ALIASES.find(([alias]) => lower.includes(alias.toLowerCase()))?.[1] ?? null;

  let region: string | null = null;
  if (country) {
    for (const separator of REGION_SEPARATORS) {
      if (!cleaned.includes(separator)) {
        continue;
      }

      const parts = cleaned
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length <= 1) {
        continue;
      }

      const maybeRegion = parts.find(
        (part) =>
          part.toLowerCase() !== country.toLowerCase() &&
          !COUNTRY_ALIASES.some(([alias]) => alias.toLowerCase() === part.toLowerCase()),
      );
      if (maybeRegion) {
        region = maybeRegion;
        break;
      }
    }
  }

  if (!region && country && cleaned.toLowerCase() !== country.toLowerCase()) {
    region = cleaned;
  }

  return { country, region, rawLocation: cleaned };
}

export function extractCountryFromTitle(title: string) {
  const parts = title.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return normalizeLocation(parts[parts.length - 1]).country;
  }

  return normalizeLocation(title).country;
}
