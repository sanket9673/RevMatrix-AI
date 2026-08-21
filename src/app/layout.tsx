import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "./layout-shell";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RevMatrix.ai | Executive AI Revenue Recovery Engine",
  description: "Autonomous enterprise revenue protection and intelligent cashflow assurance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans bg-zinc-950 text-zinc-100 antialiased min-h-screen selection:bg-emerald-500/20 selection:text-emerald-400`}
      >
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
