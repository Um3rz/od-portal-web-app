import type { Metadata } from "next";
import { Schibsted_Grotesk, Instrument_Sans } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

// Same two families, same variable-name pattern as the odoo-dashboards
// marketing site (app/layout.tsx) and the Odoo addon's redesign tokens
// (_tokens.css --font-heading / --font-body).
const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-schibsted-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Odoo Dashboards",
  description: "View your Odoo dashboards from anywhere.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${schibstedGrotesk.variable} ${instrumentSans.variable} o_dsaas h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
