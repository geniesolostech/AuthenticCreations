import type { Metadata } from "next";
import { fraunces, nunitoSans, caveat } from "@/app/fonts";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Authentic Creations",
  description:
    "Handmade crochet hats & accessories by CJ Lavender. Find you in whatever you do.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${nunitoSans.variable} ${caveat.variable}`}
    >
      <body className="flex min-h-screen flex-col bg-cream text-charcoal font-body">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
