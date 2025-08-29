"use server";

import { db, subscribers, blogPosts } from "@/lib/db";
import { sql } from "drizzle-orm";
import { isAdmin } from "@/lib/auth";

export type DatabaseTestResult = {
  success: boolean;
  message: string;
  timestamp?: string;
  counts?: {
    subscribers: number;
    blogPosts: number;
  };
  error?: string;
};

export async function checkDatabaseStatus(includeCounts: boolean = false): Promise<DatabaseTestResult> {
  try {
    // Optionally check if the caller is admin as a secondary guard for callers who don't pass includeCounts
    const callerIsAdmin = await isAdmin().catch(() => false);

    // Get the most recent createdAt timestamp from subscribers as a proxy for DB time
    const latestSubscriber = await db.select({ createdAt: subscribers.createdAt })
      .from(subscribers)
      .orderBy(sql`${subscribers.createdAt} DESC`)
      .limit(1);

    const result: DatabaseTestResult = {
      success: true,
      message: "Database connection successful",
      timestamp: latestSubscriber[0]?.createdAt?.toISOString?.() || new Date().toISOString(),
    };

    // Only fetch and return counts when explicitly requested or when the caller is admin
    if (includeCounts || callerIsAdmin) {
      const [{ count: subscriberCount }] = await db.select({ count: sql`COUNT(*)` }).from(subscribers);
      const [{ count: blogPostCount }] = await db.select({ count: sql`COUNT(*)` }).from(blogPosts);
      result.counts = {
        subscribers: Number(subscriberCount),
        blogPosts: Number(blogPostCount),
      };
    }

    return result;
  } catch (error) {
    // Avoid leaking raw DB error messages in production. Log full error server-side for debugging.
    console.error("Database connection check failed:", error);

    return {
      success: false,
      message: "Database connection failed",
      // Include the raw error only in non-production environments
      error: process.env.NODE_ENV === "production" ? undefined : (error instanceof Error ? error.message : String(error)),
    };
  }
}