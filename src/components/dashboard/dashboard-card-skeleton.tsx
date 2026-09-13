import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Not part of the addon's reference (that one only covers in-dashboard
// widget cards) -- this extends the same skel-bar sweep to the dashboards
// list grid, which has no equivalent in the Odoo backend UI.
export function DashboardCardSkeleton() {
  return (
    <Card className="flex h-full flex-col gap-3 p-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-start justify-between">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-4.5 w-4.5 rounded-full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-[70%]" />
        <Skeleton className="h-2.5 w-[35%]" />
      </div>
      <Skeleton className="mt-auto h-5 w-16 rounded-sm" />
    </Card>
  );
}
