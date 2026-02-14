"use server";

import { auth } from "@clerk/nextjs/server";
import { Octokit } from "octokit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { geminiRateLimiter, estimateTokens } from "@/lib/utils/gemini-rate-limiter";

// Configuration constants
const MAX_FILES_TO_SELECT = 30; // Maximum files to analyze
const MAX_CHARS_PER_FILE = 5000; // Truncate files to this length
const MAX_TREE_FILES = 100; // Max files to show in tree
const CONCURRENT_DOWNLOADS = 5; // Parallel file downloads

// Skip these entirely
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /out\//,
  /target\//,
  /vendor\//,
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
  /\.map$/,
];

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(path));
}

/**
 * PHASE 1: Get complete repository tree (paths only, no content)
 * Uses GitHub Git Trees API for efficient single-call retrieval
 */
async function getCompleteRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<{ path: string; size: number }[]> {
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "1",
  });

  return (tree.tree || [])
    .filter((item) => item.type === "blob" && item.path)
    .map((item) => ({
      path: item.path!,
      size: item.size || 0,
    }))
    .filter((file) => !shouldSkip(file.path));
}

/**
 * PHASE 2: Intelligent AI-based file selection
 * Send only file paths to AI, let it pick the most important ones
 */
async function selectFilesWithAI(
  files: { path: string; size: number }[],
  repoName: string,
  repoDescription: string,
  genAI: GoogleGenerativeAI
): Promise<string[]> {
  // Group files by category for better AI understanding
  const filesByType = {
    config: files.filter((f) =>
      /package\.json|cargo\.toml|go\.mod|pom\.xml|requirements\.txt|pyproject\.toml|composer\.json|gemfile/i.test(
        f.path
      )
    ),
    docs: files.filter((f) => /readme|contributing|changelog|license/i.test(f.path)),
    entryPoints: files.filter((f) =>
      /^(src\/)?((index|main|app|server)\.\w+|lib\.rs)$/i.test(f.path)
    ),
    source: files.filter((f) =>
      /\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|rb|php)$/i.test(f.path)
    ),
  };

  const selectionPrompt = `Analyze this repository structure and select the ${MAX_FILES_TO_SELECT} most important files to understand the project.

Repository: ${repoName}
Description: ${repoDescription}

Total files: ${files.length}

FILE STRUCTURE:
${files.slice(0, 200).map((f) => `${f.path} (${f.size} bytes)`).join("\n")}

SELECTION CRITERIA:
1. Configuration files (package.json, etc.) - ALWAYS include
2. README and documentation - ALWAYS include if present
3. Entry points (index, main, app files) - High priority
4. Core source files that represent main functionality
5. Avoid: tests, examples, assets, generated files

Return ONLY a JSON array of file paths, no explanation:
["path/to/file1.ts", "path/to/file2.py", "README.md"]

Maximum ${MAX_FILES_TO_SELECT} files. Focus on quality over quantity.`;

  try {
    const result = await geminiRateLimiter.enqueue(async () => {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
      });
      return await model.generateContent(selectionPrompt);
    }, estimateTokens(selectionPrompt));

    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const selectedPaths: string[] = JSON.parse(jsonMatch[0]);
      console.log(`[AI Selection] Selected ${selectedPaths.length} files`);
      return selectedPaths.slice(0, MAX_FILES_TO_SELECT);
    }
  } catch (error) {
    console.error("[AI Selection] Failed, using fallback:", error);
  }

  // Fallback: rule-based selection
  const priority = [
    ...filesByType.docs,
    ...filesByType.config,
    ...filesByType.entryPoints,
    ...filesByType.source.slice(0, 20),
  ];

  return priority.slice(0, MAX_FILES_TO_SELECT).map((f) => f.path);
}

/**
 * PHASE 3: Download file contents in batches (with concurrency)
 */
