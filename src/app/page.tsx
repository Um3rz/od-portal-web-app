import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function Home() {
  const session = await getSession();
  if (session.odooOrigin && session.apiKey) {
    redirect("/dashboards");
  }
  return <OnboardingForm />;
}
