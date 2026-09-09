import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { NavRail } from "@/components/layout/nav-rail";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.odooOrigin || !session.apiKey) {
    redirect("/");
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
