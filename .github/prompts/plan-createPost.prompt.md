# Plan: GitHub-to-LinkedIn Post Generator (Next.js + Clerk + Neon)

**TL;DR:** Build a full-stack Next.js 16 app from the current blank scaffold. Users sign in via Clerk (GitHub + LinkedIn OAuth), browse their GitHub repos on a dashboard, click to generate an AI-powered LinkedIn post (Gemini 2.0 Pro), optionally attach a Microlink screenshot, preview/edit in a Zustand-managed modal, and publish to LinkedIn. LinkedIn Person URN and sync metadata persist in Neon via Drizzle ORM. Shadcn/UI provides the component system.

---

## 1. Install Dependencies

Install all required packages in a single command:

- **Auth:** `@clerk/nextjs`
- **Database:** `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`
- **UI:** `shadcn` CLI init → then add components: `button`, `card`, `dialog`, `textarea`, `badge`, `avatar`, `skeleton`, `separator`, `toast`
- **GitHub:** `octokit`
- **AI:** `@google/generative-ai`
- **State:** `zustand`
- **Screenshot:** `@microlink/mql`
- **Misc:** `lucide-react` (comes with shadcn)

## 2. Environment Setup

Create `.env.local` with these keys:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard |
| `CLERK_SECRET_KEY` | Clerk Dashboard |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `DATABASE_URL` | Neon connection string (pooled) |
| `GEMINI_API_KEY` | Google AI Studio |
| `LINKEDIN_CLIENT_ID` | LinkedIn Developer Portal |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn Developer Portal |

## 3. Clerk Configuration (External)

In the Clerk Dashboard:

- Enable **GitHub** social connection → add `repo` scope under "Scopes" → enable "Request access token"
- Enable **LinkedIn OIDC** social connection → add `w_member_social`, `openid`, `profile`, `email` scopes → enable "Request access token"
- Set redirect URLs to `http://localhost:3000`

## 4. Database Schema & Drizzle Config

Create `drizzle.config.ts` at the project root pointing to `DATABASE_URL`.

Create `lib/db/schema.ts` with a `users` table:

| Column | Type | Notes |
|---|---|---|
| `id` | serial, PK | Auto-increment |
| `clerkUserId` | text, unique, not null | Clerk user ID |
| `linkedInPersonId` | text, nullable | `urn:li:person:xxx` |
| `lastSyncedRepo` | text, nullable | `owner/repo` |
| `createdAt` | timestamp | Default now |
| `updatedAt` | timestamp | Default now |

Create `lib/db/index.ts` — Drizzle client using `@neondatabase/serverless` HTTP driver.

Run `npx drizzle-kit generate` then `npx drizzle-kit push` to set up the schema in Neon.

## 5. Shadcn/UI Init

Run `npx shadcn@latest init` — select "New York" style, "Zinc" base color, CSS variables enabled. This creates `components/ui/` and updates `app/globals.css` with the design tokens.

## 6. Clerk Middleware

Create `middleware.ts` at the root:

- Use `clerkMiddleware()` from `@clerk/nextjs/server`
- Protect `/dashboard(.*)` routes — redirect unauthenticated users to sign-in
- Leave `/`, `/sign-in`, `/sign-up`, and `/api/webhooks(.*)` public

## 7. Root Layout Update

Update `app/layout.tsx`:

- Wrap `{children}` in `<ClerkProvider>`
- Import Shadcn `<Toaster />` component
- Update metadata title/description

## 8. Landing Page

Rewrite `app/page.tsx`:

- Hero section with app name, tagline ("Turn your GitHub repos into viral LinkedIn posts")
- `<SignInButton />` from Clerk (redirects to `/dashboard` after auth)
- Feature cards (3): "Connect GitHub", "AI-Powered Content", "One-Click Publish"
- Clean, dark/light mode compatible design

## 9. Auth Pages

Create `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` — each rendering the respective Clerk `<SignIn />` / `<SignUp />` component centered on the page.

## 10. Dashboard Layout

Create `app/dashboard/layout.tsx`:

- Top nav bar with app logo, `<UserButton />` from Clerk
- Sidebar or top tabs is optional; single-page dashboard is sufficient for MVP

## 11. Dashboard Page (Server Component)

Create `app/dashboard/page.tsx`:

- **Server-side:** Use `auth()` from Clerk to get the current user
- Call `clerkClient.users.getUserOauthAccessToken(userId, 'oauth_github')` to get the GitHub token
- Fetch repos from GitHub REST API (`GET /user/repos`, sorted by `updated`, paginated)
- Check if LinkedIn is connected by looking for `oauth_linkedin_oidc` token — pass boolean to client
- Query Neon for the user's `linkedInPersonId` — if missing, show a "Connect LinkedIn" CTA
- Render a `<RepoList />` client component with the repo data

## 12. Zustand Store

Create `lib/store/post-store.ts`:

```
State shape:
- isModalOpen: boolean
- draftPost: string
- selectedRepo: { name, owner, url, description, homepage } | null
- screenshotUrl: string | null
- isGenerating: boolean
- isPosting: boolean
- postType: 'text' | 'image'
Actions:
- openModal, closeModal, setDraftPost, setSelectedRepo, setScreenshotUrl, setIsGenerating, setIsPosting, setPostType, reset
```

## 13. Client Components

Create these under `components/`:

| Component | File | Purpose |
|---|---|---|
| `RepoCard` | `components/repo-card.tsx` | Shadcn Card showing repo name, description, stars, language, "Generate Post" button |
| `RepoList` | `components/repo-list.tsx` | Grid of `RepoCard`s with search/filter |
| `PostPreviewModal` | `components/post-preview-modal.tsx` | Shadcn Dialog — shows editable textarea with the AI draft, screenshot preview, "Post as Text" / "Post with Image" buttons |
| `ConnectLinkedIn` | `components/connect-linkedin.tsx` | Banner prompting user to connect LinkedIn via Clerk's Account Portal |
| `GenerateButton` | `components/generate-button.tsx` | Handles click → calls server action → updates Zustand store |

