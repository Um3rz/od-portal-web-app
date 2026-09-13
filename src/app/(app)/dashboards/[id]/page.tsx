"use client";

import { use } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DashboardView dashboardId={Number(id)} />;
}
