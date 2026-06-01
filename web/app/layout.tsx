import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { Providers } from "@/providers/providers";

export const metadata: Metadata = {
  title: "AdPilot — AI Media Buyer",
  description: "AI-powered media buying command center for KSA",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
