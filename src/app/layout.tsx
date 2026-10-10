import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearPath — Discharge AI",
  description:
    "ClearPath turns complex hospital discharge instructions into clear, actionable recovery plans. Rutgers Health Hackathon 2026. Synthetic data only.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Fonts match the Blueprint prototypes exactly: Atkinson Hyperlegible (body,
            chosen for low-vision legibility), Fraunces (display), Noto Sans SC (Mandarin),
            IBM Plex Sans Arabic (Arabic). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Fraunces:opsz,wght@9..144,500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;600&family=Noto+Sans+SC:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
