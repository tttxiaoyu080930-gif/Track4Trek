import type { Metadata } from "next";
import Script from "next/script";
import { LanguageProvider } from "./_components/language-system";
import { PersistentSiteHeader } from "./_components/site-header";
import { SiteScenery } from "./_components/theme-system";
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
    <html
      lang="en"
      data-track4trek-language="en"
      data-track4trek-theme="dark"
      data-track4trek-scene="landing"
      suppressHydrationWarning
    >
      <body>
        <Script id="track4trek-theme" strategy="beforeInteractive">
          {`try{document.documentElement.dataset.track4trekTheme=localStorage.getItem("track4trek:theme")==="light"?"light":"dark"}catch{}`}
        </Script>
        <Script id="track4trek-language" strategy="beforeInteractive">
          {`try{const language=localStorage.getItem("track4trek:language")==="zh"?"zh":"en";document.documentElement.dataset.track4trekLanguage=language;document.documentElement.lang=language==="zh"?"zh-CN":"en"}catch{}`}
        </Script>
        <LanguageProvider>
          <SiteScenery />
          <PersistentSiteHeader />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
