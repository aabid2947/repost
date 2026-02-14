"use client";

import { useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, GitFork, ExternalLink } from "lucide-react";
import { GenerateButton } from "./generate-button";
import { addGlint, addHoverScale } from "@/lib/gsap/animations";

interface RepoCardProps {
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  homepage: string | null;
  isLinkedInConnected: boolean;
}

const languageColors: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-500",
  Rust: "bg-orange-600",
  Go: "bg-cyan-500",
  Java: "bg-red-500",
  "C++": "bg-pink-500",
  C: "bg-gray-500",
  Ruby: "bg-red-600",
  PHP: "bg-purple-500",
  Swift: "bg-orange-500",
  Kotlin: "bg-violet-500",
};

export function RepoCard({
  name,
  owner,
  description,
  language,
  stars,
  forks,
  url,
  homepage,
  isLinkedInConnected,
}: RepoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Add GSAP micro-interactions
  useEffect(() => {
    if (!cardRef.current) return;
    const cleanupGlint = addGlint(cardRef.current);
    const cleanupScale = addHoverScale(cardRef.current, 1.02);
    return () => {
      cleanupGlint();
      cleanupScale();
    };
  }, []);

  return (
    <Card ref={cardRef} className="repo-card flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold leading-tight">
            {name}
          </CardTitle>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {description || "No description"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex items-center gap-3 pb-3">
        {language && (
          <Badge variant="secondary" className="gap-1 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                languageColors[language] || "bg-gray-400"
              }`}
            />
            {language}
          </Badge>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3" />
          {stars}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <GitFork className="h-3 w-3" />
          {forks}
        </span>
      </CardContent>

      <CardFooter className="mt-auto pt-3">
        {isLinkedInConnected ? (
          <GenerateButton
            repoOwner={owner}
            repoName={name}
            repoUrl={url}
            description={description}
            homepage={homepage}
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            Connect LinkedIn to generate posts
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
