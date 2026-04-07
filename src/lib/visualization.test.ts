import { describe, expect, it } from "vitest";

import {
  buildVisualizationOutbreakHref,
  buildVisualizationSequenceHref,
  getTrendBucketStart,
  parseVisualizationFilters,
  resolveMapCountry,
} from "@/lib/visualization";
import type { VisualizationFilters } from "@/lib/types";

describe("visualization helpers", () => {
  const baseFilters: VisualizationFilters = {
    pathogenCode: null,
    sourceSystem: null,
    scope: null,
    window: "90",
  };

  it("parses filters with sane defaults", () => {
    expect(
      parseVisualizationFilters({
        pathogen: "H5N1",
        sourceSystem: "WOAH",
        scope: "animal",
        window: "30",
      }),
    ).toEqual({
      pathogenCode: "H5N1",
      sourceSystem: "WOAH",
      scope: "animal",
      window: "30",
    });

    expect(
      parseVisualizationFilters({
        sourceSystem: "NCBI",
        scope: "invalid",
        window: "unexpected",
      }),
    ).toEqual({
      pathogenCode: null,
      sourceSystem: null,
      scope: null,
      window: "90",
    });
  });

  it("builds outbreak drilldown hrefs with time filters", () => {
    const href = buildVisualizationOutbreakHref(
      {
        pathogenCode: "H5N1",
        sourceSystem: "WOAH",
        scope: "animal",
        window: "30",
      },
      { country: "United Kingdom" },
    );

    expect(href).toContain("/outbreaks?");
    expect(href).toContain("pathogen=H5N1");
    expect(href).toContain("sourceSystem=WOAH");
    expect(href).toContain("scope=animal");
    expect(href).toContain("country=United+Kingdom");
    expect(href).toContain("from=");
  });

  it("omits time filters for all-history views", () => {
    const href = buildVisualizationOutbreakHref(
      {
        ...baseFilters,
        window: "all",
      },
      { pathogen: "RVF" },
    );

    expect(href).toContain("pathogen=RVF");
    expect(href).not.toContain("from=");
  });

  it("builds sequence drilldown hrefs from pathogen and country", () => {
    const href = buildVisualizationSequenceHref(
      {
        ...baseFilters,
        pathogenCode: "NIPAH",
      },
      { country: "Bangladesh" },
    );

    expect(href).toBe("/sequences?pathogen=NIPAH&country=Bangladesh");
  });

  it("resolves map aliases to world-map country names", () => {
    expect(resolveMapCountry("United States")?.name).toBe("United States of America");
    expect(resolveMapCountry("Central African Republic")?.name).toBe("Central African Rep.");
    expect(resolveMapCountry("Unknown Country")).toBeNull();
  });

  it("buckets 30/90-day windows by week and all-history by month", () => {
    const sample = new Date("2026-03-25T08:00:00.000Z");

    expect(getTrendBucketStart(sample, "30").toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(getTrendBucketStart(sample, "90").toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(getTrendBucketStart(sample, "all").toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});
