import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
