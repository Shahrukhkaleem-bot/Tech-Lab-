import { Inter, Lato, Montserrat, Nunito, Poppins } from "next/font/google"

/**
 * Allow-listed tenant fonts (see src/config/fonts.ts). Each exposes a CSS variable;
 * the tenant theme points --font-sans at one of them. `preload: false` because only
 * one font is used per store — the browser downloads just the one actually applied.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false })
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
  preload: false,
})
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap", preload: false })
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false })
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", display: "swap", preload: false })

export const fontVariables = [inter, poppins, nunito, montserrat, lato].map((f) => f.variable).join(" ")
