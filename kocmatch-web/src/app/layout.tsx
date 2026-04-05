import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turt",
  description: "Slow and steady matching with Turt.",
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
