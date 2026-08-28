import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://siuyuk.xyz"),
  title: "Track4Trek | Route readiness, explained",
  description:
    "Upload a trekking route and preview the terrain, effort and environmental demands behind your planned attempt.",
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
      <body>{children}</body>
    </html>
  );
}
