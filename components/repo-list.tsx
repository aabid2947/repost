"use client";

import { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { staggerIn } from "@/lib/gsap/animations";
import { RepoCard } from "./repo-card";
import { PostPreviewModal } from "./post-preview-modal";

interface Repo {
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  homepage: string | null;
}

interface RepoListProps {
  repos: Repo[];
  isLinkedInConnected: boolean;
}

export function RepoList({ repos, isLinkedInConnected }: RepoListProps) {
  const [search, setSearch] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      (repo.description || "").toLowerCase().includes(search.toLowerCase())
  );

  // GSAP stagger animation for repo cards
  useGSAP(
    () => {
      const cards = gridRef.current?.querySelectorAll(".repo-card");
      if (!cards || cards.length === 0) return;
      staggerIn(cards, { stagger: 0.08, duration: 0.5, y: 30 });
    },
    { scope: gridRef, dependencies: [filtered] }
  );

  return (
    <>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {/* Repo Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">
          {search ? "No repositories match your search." : "No repositories found."}
        </p>
      ) : (
        <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((repo) => (
            <RepoCard
              key={`${repo.owner}/${repo.name}`}
              {...repo}
              isLinkedInConnected={isLinkedInConnected}
            />
          ))}
        </div>
      )}

      {/* Post Preview Modal (global, driven by Zustand) */}
      <PostPreviewModal />
    </>
  );
}
