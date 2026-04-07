import { describe, expect, it } from "vitest";

import { buildChinaCdcOutbreakFromText } from "@/lib/sources/china-cdc";

describe("buildChinaCdcOutbreakFromText", () => {
  it("builds outbreak records from China CDC PDF text and keeps source flow links", () => {
    const outbreak = buildChinaCdcOutbreakFromText(
      "2025年4月，孟加拉国报告尼帕病毒病病例，提示该事件仍存在持续输入风险。",
      {
        title: "2025年4月全球传染病事件风险评估",
        listUrl: "https://www.chinacdc.cn/jksj/jksj03/index.html",
        detailUrl: "https://www.chinacdc.cn/jksj/jksj03/202505/P020250519553920700486.pdf",
        publishedAtRaw: "2025-05-19",
        sourceDetailUrl: null,
        documentUrl: "https://www.chinacdc.cn/jksj/jksj03/202505/P020250519553920700486.pdf",
      },
      "NIPAH",
      {
        detailMode: "direct_pdf",
        listUrl: "https://www.chinacdc.cn/jksj/jksj03/index.html",
        maxPages: 3,
        scope: "human",
        sourceType: "official_surveillance",
        titleIncludes: ["全球传染病事件风险评估"],
      },
    );

    expect(outbreak?.country).toBe("Bangladesh");
    expect(outbreak?.sourceSystem).toBe("CHINACDC");
    expect(
      outbreak?.reportDate?.toLocaleDateString("en-CA", {
        timeZone: "Asia/Shanghai",
      }),
    ).toBe("2025-05-19");
    expect(outbreak?.sourceListUrl).toBe("https://www.chinacdc.cn/jksj/jksj03/index.html");
    expect(outbreak?.navigationPath?.[0]?.label).toBe("China CDC list page");
  });
});
