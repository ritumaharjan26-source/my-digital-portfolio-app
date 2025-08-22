import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/next";
import { isSpoofedBot } from "@arcjet/inspect";
import { NextResponse } from "next/server";

const ARCJET = process.env.ARCJET_KEY ?? process.env.ARCJET_SECRET_KEY;
if (!ARCJET) {
  throw new Error("Arcjet key missing. Set ARCJET_KEY (or ARCJET_SECRET_KEY) in .env.local");
}

const aj = arcjet({
  key: ARCJET,
  rules: [
    shield({ mode: process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN" }),
    detectBot({
      mode: process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN",
      allow: ["CATEGORY:SEARCH_ENGINE"],
    }),
    tokenBucket({ mode: process.env.NODE_ENV === "production" ? "LIVE" : "DRY_RUN", refillRate: 5, interval: 10, capacity: 10 }),
  ],
});

export async function GET(req: Request) {
  const decision = await aj.protect(req, { requested: 5 });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json({ error: "Too Many Requests", reason: decision.reason }, { status: 429 });
    }
    if (decision.reason.isBot()) {
      return NextResponse.json({ error: "No bots allowed", reason: decision.reason }, { status: 403 });
    }
    return NextResponse.json({ error: "Forbidden", reason: decision.reason }, { status: 403 });
  }

  if (decision.ip.isHosting()) {
    return NextResponse.json({ error: "Forbidden", reason: decision.reason }, { status: 403 });
  }

  if (decision.results.some(isSpoofedBot)) {
    return NextResponse.json({ error: "Forbidden", reason: decision.reason }, { status: 403 });
  }

  return NextResponse.json({ message: "Hello world" });
}
export const dynamic = "force-dynamic";
