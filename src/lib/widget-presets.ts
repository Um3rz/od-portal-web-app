import type { RangeFilter } from "@/lib/api";

// Per-widget quick date-range shortcuts (product reference: a POS-style
// dashboard where every widget card carries its own Y/1D/7D/30D/MTD/YTD row,
// independent of the dashboard's own global date filter).
export const WIDGET_PRESETS = ["Y", "1D", "7D", "30D", "MTD", "YTD"] as const;
export type WidgetPreset = (typeof WIDGET_PRESETS)[number];

const DAYS: Partial<Record<WidgetPreset, number>> = { "1D": 1, "7D": 7, "30D": 30 };

export function dateForWidgetPreset(preset: WidgetPreset): RangeFilter {
  const to = new Date();
  const from = new Date(to);
  if (preset === "Y") from.setFullYear(to.getFullYear() - 1);
  else if (preset === "MTD") from.setDate(1);
  else if (preset === "YTD") from.setMonth(0, 1);
  else from.setDate(to.getDate() - (DAYS[preset] ?? 0));
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { fromDate: format(from), toDate: format(to) };
}
