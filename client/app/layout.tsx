import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediScribe AI",
  description: "AI medical scribe MVP for SOAP note generation.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
