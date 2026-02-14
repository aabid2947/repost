import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET env variable");
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Verification failed", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id: clerkUserId } = evt.data;

    // Upsert user record
    await db
      .insert(users)
      .values({
        clerkUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: { updatedAt: new Date() },
      });

    // Note: LinkedIn person URN is fetched on first post attempt
    // or via the sync-user server action, because we need the OAuth
    // token which isn't available in the webhook payload.
  }

  if (eventType === "user.deleted") {
    const { id: clerkUserId } = evt.data;
    if (clerkUserId) {
      await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
    }
  }

  return new Response("OK", { status: 200 });
}
