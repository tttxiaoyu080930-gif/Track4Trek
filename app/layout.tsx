import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://siuyuk.xyz"),
  title: "Track4Trek | Open route-demand analysis",
  description:
    "An open geospatial engineering project that translates trekking routes, target time, pack load, elevation, and weather into explainable demand profiles.",
  openGraph: {
    title: "Track4Trek",
    description: "Know what the trail asks of you.",
    url: "https://siuyuk.xyz",
    siteName: "Track4Trek",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Track4Trek route climbing toward a summit" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Track4Trek",
    description: "Know what the trail asks of you.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
