import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://strava-ai-export.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Strava AI Export",
    template: "%s | Strava AI Export",
  },
  description: "Export Strava activity data into CSV files prepared for ChatGPT, Claude, and Gemini.",
  applicationName: "Strava AI Export",
  manifest: "/manifest.json",
  openGraph: {
    title: "Strava AI Export",
    description: "Turn Strava activities into AI-ready CSV exports.",
    url: siteUrl,
    siteName: "Strava AI Export",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Strava AI Export preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Strava AI Export",
    description: "Turn Strava activities into AI-ready CSV exports.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#fc4c02",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
