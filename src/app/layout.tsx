import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { SITE_URL } from "@/lib/site";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "The ultimate marketplace for modest gowns.",
    template: "%s | Jgowns",
  },
  description:
    "Buy and sell pre-loved modest wedding gowns. Browse bridal, women's, mother-of-the-bride, girls', and maternity gowns from trusted sellers.",
  openGraph: {
    siteName: "Jgowns",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang='en' className={`${fraunces.variable} ${manrope.variable}`}>
      <body className='font-body min-h-screen antialiased'>{children}</body>
    </html>
  );
}
