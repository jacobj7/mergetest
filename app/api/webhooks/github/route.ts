import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function verifySignature(
  payload: Buffer,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest("hex")}`;

  if (digest.length !== signature.length) {
    const maxLength = Math.max(digest.length, signature.length);
    const paddedDigest = digest.padEnd(maxLength, "\0");
    const paddedSignature = signature.padEnd(maxLength, "\0");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(paddedDigest),
        Buffer.from(paddedSignature),
      );
    } catch {
      return false;
    }
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-hub-signature-256");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const rawBody = await request.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  const isValid = verifySignature(bodyBuffer, signature, secret);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType = request.headers.get("x-github-event");

  if (eventType !== "pull_request") {
    return NextResponse.json({ message: "Event ignored" }, { status: 200 });
  }

  let payload: Record<string, unknown>;
  try {
    const bodyText = bodyBuffer.toString("utf-8");
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const action = payload.action as string;
  const handledActions = ["opened", "synchronize", "reopened"];

  if (!handledActions.includes(action)) {
    return NextResponse.json({ message: "Action ignored" }, { status: 200 });
  }

  const pullRequest = payload.pull_request as
    | Record<string, unknown>
    | undefined;
  const repository = payload.repository as Record<string, unknown> | undefined;

  if (!pullRequest || !repository) {
    return NextResponse.json(
      { error: "Invalid payload structure" },
      { status: 400 },
    );
  }

  const repositoryFullName = repository.full_name as string;
  const prNumber = pullRequest.number as number;
  const head = pullRequest.head as Record<string, unknown> | undefined;
  const sha = head?.sha as string;

  if (!repositoryFullName || !prNumber || !sha) {
    return NextResponse.json(
      { error: "Missing required payload fields" },
      { status: 400 },
    );
  }

  const job = {
    repositoryFullName,
    prNumber,
    sha,
    action,
  };

  try {
    await redis.lpush("pr-analysis-queue", JSON.stringify(job));
  } catch (error) {
    console.error("Failed to enqueue job to Redis:", error);
    return NextResponse.json(
      { error: "Failed to enqueue job" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { message: "Job enqueued successfully" },
    { status: 200 },
  );
}
