import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RepoList } from "@/components/repo-list";
import { ConnectLinkedIn } from "@/components/connect-linkedin";
import { ConnectGitHub } from "@/components/connect-github";
import { Octokit } from "octokit";

interface GitHubRepo {
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  homepage: string | null;
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // --- Fetch or create user record ---
  let user = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  if (user.length === 0) {
    await db.insert(users).values({
      clerkUserId: userId,
      updatedAt: new Date(),
    });
    user = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, userId))
      .limit(1);
  }

  const userRecord = user[0];
  const githubToken = userRecord?.githubAccessToken;
  const linkedInToken = userRecord?.linkedinAccessToken;
  const githubUsername = userRecord?.githubUsername;

  // --- Fetch GitHub repos ---
  let repos: {
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    url: string;
    homepage: string | null;
  }[] = [];

  try {
    if (githubToken) {
      // Use user's OAuth token
      const octokit = new Octokit({ auth: githubToken });
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 30,
        visibility: "all",
      });

      repos = (data as GitHubRepo[]).map((repo) => ({
        name: repo.name,
        owner: repo.owner.login,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        url: repo.html_url,
        homepage: repo.homepage,
      }));
    } else if (githubUsername && process.env.GITHUB_TOKEN) {
      // Fallback: use PAT to fetch public repos
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const { data } = await octokit.rest.repos.listForUser({
        username: githubUsername,
        sort: "updated",
        per_page: 30,
        type: "owner",
      });

      repos = (data as GitHubRepo[]).map((repo) => ({
        name: repo.name,
        owner: repo.owner.login,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        url: repo.html_url,
        homepage: repo.homepage,
      }));
    }
  } catch (error) {
    console.error("Failed to fetch GitHub repos:", error);
  }

  const isGitHubConnected = !!githubToken;
  const isLinkedInConnected = !!linkedInToken;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Select a repository to generate a LinkedIn post.
        </p>
      </div>

      {!isGitHubConnected && <ConnectGitHub />}
      {!isLinkedInConnected && <ConnectLinkedIn />}

      <RepoList repos={repos} isLinkedInConnected={isLinkedInConnected} />
    </div>
  );
}
