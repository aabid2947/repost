"use server";

import { auth } from "@clerk/nextjs/server";
import { Octokit } from "octokit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Files/patterns considered "important" for understanding a project
const IMPORTANT_FILE_PATTERNS = [
  /^readme\.md$/i,
  /^package\.json$/,
  /^cargo\.toml$/,
  /^pyproject\.toml$/,
  /^go\.mod$/,
  /^pom\.xml$/,
  /^build\.gradle$/,
  /^requirements\.txt$/,
  /^src\/index\.\w+$/,
  /^src\/main\.\w+$/,
  /^src\/app\.\w+$/,
  /^app\/page\.\w+$/,
  /^app\/layout\.\w+$/,
  /^main\.\w+$/,
  /^index\.\w+$/,
  /^lib\.rs$/,
  /^src\/lib\.\w+$/,
];

// Skip these entirely
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.lock$/,
  /lock\.json$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.svg$/,
  /\.ico$/,
  /\.woff/,
  /\.ttf$/,
  /\.eot$/,
  /\.mp4$/,
  /\.mp3$/,
  /\.zip$/,
  /\.tar/,
  /\.min\.js$/,
  /\.min\.css$/,
];

function isImportantFile(path: string): boolean {
  return IMPORTANT_FILE_PATTERNS.some((p) => p.test(path));
}

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(path));
}

