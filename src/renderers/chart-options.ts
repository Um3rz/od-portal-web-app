export interface ChartRow { x?: unknown; y?: unknown; [key: string]: unknown }

const palette = ["hsl(217 91% 60%)", "hsl(173 58% 39%)", "hsl(224 64% 33%)", "hsl(43 74% 66%)", "hsl(27 87% 67%)"];

export function chartNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.trim().replace(/,/g, "").replace(/[$€£%]/g, "").replace(/^\((.*)\)$/, "-$1"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function chartLabel(value: unknown): string {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.en_US ?? record.ar_001 ?? "");
  }
  return value == null ? "" : String(value);
}

function optionalLabel(value: unknown): string {
  return value === false || value == null ? "" : String(value);
}

export function buildBarLineAreaOption(type: string, rows: ChartRow[], config: Record<string, unknown>) {
  const horizontal = type === "horizontal_bar_chart";
  const line = type === "line" || type === "area_chart";
  const labels = rows.map((row) => chartLabel(row.x));
  const values = rows.map((row) => chartNumber(row.y));
  const measures = Array.isArray(config.measures) ? config.measures.filter((m): m is Record<string, unknown> => !!m && typeof m === "object") : [];
  const series = measures.length > 1 && !config.stacking_group_by
    ? measures.map((measure, index) => ({
        name: String(measure.label ?? measure.key ?? `Series ${index + 1}`),
        type: measure.chart_type === "bar" ? "bar" : "line",
        data: rows.map((row) => chartNumber(row[String(measure.key ?? "y")])),
        itemStyle: { color: String(measure.color ?? palette[index % palette.length]) },
        smooth: type === "area_chart",
        areaStyle: type === "area_chart" ? { opacity: 0.22 } : undefined,
      }))
    : [{
        name: String(config.y_axis_label ?? config.y_axis_field_name ?? "Value"),
        type: line ? "line" : "bar",
        data: values,
        smooth: type === "area_chart" || type === "line",
        barMaxWidth: 44,
        itemStyle: { color: palette[0], borderRadius: type === "vertical_bar_chart" ? [4, 4, 0, 0] : 4 },
        areaStyle: type === "area_chart" ? { opacity: 0.22, color: "hsl(244 100% 90%)" } : undefined,
        showSymbol: line,
      }];
  return {
    animation: false,
    color: palette,
    grid: { left: horizontal ? 132 : 48, right: 24, top: 24, bottom: horizontal ? 30 : 56, containLabel: true },
    tooltip: { trigger: "axis" },
    legend: series.length > 1 ? { bottom: 4, type: "scroll" } : undefined,
    xAxis: horizontal ? { type: "value", name: optionalLabel(config.x_axis_label), splitNumber: 4, axisLabel: { hideOverlap: true } } : { type: "category", data: labels, axisLabel: { rotate: Number(config.angle_labels_x_axis ?? 0), interval: config.show_all_labels_x_axis ? 0 : "auto", hideOverlap: true }, name: optionalLabel(config.x_axis_label) },
    yAxis: horizontal ? { type: "category", data: labels, axisLabel: { width: 124, overflow: "truncate", hideOverlap: true }, name: optionalLabel(config.y_axis_label) } : { type: "value", name: optionalLabel(config.y_axis_label) },
    series: horizontal ? series.map((entry) => ({ ...entry, barMaxWidth: 22 })) : series,
  };
}

export function buildDoughnutFunnelOption(type: string, rows: ChartRow[]) {
  const data = rows.map((row) => ({ name: chartLabel(row.x), value: chartNumber(row.y) }));
  return {
    animation: false,
    color: palette,
    tooltip: { trigger: "item" },
    legend: { bottom: 4, type: "scroll" },
    series: [{
      type: type === "funnel" ? "funnel" : "pie",
      data,
      ...(type === "doughnut" ? { radius: ["44%", "70%"], label: { formatter: "{b}: {c}" } } : { minSize: "20%", maxSize: "85%", gap: 2, label: { formatter: "{b}: {c}" } }),
    }],
  };
}
