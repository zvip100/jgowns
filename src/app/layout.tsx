import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
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
  metadataBase: (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://jgowns.com");
    } catch {
      return new URL("https://jgowns.com");
    }
  })(),
  title: {
    default: "Jgowns — The ultimate marketplace for modest gowns.",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className={`${fraunces.variable} ${manrope.variable}`}>
      <body className='font-body min-h-screen antialiased'>{children}</body>
    </html>
  );
}