export async function generatePost(repoOwner: string, repoName: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // Get GitHub token from database
  const user = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  let githubToken = user[0]?.githubAccessToken;

  // Fallback to PAT if no user token
  if (!githubToken && process.env.GITHUB_TOKEN) {
    githubToken = process.env.GITHUB_TOKEN;
  }

  if (!githubToken) {
    throw new Error("GitHub not connected. Please connect your GitHub account.");
  }

  const octokit = new Octokit({ auth: githubToken });

  // Fetch repo metadata
  const { data: repo } = await octokit.rest.repos.get({
    owner: repoOwner,
    repo: repoName,
  });

  // Fetch file tree
  const { data: tree } = await octokit.rest.git.getTree({
    owner: repoOwner,
    repo: repoName,
    tree_sha: repo.default_branch,
    recursive: "1",
  });

  // Filter to important files only
  const allFiles = (tree.tree || [])
    .filter((item) => item.type === "blob" && item.path)
    .map((item) => item.path!)
    .filter((path) => !shouldSkip(path));

  const importantFiles = allFiles.filter(isImportantFile).slice(0, 15);

  // If we have fewer than 5 important files, add some config/source files
  if (importantFiles.length < 5) {
    const extras = allFiles
      .filter(
        (f) =>
          !importantFiles.includes(f) &&
          (f.endsWith(".ts") ||
            f.endsWith(".tsx") ||
            f.endsWith(".js") ||
            f.endsWith(".py") ||
            f.endsWith(".rs") ||
            f.endsWith(".go"))
      )
      .slice(0, 10 - importantFiles.length);
    importantFiles.push(...extras);
  }

  // Fetch content of selected files
  const fileContents: { path: string; content: string }[] = [];
  for (const filePath of importantFiles) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: filePath,
      });
      if ("content" in data && data.content) {
        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
        // Limit each file to 2000 chars to keep prompt manageable
        fileContents.push({
          path: filePath,
          content: decoded.slice(0, 2000),
        });
      }
    } catch {
      // Skip files that can't be fetched
    }
  }

  // Build the file structure tree (truncated)
  const fileTree = allFiles.slice(0, 50).join("\n");

  // Construct Gemini prompt for LinkedIn post
  const systemInstruction = `You are a LinkedIn content strategist who writes viral, engaging posts that get clicks and shares.

WRITING STYLE:
- Lead with impact: Start with a problem people face or a surprising insight
- Be conversational, not technical: Speak to non-developers too
- Show value first, tech details second: Focus on WHAT it does and WHY it matters, not HOW
- Use storytelling: Make it relatable with real-world scenarios
- Keep it scannable: Short paragraphs (1-3 lines), use line breaks generously
- Emotional hooks work: curiosity, excitement, relatability, humor (if appropriate)
- End with engagement: Ask a question or invite feedback
- Character limit: Under 1300 characters

FORMATTING RULES (CRITICAL):
- PLAIN TEXT ONLY — absolutely no markdown
- No ** for bold, no * for bullets, no # for headers, no backticks, no brackets
- Just natural text with line breaks between paragraphs
- Max 3 hashtags at the very end if truly relevant

WHAT TO AVOID:
- Corporate speak: "excited to announce", "game changer", "revolutionary"  
- Overly technical jargon: Assume audience is smart but not deeply technical
- Feature lists: Turn features into benefits people care about
- Sounding like AI: Be human, authentic, specific`;

  const userPrompt = `Write a LinkedIn post about this GitHub repository:

**Repository:** ${repo.full_name}
**Description:** ${repo.description || "No description provided"}
**Language:** ${repo.language || "Not specified"}
**Stars:** ${repo.stargazers_count}
**Homepage URL:** ${repo.homepage || "None"}
**Topics:** ${(repo.topics || []).join(", ") || "None"}

**File Structure (top-level):**
${fileTree}

**Key File Contents:**
${fileContents.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}

Focus on:
1. What problem does this solve? (lead with this)
2. Who would use this and why?
3. What makes it interesting or useful?
4. Keep it accessible — less code talk, more impact talk`;

  // Call Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction,
  });

  const result = await model.generateContent(userPrompt);
  const draft = result.response.text();

  // --- Detect public pages for screenshots ---
  let publicPages: { path: string; url: string; description: string }[] = [];

  if (repo.homepage && repo.homepage.startsWith("http")) {
    console.log("[generatePost] Homepage detected:", repo.homepage);
    
    // Find routing-related files
    const routingFiles = allFiles.filter(
      (f) =>
        f.includes("/pages/") ||
        f.includes("/app/") ||
        f.includes("/routes/") ||
        f.includes("router") ||
        f.includes("route") ||
        f.match(/page\.(tsx?|jsx?|vue|svelte)$/)
    ).slice(0, 20);

    console.log("[generatePost] Found routing files:", routingFiles.length);

    if (routingFiles.length > 0) {
      // Get content of routing files
      const routingContent: string[] = [];
      for (const filePath of routingFiles.slice(0, 10)) {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path: filePath,
          });
          if ("content" in data && data.content) {
            const decoded = Buffer.from(data.content, "base64").toString("utf-8");
            routingContent.push(`--- ${filePath} ---\n${decoded.slice(0, 1000)}`);
          }
        } catch {
          // Skip
        }
      }

      if (routingContent.length > 0) {
        // Ask Gemini to identify important public pages
        const routeAnalysisPrompt = `Analyze this web application's routing structure and identify the 5 most important PUBLIC pages that should be showcased with screenshots.

Homepage URL: ${repo.homepage}

Routing Files and Structure:
${routingContent.join("\n\n")}

File Structure:
${routingFiles.join("\n")}

Return ONLY a JSON array (no markdown, no explanation) with up to 5 pages in this exact format:
[
  {"path": "/", "description": "Homepage"},
  {"path": "/about", "description": "About page"},
  {"path": "/blog", "description": "Blog listing"}
]

Rules:
- Only include pages that would exist on the live site (no admin, auth, or dynamic [id] routes)
- Prioritize: homepage, about, features, blog/docs, contact/demo
- Use paths that would work in a browser (start with /)
- Keep descriptions under 3 words
- Return 5 or fewer pages
- If you can't determine routes, return empty array: []`;

        try {
          const routeModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
          });
          
          const routeResult = await routeModel.generateContent(routeAnalysisPrompt);
          const routeText = routeResult.response.text().trim();
          console.log("[generatePost] Route analysis response:", routeText);
          
          // Parse JSON response (remove markdown code blocks if present)
          const jsonMatch = routeText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsedRoutes = JSON.parse(jsonMatch[0]);
            publicPages = parsedRoutes.map((r: any) => ({
              path: r.path,
              url: `${repo.homepage}${r.path === "/" ? "" : r.path}`,
              description: r.description,
            }));
            console.log("[generatePost] Detected public pages:", publicPages.length);
          }
        } catch (error) {
          console.error("[generatePost] Route analysis failed:", error);
        }
      }
    }

    // Fallback: if no routes detected, just use homepage
    if (publicPages.length === 0) {
      console.log("[generatePost] No routes detected, using homepage only");
      publicPages = [
        {
          path: "/",
          url: repo.homepage,
          description: "Homepage",
        },
      ];
    }
  }

  return {
    draft,
    repoUrl: repo.html_url,
    homepage: repo.homepage || null,
    publicPages,
  };
}
