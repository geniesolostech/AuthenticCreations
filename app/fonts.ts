import { Fraunces, Nunito_Sans, Caveat } from "next/font/google";

// Raw next/font variable names are kept distinct from the Tailwind theme
// tokens (--font-heading/--font-body/--font-script, aliased in
// app/globals.css via `@theme inline`). Reusing the theme token name here
// would make Tailwind emit a self-referential `:root` declaration that
// fights the one next/font sets on <html>, depending on stylesheet order.
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
  display: "swap",
});

export const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});
