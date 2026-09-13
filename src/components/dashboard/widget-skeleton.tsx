// Ported from odoo_dashboards_saas/static/src/components/skeleton_card/
// {skeleton_card.js,skeleton_card.xml} -- shapes mirror the real
// visualization so the grid reads correctly before data arrives, per the
// backend's own design (get_dashboard_metadata returns "ids + types only, no
// data queries... paint the whole grid as skeletons from one round-trip").
import { Skeleton } from "@/components/ui/skeleton";

export type SkeletonVariant = "tile" | "chart" | "table" | "heatmap" | "map" | "note";

// dashboards.py:ANALYTIC_TYPE_BUCKETS -> skeleton variant. `table`/`pivot`/
// `matrix` all share the table skeleton, same as the addon's own CSS comment
// ("/* table / pivot */") and this app's DashboardRenderer (which renders
// matrix through the same <Table> component as table).
const BUCKET_VARIANT: Record<string, SkeletonVariant> = {
  tiles: "tile",
  sticky_notes: "note",
  heatmaps: "heatmap",
  maps: "map",
  tables: "table",
  pivots: "table",
  matrices: "table",
  vertical_bar_charts: "chart",
};

export function bucketToVariant(bucket: string | null | undefined): SkeletonVariant {
  return (bucket && BUCKET_VARIANT[bucket]) || "tile";
}

// h_index-keyed bar heights (%) straight from skeleton_card.js's `bars` getter.
const CHART_BARS = [62, 88, 45, 74, 96, 55, 80];
const TABLE_ROWS = [1, 2, 3, 4, 5, 6];
const HEATMAP_CELLS = Array.from({ length: 36 }, (_, i) => i);

function TileBody() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3.5">
      <Skeleton className="h-[30px] w-[70%]" />
      <Skeleton className="h-2.5 w-[40%]" />
    </div>
  );
}

function ChartBody() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-2.5">
      <div className="flex min-h-10 flex-1 items-end gap-2.5">
        {CHART_BARS.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
      <span className="block h-0.5 rounded-full bg-muted" />
    </div>
  );
}

function TableBody() {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-3 flex-1 bg-[hsl(220_13%_88%)]" />
        ))}
      </div>
      {TABLE_ROWS.map((r) => (
        <div key={r} className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-2.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function HeatmapBody() {
  return (
    <div className="grid flex-1 grid-cols-9 auto-rows-fr gap-1.5">
      {HEATMAP_CELLS.map((i) => (
        <Skeleton
          key={i}
          className={
            (i + 1) % 3 === 0
              ? "rounded-[3px] bg-[hsl(216_10%_88%)]"
              : (i + 1) % 4 === 0
                ? "rounded-[3px] bg-[hsl(210_14%_94%)]"
                : "rounded-[3px]"
          }
        />
      ))}
    </div>
  );
}

function MapBody() {
  const pins = [
    { top: "32%", left: "28%" },
    { top: "55%", left: "61%" },
    { top: "70%", left: "40%" },
  ];
  return (
    <div className="relative flex-1">
      <Skeleton className="absolute inset-0 rounded-lg" />
      {pins.map((pin, i) => (
        <span
          key={i}
          className="absolute h-2.5 w-2.5 rounded-full bg-[hsl(220_9%_82%)]"
          style={pin}
        />
      ))}
    </div>
  );
}

function NoteBody() {
  return (
    <div className="flex flex-1 flex-col justify-start gap-3">
      <Skeleton className="h-2.5 w-[90%] bg-note-border" />
      <Skeleton className="h-2.5 w-[78%] bg-note-border" />
      <Skeleton className="h-2.5 w-[55%] bg-note-border" />
    </div>
  );
}

const BODIES: Record<SkeletonVariant, () => React.ReactNode> = {
  tile: TileBody,
  chart: ChartBody,
  table: TableBody,
  heatmap: HeatmapBody,
  map: MapBody,
  note: NoteBody,
};

export function WidgetSkeleton({
  variant,
  name,
  className = "",
}: {
  variant: SkeletonVariant;
  name?: string;
  className?: string;
}) {
  const Body = BODIES[variant];
  return (
    <div
      className={`flex h-full min-h-40 w-full flex-col gap-3.5 overflow-hidden rounded-lg bg-surface p-4 ${
        variant === "note" ? "bg-transparent" : ""
      } ${className}`}
      aria-busy="true"
      aria-label={name ? `${name} loading` : "Loading"}
    >
      {variant !== "note" && <Skeleton className="h-3 w-[45%]" />}
      <Body />
    </div>
  );
}
