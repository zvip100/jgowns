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
  title: "Jgowns — The ultimate marketplace for modest gowns.",
  description: "Buy and sell pre-loved wedding gowns",
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
