import { describe, expect, it } from "vitest";

import { extractCountryFromTitle, normalizeLocation } from "@/lib/utils/location";

describe("location helpers", () => {
  it("normalizes english and chinese country names", () => {
    expect(normalizeLocation("Rajshahi Division, Bangladesh").country).toBe("Bangladesh");
    expect(normalizeLocation("柬埔寨").country).toBe("Cambodia");
  });

  it("extracts country suffix from titles", () => {
    expect(extractCountryFromTitle("Nipah virus infection - Bangladesh")).toBe("Bangladesh");
  });
});