async function downloadFilesInBatches(
  octokit: Octokit,
  owner: string,
  repo: string,
  filePaths: string[]
): Promise<{ path: string; content: string }[]> {
  const results: { path: string; content: string }[] = [];

  // Process files in concurrent batches
  for (let i = 0; i < filePaths.length; i += CONCURRENT_DOWNLOADS) {
    const batch = filePaths.slice(i, i + CONCURRENT_DOWNLOADS);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (filePath) => {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
          });

          if ("content" in data && data.content) {
            const decoded = Buffer.from(data.content, "base64").toString("utf-8");
            
            // PHASE 4: Content truncation and optimization
            const truncated = decoded.slice(0, MAX_CHARS_PER_FILE);
            const wasTruncated = decoded.length > MAX_CHARS_PER_FILE;

            return {
              path: filePath,
              content: wasTruncated ? `${truncated}\n\n...[truncated]` : truncated,
            };
          }
        } catch (error) {
          console.error(`[Download] Failed to fetch ${filePath}:`, error);
        }
        return null;
      })
    );

    // Collect successful downloads
    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    });
  }

  console.log(`[Download] Successfully fetched ${results.length}/${filePaths.length} files`);
  return results;
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
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  console.log("[generatePost] Starting repository analysis...");

  // Fetch repo metadata
  const { data: repo } = await octokit.rest.repos.get({
    owner: repoOwner,
    repo: repoName,
  });

  console.log("[generatePost] Repository:", repo.full_name);

  // === PHASE 1: Get complete file tree (paths only, no content) ===
  console.log("[generatePost] Phase 1: Fetching repository tree...");
  const allFiles = await getCompleteRepoTree(
    octokit,
    repoOwner,
    repoName,
    repo.default_branch
  );
  console.log(`[generatePost] Found ${allFiles.length} files in repository`);

  // === PHASE 2: AI selects the most important files ===
  console.log("[generatePost] Phase 2: AI selecting important files...");
  const selectedFilePaths = await selectFilesWithAI(
    allFiles,
    repo.full_name,
    repo.description || "No description",
    genAI
  );
  console.log(`[generatePost] AI selected ${selectedFilePaths.length} files`);

  // === PHASE 3: Download selected files in batches ===
  console.log("[generatePost] Phase 3: Downloading file contents...");
  const fileContents = await downloadFilesInBatches(
    octokit,
    repoOwner,
    repoName,
    selectedFilePaths
  );

  // Build the file structure tree (truncated for context)
  const fileTree = allFiles.slice(0, MAX_TREE_FILES).map(f => f.path).join("\n");

  // === PHASE 4: Construct optimized prompt for LinkedIn post ===
  console.log("[generatePost] Phase 4: Constructing AI prompt...");
  
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

  // Bundle file contents with clear headers
  const bundledContent = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const userPrompt = `Write a LinkedIn post about this GitHub repository:

**Repository:** ${repo.full_name}
**Description:** ${repo.description || "No description provided"}
**Language:** ${repo.language || "Not specified"}
**Stars:** ${repo.stargazers_count}
**Homepage URL:** ${repo.homepage || "None"}
**Topics:** ${(repo.topics || []).join(", ") || "None"}

**File Structure (top ${MAX_TREE_FILES}):**
${fileTree}

**Key File Contents (${fileContents.length} files analyzed):**
${bundledContent}

Focus on:
1. What problem does this solve? (lead with this)
2. Who would use this and why?
3. What makes it interesting or useful?
4. Keep it accessible — less code talk, more impact talk`;

  // === PHASE 5: Call Gemini with rate limiting ===
  console.log("[generatePost] Phase 5: Generating LinkedIn post with Gemini...");
  const estimatedPromptTokens = estimateTokens(systemInstruction + userPrompt);
  console.log(`[generatePost] Estimated tokens: ${estimatedPromptTokens}`);

  const result = await geminiRateLimiter.enqueue(async () => {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction,
    });
    return await model.generateContent(userPrompt);
  }, estimatedPromptTokens);

  const draft = result.response.text();
  console.log("[generatePost] LinkedIn post generated successfully");

  // --- Detect public pages for screenshots ---
  let publicPages: { path: string; url: string; description: string }[] = [];

  if (repo.homepage && repo.homepage.startsWith("http")) {
    console.log("[generatePost] Homepage detected:", repo.homepage);
    
    // Find routing-related files from already downloaded content
    const routingFiles = fileContents.filter(
      (f) =>
        f.path.includes("/pages/") ||
        f.path.includes("/app/") ||
        f.path.includes("/routes/") ||
        f.path.includes("router") ||
        f.path.includes("route") ||
        f.path.match(/page\.(tsx?|jsx?|vue|svelte)$/)
    );

    console.log("[generatePost] Found routing files in selected content:", routingFiles.length);

    if (routingFiles.length > 0) {
      // Prepare routing content for analysis
      const routingContent = routingFiles
        .slice(0, 10)
        .map((f) => `--- ${f.path} ---\n${f.content.slice(0, 1000)}`)
        .join("\n\n");

      const routeAnalysisPrompt = `Analyze this web application's routing structure and identify the 5 most important PUBLIC pages that should be showcased with screenshots.

Homepage URL: ${repo.homepage}

Routing Files and Structure:
${routingContent}

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
        console.log("[generatePost] Analyzing routes with Gemini...");
        const estimatedRouteTokens = estimateTokens(routeAnalysisPrompt);

        const routeResult = await geminiRateLimiter.enqueue(async () => {
          const routeModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
          });
          return await routeModel.generateContent(routeAnalysisPrompt);
        }, estimatedRouteTokens);

        const routeText = routeResult.response.text().trim();
        console.log("[generatePost] Route analysis response received");
        
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

  // Log rate limiter stats
  const stats = geminiRateLimiter.getStats();
  console.log("[generatePost] Gemini Rate Limiter Stats:", stats);

  return {
    draft,
    repoUrl: repo.html_url,
    homepage: repo.homepage || null,
    publicPages,
  };
}
