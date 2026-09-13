"use client";

import { useViewMode } from "@/components/view-mode-provider";
import { DashboardGallery } from "@/components/dashboard/dashboard-gallery";
import { DashboardCarousel } from "@/components/dashboard/dashboard-carousel";

export default function DashboardsPage() {
  const { mode } = useViewMode();
  return mode === "gallery" ? <DashboardGallery /> : <DashboardCarousel />;
}
