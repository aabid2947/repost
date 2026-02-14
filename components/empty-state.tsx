"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { popIn } from "@/lib/gsap/animations";
import { Github, Sparkles } from "lucide-react";

export function EmptyState() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const elements = containerRef.current.querySelectorAll(".empty-item");
      elements.forEach((el, i) => {
        popIn(el, { delay: i * 0.1, scale: 0.9 });
      });
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="empty-item mb-4 rounded-full bg-muted p-6 opacity-0">
        <Github className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="empty-item mb-2 text-xl font-semibold opacity-0">
        No repositories found
      </h3>
      <p className="empty-item max-w-md text-sm text-muted-foreground opacity-0">
        Connect your GitHub account to import repositories and start generating
        LinkedIn posts with AI-powered content and screenshots.
      </p>
      <div className="empty-item mt-6 flex items-center gap-2 text-xs text-muted-foreground opacity-0">
        <Sparkles className="h-4 w-4" />
        <span>AI-powered, screenshot-ready, one-click publishing</span>
      </div>
    </div>
  );
}
