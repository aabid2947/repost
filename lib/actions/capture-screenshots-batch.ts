"use server";

import { captureScreenshot } from "./capture-screenshot";

export interface PageScreenshot {
  path: string;
  url: string;
  description: string;
  screenshotUrl: string | null;
}

export async function captureScreenshotsBatch(
  pages: { path: string; url: string; description: string }[]
): Promise<PageScreenshot[]> {
  console.log("[captureScreenshotsBatch] Capturing screenshots for", pages.length, "pages");

  if (pages.length === 0) {
    return [];
  }

  // Capture all screenshots in parallel (limit to 5)
  const pagesToCapture = pages.slice(0, 5);
  
  const screenshotsPromises = pagesToCapture.map(async (page) => {
    console.log("[captureScreenshotsBatch] Capturing:", page.url);
    const result = await captureScreenshot(page.url);
    return {
      ...page,
      screenshotUrl: result.screenshotUrl,
    };
  });

  const screenshots = await Promise.all(screenshotsPromises);
  
  // Filter out failed screenshots
  const successfulScreenshots = screenshots.filter((s) => s.screenshotUrl !== null);
  
  console.log(
    "[captureScreenshotsBatch] Successful:",
    successfulScreenshots.length,
    "/ Failed:",
    screenshots.length - successfulScreenshots.length
  );

  return screenshots; // Return all (including nulls) so user sees which failed
}
