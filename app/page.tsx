import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Script from "next/script";
import { HeroSection, FeatureCards, SocialProofMarquee } from "@/components/landing-sections";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://evalzz.com";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Evalzz",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description:
    "Turn your GitHub repositories into viral LinkedIn posts with AI-powered content, live screenshots, and one-click publishing.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "Evalzz",
    url: siteUrl,
  },
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* JSON-LD Structured Data */}
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        strategy="afterInteractive"
      />

      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-xl font-bold tracking-tight">
            Eval<span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">zz</span>
          </span>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="default" size="sm">
                Sign In
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="default" size="sm">
                Dashboard
              </Button>
            </Link>
          </SignedIn>
        </div>
      </header>

      {/* Hero + Features + Social Proof */}
      <main className="flex flex-1 flex-col items-center pt-24 pb-12">
        <HeroSection />
        <FeatureCards />
        <SocialProofMarquee />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Evalzz · Built with Next.js, Gemini &amp; Shadcn/UI
      </footer>
    </div>
  );
}
