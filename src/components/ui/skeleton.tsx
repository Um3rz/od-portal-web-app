import { cn } from "@/lib/utils";

// One shared sweep animation (.skel-bar in globals.css), ported from
// odoo_dashboards_saas's skeleton-card.css -- see WidgetSkeleton for the
// per-visualization-type shapes built out of this primitive.
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <span className={cn("skel-bar", className)} style={style} />;
}
