"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ComposableMap, Geographies, Geography, Sphere } from "react-simple-maps";

import type { VisualizationSnapshot } from "@/lib/visualization";

const MAP_ASSET_URL = "/maps/world-countries-110m.json";
const DISTRIBUTION_COLORS = ["#c74f2f", "#d47457", "#0d6a4b", "#2b5670", "#a05700", "#8a3d2f"];

function getHeatColor(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return "rgba(23, 33, 38, 0.08)";
  }

  const ratio = value / maxValue;

  if (ratio >= 0.8) {
    return "#8f2f15";
  }

  if (ratio >= 0.55) {
    return "#b84a2a";
  }

  if (ratio >= 0.3) {
    return "#cf7558";
  }

  return "#ecd3c7";
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="viz-tooltip">
      {label ? <strong>{label}</strong> : null}
      <div className="viz-tooltip__list">
        {payload.map((item, index) => (
          <span key={`${item.name ?? "value"}-${index}`}>
            {item.name}: {item.value ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

function getActivePayloadHref(state: unknown) {
  if (!state || typeof state !== "object" || !("activePayload" in state)) {
    return null;
  }

  const activePayload = state.activePayload;
  if (!Array.isArray(activePayload) || activePayload.length === 0) {
    return null;
  }

  const firstPayload = activePayload[0];
  if (!firstPayload || typeof firstPayload !== "object" || !("payload" in firstPayload)) {
    return null;
  }

  const payloadValue = firstPayload.payload;
  if (!payloadValue || typeof payloadValue !== "object" || !("href" in payloadValue)) {
    return null;
  }

  return typeof payloadValue.href === "string" ? payloadValue.href : null;
}

type WorldHeatMapProps = {
  data: VisualizationSnapshot["mapData"];
};

export function WorldHeatMap({ data }: WorldHeatMapProps) {
  const router = useRouter();
  const maxIntensity = Math.max(...data.map((item) => item.intensity), 0);
  const countryMap = new Map(data.map((item) => [item.mapName, item]));
  const [defaultCountry] = data;
  const [hoveredCountry, setHoveredCountry] = useState<WorldHeatMapProps["data"][number] | null>(defaultCountry ?? null);
  const displayCountry = hoveredCountry ?? defaultCountry ?? null;

  return (
    <div className="viz-map-shell">
      <div className="viz-map-frame">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 172 }}
          className="viz-world-map"
        >
          <Sphere fill="rgba(255, 248, 243, 0.92)" stroke="rgba(199, 79, 47, 0.1)" strokeWidth={0.8} />
          <Geographies geography={MAP_ASSET_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; properties: { name: string } }> }) =>
              geographies.map((geo) => {
                const countryName = geo.properties.name as string;
                const point = countryMap.get(countryName);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => {
                      setHoveredCountry(point ?? null);
                    }}
                    onMouseLeave={() => {
                      setHoveredCountry(defaultCountry ?? null);
                    }}
                    onClick={() => {
                      if (point?.href) {
                        router.push(point.href);
                      }
                    }}
                    style={{
                      default: {
                        fill: getHeatColor(point?.intensity ?? 0, maxIntensity),
                        stroke: "rgba(255, 255, 255, 0.7)",
                        strokeWidth: 0.55,
                        outline: "none",
                        cursor: point?.href ? "pointer" : "default",
                      },
                      hover: {
                        fill: point ? "#7d2a15" : "rgba(23, 33, 38, 0.16)",
                        stroke: "rgba(255, 255, 255, 0.88)",
                        strokeWidth: 0.8,
                        outline: "none",
                        cursor: point?.href ? "pointer" : "default",
                      },
                      pressed: {
                        fill: point ? "#5e1f0f" : "rgba(23, 33, 38, 0.16)",
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <div className="viz-map-meta">
        <div>
          <strong>{displayCountry?.country ?? "地图说明"}</strong>
          <p>
            {displayCountry
              ? `事件 ${displayCountry.outbreakCount} 条，病例 ${displayCountry.caseCount} 例，死亡 ${displayCountry.deathCount} 例。`
              : "当前热力图按国家聚合疫情事件强度，颜色越深表示筛选条件下的事件越集中。"}
          </p>
        </div>
        <div className="viz-legend">
          <span>低</span>
          <div className="viz-legend__bar" />
          <span>高</span>
        </div>
      </div>
    </div>
  );
}

type TrendChartProps = {
  data: VisualizationSnapshot["trendData"];
};

export function TrendChart({ data }: TrendChartProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <div className="empty-state">
        <h3>暂无可展示的时间趋势</h3>
        <p>当前筛选条件下没有带报告日期的疫情事件，暂时无法生成趋势曲线。</p>
      </div>
    );
  }

  return (
    <div className="viz-chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={data}
          margin={{ top: 16, right: 18, left: 0, bottom: 8 }}
          onClick={(state: unknown) => {
            const href = getActivePayloadHref(state);
            if (href) {
              router.push(href);
            }
          }}
        >
          <defs>
            <linearGradient id="vizTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c74f2f" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#c74f2f" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(23, 33, 38, 0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#5a6872", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#5a6872", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="outbreakCount"
            name="事件数"
            fill="url(#vizTrendFill)"
            stroke="#c74f2f"
            strokeWidth={2.5}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type DistributionBarChartProps = {
  data: VisualizationSnapshot["pathogenDistribution"];
  height?: number;
};

export function DistributionBarChart({ data, height = 280 }: DistributionBarChartProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <div className="empty-state">
        <h3>暂无可展示的数据分布</h3>
        <p>当前筛选结果为空，稍后可放宽条件后再查看分布变化。</p>
      </div>
    );
  }

  return (
    <div className="viz-chart-shell">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          barCategoryGap={14}
        >
          <CartesianGrid stroke="rgba(23, 33, 38, 0.08)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#5a6872", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={98}
            tick={{ fill: "#172126", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="记录数" radius={[0, 12, 12, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`${entry.key}-${entry.value}`}
                fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]}
                cursor="pointer"
                onClick={() => router.push(entry.href)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type ScopeDonutChartProps = {
  data: VisualizationSnapshot["scopeDistribution"];
};

export function ScopeDonutChart({ data }: ScopeDonutChartProps) {
  const router = useRouter();

  if (!data.length) {
    return (
      <div className="empty-state">
        <h3>暂无范围分布</h3>
        <p>当前筛选结果为空，暂时无法区分人群和动物事件占比。</p>
      </div>
    );
  }

  return (
    <div className="viz-chart-shell">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={3}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry.key}-${entry.value}`}
                fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]}
                cursor="pointer"
                onClick={() => router.push(entry.href)}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="viz-donut-legend">
        {data.map((entry, index) => (
          <button
            key={`${entry.key}-${entry.value}`}
            type="button"
            className="viz-donut-legend__item"
            onClick={() => router.push(entry.href)}
          >
            <span
              className="viz-donut-legend__dot"
              style={{ backgroundColor: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length] }}
            />
            <span>{entry.label}</span>
            <strong>{entry.value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
