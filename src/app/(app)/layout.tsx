import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Topbar } from "@/components/layout/topbar";
import { SessionProvider } from "@/components/session-provider";
import { ViewModeProvider } from "@/components/view-mode-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.odooOrigin || !session.apiKey) {
    redirect("/");
  }

  return (
    <SessionProvider isExternalGrant={!!session.isExternalGrant}>
      <ViewModeProvider>
        <div className="flex h-dvh w-full flex-col overflow-hidden">
          <Topbar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </ViewModeProvider>
    </SessionProvider>
  );
}
