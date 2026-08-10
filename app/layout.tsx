import type { Metadata } from "next";
import { fraunces, nunitoSans, caveat } from "@/app/fonts";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import CartTrigger from "@/components/cart-trigger";
import MiniCart from "@/components/mini-cart";
import Rum from "@/components/rum";
import { CartProvider } from "@/lib/cart-context";
import "./globals.css";

export const metadata: Metadata = {
  // Resolves relative URLs in metadata (e.g. the opengraph-image route) to
  // absolute ones; falls back to localhost so this never throws in dev/test
  // when the env var isn't set.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Authentic Creations",
    template: "%s · Authentic Creations",
  },
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
        <CartProvider>
          <SiteHeader>
            <CartTrigger />
          </SiteHeader>
          <main className="flex-1">{children}</main>
          <SiteFooter />
          {/* Mounted once, for every page: it opens on the `cart:open` event
              that Add-to-Cart and the header trigger fire. */}
          <MiniCart />
        </CartProvider>
        {/* Renders nothing and does nothing until the NEXT_PUBLIC_RUM_* vars
            exist, which is why it is safe to mount here unconditionally. */}
        <Rum />
      </body>
    </html>
  );
}
