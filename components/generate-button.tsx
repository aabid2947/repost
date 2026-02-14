"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap/register";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { usePostStore } from "@/lib/store/post-store";
import { generatePost } from "@/lib/actions/generate-post";
import { captureScreenshotsBatch } from "@/lib/actions/capture-screenshots-batch";
import { toast } from "sonner";

interface GenerateButtonProps {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  description: string | null;
  homepage: string | null;
}

export function GenerateButton({
  repoOwner,
  repoName,
  repoUrl,
  description,
  homepage,
}: GenerateButtonProps) {
  const loaderRef = useRef<SVGSVGElement>(null);
  const {
    isGenerating,
    setIsGenerating,
    setDraftPost,
    setSelectedRepo,
    setScreenshots,
    setPostType,
    openModal,
  } = usePostStore();

  // Terminal-style pulsing animation for loader
  useEffect(() => {
    if (!isGenerating || !loaderRef.current) return;
    
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(loaderRef.current, {
      opacity: 0.3,
      duration: 0.6,
      ease: "power2.inOut",
    }).to(loaderRef.current, {
      opacity: 1,
      duration: 0.6,
      ease: "power2.inOut",
    });

    return () => {
      tl.kill();
    };
  }, [isGenerating]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSelectedRepo({
      name: repoName,
      owner: repoOwner,
      url: repoUrl,
      description,
      homepage,
    });

    try {
      console.log("[GenerateButton] Generating post for", repoOwner, "/", repoName);

      // Generate post content and detect public pages
      const postResult = await generatePost(repoOwner, repoName);
      console.log("[GenerateButton] Post generated, public pages:", postResult.publicPages.length);

      setDraftPost(postResult.draft);

      // Capture screenshots for detected pages
      if (postResult.publicPages.length > 0) {
        console.log("[GenerateButton] Capturing screenshots for pages...");
        const screenshots = await captureScreenshotsBatch(postResult.publicPages);
        console.log("[GenerateButton] Screenshots captured:", screenshots.length);
        
        const validScreenshots = screenshots.filter((s) => s.screenshotUrl);
        console.log("[GenerateButton] Valid screenshots:", validScreenshots.length);
        
        setScreenshots(screenshots);
        
        // Auto-set to image mode if we have valid screenshots
        if (validScreenshots.length > 0) {
          console.log("[GenerateButton] Auto-setting postType to 'image'");
          setPostType("image");
        } else {
          console.log("[GenerateButton] No valid screenshots, using text mode");
          setPostType("text");
        }
      } else {
        console.log("[GenerateButton] No public pages detected, skipping screenshots");
        setScreenshots([]);
        setPostType("text");
      }

      openModal();
    } catch (error) {
      console.error("[GenerateButton] Error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate post"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGenerating}
      size="sm"
      className="gap-2"
    >
      {isGenerating ? (
        <Loader2 ref={loaderRef} className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      Generate Post
    </Button>
  );
}
