import { redirect } from "next/navigation";
import { getSession, getActiveAccount } from "@/lib/session";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function Home() {
  const session = await getSession();
  if (getActiveAccount(session)) {
    redirect("/dashboards");
  }
  return <OnboardingForm />;
}
