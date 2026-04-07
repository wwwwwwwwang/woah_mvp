import { describe, expect, it } from "vitest";

import { parseWhoArticle } from "@/lib/sources/who";

const sampleHtml = `
  <main>
    <p>On 3 February 2026, the Bangladesh IHR NFP notified WHO of one confirmed case of NiV infection that occurred in Rajshahi Division, northwestern Bangladesh.</p>
    <p>The patient died the same day.</p>
    <p>A total of 35 contact persons has been identified and no additional cases have been identified.</p>
  </main>
`;

describe("parseWhoArticle", () => {
  it("extracts summary and one-case fatality pattern", () => {
    const parsed = parseWhoArticle(sampleHtml);

    expect(parsed.caseCount).toBe(1);
    expect(parsed.deathCount).toBe(1);
    expect(parsed.summary).toContain("Bangladesh");
  });
});
