import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://evalzz.com";

export const metadata: Metadata = {
  title: {
    default: "Evalzz — AI GitHub Review to LinkedIn Posts",
    template: "%s | Evalzz",
  },
  description:
    "Turn your GitHub repositories into viral LinkedIn posts with AI. Evalzz automates developer personal branding with one-click LinkedIn publishing, live project screenshots, and AI-powered content generation.",
  keywords: [
    "AI GitHub Review",
    "LinkedIn Automation",
    "Developer Personal Branding",
    "GitHub to LinkedIn",
    "AI content generator",
    "developer marketing",
    "tech LinkedIn posts",
    "open source promotion",
  ],
  authors: [{ name: "Evalzz" }],
  creator: "Evalzz",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Evalzz",
    title: "Evalzz — AI GitHub Review to LinkedIn Posts",
    description:
      "Turn your GitHub repos into viral LinkedIn posts with AI-powered content, live screenshots, and one-click publishing.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Evalzz – GitHub to LinkedIn in One Click",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Evalzz — AI GitHub Review to LinkedIn Posts",
    description:
      "Turn your GitHub repos into viral LinkedIn posts. AI-powered content, live screenshots, one-click publishing.",
    images: [`${siteUrl}/og-image.png`],
    creator: "@evalzz",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
