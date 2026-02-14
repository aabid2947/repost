import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  
  // GitHub OAuth
  githubAccessToken: text("github_access_token"),
  githubUsername: text("github_username"),
  githubUserId: text("github_user_id"),
  
  // LinkedIn OAuth
  linkedinAccessToken: text("linkedin_access_token"),
  linkedinPersonId: text("linkedin_person_id"),
  linkedinProfileUrl: text("linkedin_profile_url"),
  
  lastSyncedRepo: text("last_synced_repo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
