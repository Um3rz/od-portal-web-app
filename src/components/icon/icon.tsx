// Ported from odoo_dashboards_saas/static/src/components/icon/icon.js — same
// alias map, same fallback behavior, so the two clients never disagree on
// what an icon name resolves to.
import { ICONS } from "./icons";

// FA class name (without the "fa-" prefix) -> icon-set name, for names that
// don't already match 1:1. Kept flat (not per-screen) because the same FA
// name means the same thing everywhere it's used.
const ALIAS: Record<string, string> = {
  times: "close",
  pencil: "edit",
  cog: "settings",
  bars: "menu",
  "caret-down": "chevron-down",
  "ellipsis-h": "more-horizontal",
  "info-circle": "info",
  "exclamation-triangle": "alert-triangle",
  "exclamation-circle": "alert-circle",
  "plus-circle": "plus",
  compress: "fullscreen",
  expand: "fullscreen",
  copy: "duplicate",
  refresh: "refresh",
  "pie-chart": "doughnut",
  "chart-bar": "bar-vertical",
  "bar-chart": "bar-vertical",
  "line-chart": "line-chart",
  "area-chart": "area-chart",
  "user-circle": "user",
  "map-marker": "map",
  globe: "external-link",
  database: "dataset",
  calendar: "type-date",
  "calendar-o": "type-date",
  "calendar-check-o": "type-date",
  "clock-o": "clock",
  money: "type-monetary",
  "credit-card": "type-monetary",
  font: "type-char",
  sliders: "settings",
  th: "table",
  "th-large": "table",
  "th-list": "table",
  square: "check",
};

const FALLBACK = "help"; // last resort: an honest "unknown", never a blank box

export function resolveIcon(name: string): string {
  const key = ALIAS[name] || name;
  if (ICONS[key]) {
    return key;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[dsaas] no icon for "${name}", falling back to "${FALLBACK}"`);
  }
  return FALLBACK;
}

const VIZ_ICON: Record<string, string> = {
  tile: "tile",
  sticky_note: "sticky-note",
  horizontal_bar_chart: "bar-horizontal",
  vertical_bar_chart: "bar-vertical",
  line: "line-chart",
  area_chart: "area-chart",
  doughnut: "doughnut",
  funnel: "funnel",
  heatmap: "heatmap",
  map: "map",
  table: "table",
  pivot: "pivot-table",
  matrix: "matrix-report",
  customer_ageing_report: "ageing",
};
// Unknown/future analytical_type -> generic tile, never a blank icon slot.
export const vizIcon = (analyticalType: string) => VIZ_ICON[analyticalType] || "tile";

const FIELD_ICON: Record<string, string> = {
  char: "type-char",
  text: "type-char",
  html: "type-char",
  integer: "type-integer",
  float: "type-integer",
  monetary: "type-monetary",
  boolean: "type-boolean",
  date: "type-date",
  datetime: "type-datetime",
  selection: "type-selection",
  many2one: "relation-one",
  reference: "relation-one",
  one2many: "relation-many",
  many2many: "relation-many",
};
// field.type.saas seeds 12 types against 10 type-* icons (no Float/Text), and
// the dataset builder's field browser surfaces raw Odoo types that were never
// among the 12 (binary, json, properties, ...) -- this fallback is load-bearing.
export const fieldIcon = (fieldType: string) =>
  FIELD_ICON[String(fieldType || "").toLowerCase()] || "type-char";

export interface IconProps {
  name: string;
  size?: number | string;
  className?: string;
}

/**
 * Renders one icon from the self-hosted set, replacing Font Awesome.
 *
 *   <Icon name="filter" />
 *   <Icon name="filter" size={20} />
 *
 * `name` may be a set name, a bare `fa-*` name (aliased or passed through),
 * or anything unresolvable -- resolveIcon() always returns a real icon key.
 */
export function Icon({ name, size, className = "" }: IconProps) {
  const resolvedName = resolveIcon(name);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={size ? { fontSize: size, width: "1em", height: "1em" } : { width: "1em", height: "1em" }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[resolvedName] }}
    />
  );
}