## 14. Server Actions

Create `lib/actions/` directory:

### 14a. `generate-post.ts`

- Input: `{ repoOwner, repoName }`
- Fetch GitHub OAuth token via Clerk
- Initialize `Octokit` with the token
- Fetch repo metadata (`GET /repos/{owner}/{repo}`)
- Fetch file tree recursively (`GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1`)
- **Smart file selection:** Filter to only the most important files — `README.md`, `package.json`/`Cargo.toml`/`pyproject.toml` (manifest), main entry files (`src/index.*`, `app/page.*`, `main.*`), config files. Skip `node_modules`, `.git`, lock files, images, binaries. Cap at ~15 files.
- Fetch content of selected files (base64 decode from `GET /repos/{owner}/{repo}/contents/{path}`)
- Construct a Gemini prompt:
  - System instruction: "You are a LinkedIn content strategist. Write a professional, engaging LinkedIn post about this GitHub project. Do NOT use hashtags excessively. Use line breaks for readability. Include a hook in the first line. Sound human, not robotic. Keep it under 1300 characters."
  - User message: Repo name, description, homepage URL, language breakdown, file structure, key file contents
- Call `GoogleGenerativeAI` with model `gemini-2.0-pro`
- Return the generated draft text

### 14b. `capture-screenshot.ts`

- Input: `{ url: string }` (the repo's homepage URL or GitHub URL)
- Use `@microlink/mql` to capture a screenshot: `{ screenshot: true, meta: false, viewport: { width: 1200, height: 630 } }`
- Return the screenshot URL from Microlink's CDN

### 14c. `post-to-linkedin.ts`

- Input: `{ text: string, postType: 'text' | 'image', screenshotUrl?: string }`
- Fetch LinkedIn OAuth token via Clerk
- Get user's `linkedInPersonId` from Neon DB
- If missing, call `https://api.linkedin.com/v2/userinfo`, extract `sub`, save as `urn:li:person:{sub}` in DB
- **If `postType === 'text'`:** POST to `https://api.linkedin.com/v2/ugcPosts` with a text-only body
- **If `postType === 'image'`:**
  1. **Initialize upload:** POST to `https://api.linkedin.com/v2/assets?action=registerUpload` to get an upload URL and asset URN
  2. **Upload image:** Fetch the Microlink screenshot binary, PUT it to the LinkedIn upload URL
  3. **Create post:** POST to `https://api.linkedin.com/v2/ugcPosts` with the asset URN in `media[]`
- Return `{ success: true, postId }` or error

### 14d. `sync-user.ts`

- Called on first sign-in or LinkedIn connection
- Upsert user record in Neon with `clerkUserId`
- If LinkedIn token available, fetch and store `linkedInPersonId`

## 15. Webhook (Optional but Recommended)

Create `app/api/webhooks/clerk/route.ts`:

- Listen for `user.created` and `user.updated` events
- Auto-sync user data to Neon DB when they sign up or connect a new OAuth provider
- Verify webhook signature using `svix`

## 16. Next.js Config Update

Update `next.config.ts`:

- Add `images.remotePatterns` for Microlink CDN (`api.microlink.io`), GitHub avatars (`avatars.githubusercontent.com`), and LinkedIn media
- Add `serverExternalPackages` if needed for any Node-only dependencies

## 17. File Structure (Final)

```
app/
  layout.tsx
  page.tsx
  globals.css
  sign-in/[[...sign-in]]/page.tsx
  sign-up/[[...sign-up]]/page.tsx
  dashboard/
    layout.tsx
    page.tsx
  api/
    webhooks/clerk/route.ts
components/
  ui/          (shadcn components)
  repo-card.tsx
  repo-list.tsx
  post-preview-modal.tsx
  connect-linkedin.tsx
  generate-button.tsx
lib/
  db/
    index.ts
    schema.ts
  actions/
    generate-post.ts
    capture-screenshot.ts
    post-to-linkedin.ts
    sync-user.ts
  store/
    post-store.ts
middleware.ts
drizzle.config.ts
.env.local
```

---

## Decisions

- **Zustand** over React state: chosen for global draft-post state shared across modal, buttons, and dashboard
- **Gemini 2.0 Pro** over Flash: chosen for higher-quality post generation
- **Both text + image posting**: user chooses in the preview modal
- **Clerk Account Sync** approach: use `clerkClient.users.getUserOauthAccessToken()` server-side rather than storing raw tokens in our DB
- **LinkedIn API v2 `ugcPosts`** endpoint for posting (supports both text and rich media)
- **Microlink MQL** for screenshots: serverless-friendly, no Puppeteer needed
- **Webhook for user sync**: ensures DB stays consistent even if user connects LinkedIn outside the app flow

---

## Verification

1. `npx drizzle-kit push` — confirm the `users` table exists in Neon
2. `npm run dev` — verify no build errors
3. Sign in with GitHub → confirm repos load on `/dashboard`
4. Click "Generate Post" on a repo → confirm Gemini returns a draft in the modal
5. Connect LinkedIn → confirm `linkedInPersonId` is saved in DB
6. Post text-only → verify it appears on LinkedIn feed
7. Post with image → verify Microlink screenshot is captured and the image post appears on LinkedIn
8. Test edge cases: repo with no homepage (should fall back to GitHub URL for screenshot), user without LinkedIn connected (should show CTA banner)
