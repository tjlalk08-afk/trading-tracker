import type { Metadata } from "next";
import { JetBrains_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

const uiSans = Public_Sans({
  variable: "--font-ui-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const uiMono = JetBrains_Mono({
  variable: "--font-ui-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Trading Tracker",
  description: "Track trading performance, dashboards, and investor activity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${uiSans.variable} ${uiMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
