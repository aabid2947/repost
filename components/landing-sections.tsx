"use client";

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap/register";
import { makeMagnetic, splitTextEntrance } from "@/lib/gsap/animations";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Github, Sparkles, Send, ArrowRight } from "lucide-react";
import Link from "next/link";

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const btnPrimaryRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      if (!headlineRef.current) return;

      // Split-text entrance for headline
      splitTextEntrance(headlineRef.current, {
        stagger: 0.035,
        duration: 0.8,
        y: 50,
      });

      // Fade-in subtitle
      gsap.fromTo(
        subRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: "power3.out" }
      );

      // Pop-in CTA buttons
      gsap.fromTo(
        ctaRef.current,
        { opacity: 0, y: 20, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          delay: 0.7,
          ease: "back.out(1.7)",
        }
      );
    },
    { scope: heroRef }
  );

  // Magnetic effect on primary button
  useEffect(() => {
    if (!btnPrimaryRef.current) return;
    return makeMagnetic(btnPrimaryRef.current, 0.25);
  }, []);

  return (
    <div ref={heroRef} className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1
        ref={headlineRef}
        className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
      >
        Turn your GitHub repos into viral LinkedIn posts
      </h1>
      <p
        ref={subRef}
        className="mt-6 max-w-xl text-lg text-muted-foreground opacity-0"
      >
        Connect your GitHub, pick a repo, and let AI craft the perfect
        LinkedIn post — complete with live screenshots of your project.
      </p>
      <div ref={ctaRef} className="mt-8 flex gap-4 opacity-0">
        <SignedOut>
          <SignInButton mode="modal">
            <Button ref={btnPrimaryRef} size="lg" className="gap-2 group">
              <Github className="h-5 w-5" />
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard">
            <Button ref={btnPrimaryRef} size="lg" className="gap-2 group">
              Go to Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </SignedIn>
      </div>
    </div>
  );
}

export function FeatureCards() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = sectionRef.current?.querySelectorAll(".feature-card");
      if (!cards) return;

      gsap.fromTo(
        cards,
        { opacity: 0, y: 50, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    },
    { scope: sectionRef }
  );

  const features = [
    {
      icon: Github,
      title: "Connect GitHub",
      desc: "Sign in and instantly access all your repositories — public and private.",
    },
    {
      icon: Sparkles,
      title: "AI-Powered Content",
      desc: "AI analyzes your code and generates engaging, human-sounding posts that resonate.",
    },
    {
      icon: Send,
      title: "One-Click Publish",
      desc: "Post directly to LinkedIn with up to 5 project screenshots as a carousel.",
    },
  ];

  return (
    <div ref={sectionRef} className="mx-auto mt-24 grid max-w-4xl gap-6 sm:grid-cols-3 px-4">
      {features.map((f) => (
        <div
          key={f.title}
          className="feature-card group relative rounded-xl border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-accent/50"
        >
          <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3">
            <f.icon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}

export function SocialProofMarquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!trackRef.current) return;
      const track = trackRef.current;
      const totalWidth = track.scrollWidth / 2;

      gsap.to(track, {
        x: -totalWidth,
        duration: 30,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x) => parseFloat(x) % totalWidth),
        },
      });
    },
    { scope: trackRef }
  );

  const posts = [
    "Just shipped a full-stack SaaS with Next.js 16... 🚀",
    "Built a real-time dashboard with WebSockets in 48 hours",
    "My open-source CLI tool just hit 1K stars ⭐",
    "From idea to deployed MVP in one weekend — here's how",
    "Why I switched from REST to tRPC (and never looked back)",
    "This AI tool writes my LinkedIn posts from my GitHub repos",
    "Just automated my developer portfolio with AI screenshots",
    "Open source contribution tip: Start with docs, not code",
  ];

  // Duplicate for seamless loop
  const allPosts = [...posts, ...posts];

  return (
    <div className="mt-28 w-full overflow-hidden border-y bg-muted/30 py-6">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Posts shipped with Evalzz
      </p>
      <div ref={trackRef} className="flex gap-6 whitespace-nowrap">
        {allPosts.map((text, i) => (
          <div
            key={i}
            className="inline-flex min-w-[320px] items-start gap-3 rounded-lg border bg-card px-5 py-4 shadow-sm"
          >
            <div className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-violet-500" />
            <p className="text-sm text-foreground whitespace-normal line-clamp-2 max-w-[260px]">
              {text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
