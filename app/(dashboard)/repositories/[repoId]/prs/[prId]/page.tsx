import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PRDetailClient } from "@/components/pr-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

interface PRDetailPageProps {
  params: {
    repoId: string;
    prId: string;
  };
}

async function getPRDetail(repoId: string, prId: string, userId: string) {
  const result = await db.query(
    `SELECT 
      pr.id,
      pr.title,
      pr.description,
      pr.status,
      pr.created_at,
      pr.updated_at,
      pr.author_id,
      pr.base_branch,
      pr.head_branch,
      pr.repository_id,
      r.name as repository_name,
      r.owner_id as repository_owner_id,
      u.name as author_name,
      u.email as author_email,
      u.image as author_image
    FROM pull_requests pr
    JOIN repositories r ON pr.repository_id = r.id
    JOIN users u ON pr.author_id = u.id
    WHERE pr.id = $1 
      AND pr.repository_id = $2
      AND (r.owner_id = $3 OR r.is_public = true OR EXISTS (
        SELECT 1 FROM repository_collaborators rc 
        WHERE rc.repository_id = r.id AND rc.user_id = $3
      ))`,
    [prId, repoId, userId],
  );

  if (!result.rows.length) {
    return null;
  }

  return result.rows[0];
}

async function getPRComments(prId: string) {
  const result = await db.query(
    `SELECT 
      c.id,
      c.content,
      c.created_at,
      c.updated_at,
      c.pr_id,
      c.author_id,
      c.file_path,
      c.line_number,
      c.is_resolved,
      u.name as author_name,
      u.email as author_email,
      u.image as author_image
    FROM pr_comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.pr_id = $1
    ORDER BY c.created_at ASC`,
    [prId],
  );

  return result.rows;
}

async function getPRReviews(prId: string) {
  const result = await db.query(
    `SELECT 
      rv.id,
      rv.status,
      rv.body,
      rv.created_at,
      rv.updated_at,
      rv.pr_id,
      rv.reviewer_id,
      u.name as reviewer_name,
      u.email as reviewer_email,
      u.image as reviewer_image
    FROM pr_reviews rv
    JOIN users u ON rv.reviewer_id = u.id
    WHERE rv.pr_id = $1
    ORDER BY rv.created_at DESC`,
    [prId],
  );

  return result.rows;
}

async function getPRFiles(prId: string) {
  const result = await db.query(
    `SELECT 
      f.id,
      f.file_path,
      f.additions,
      f.deletions,
      f.patch,
      f.status as file_status
    FROM pr_files f
    WHERE f.pr_id = $1
    ORDER BY f.file_path ASC`,
    [prId],
  );

  return result.rows;
}

async function PRDetailContent({
  repoId,
  prId,
  userId,
}: {
  repoId: string;
  prId: string;
  userId: string;
}) {
  const [pr, comments, reviews, files] = await Promise.all([
    getPRDetail(repoId, prId, userId),
    getPRComments(prId),
    getPRReviews(prId),
    getPRFiles(prId),
  ]);

  if (!pr) {
    notFound();
  }

  return (
    <PRDetailClient
      pr={pr}
      comments={comments}
      reviews={reviews}
      files={files}
      currentUserId={userId}
    />
  );
}

function PRDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export default async function PRDetailPage({ params }: PRDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    notFound();
  }

  const { repoId, prId } = params;

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<PRDetailSkeleton />}>
        <PRDetailContent repoId={repoId} prId={prId} userId={session.user.id} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PRDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      title: "Pull Request",
    };
  }

  const pr = await getPRDetail(params.repoId, params.prId, session.user.id);

  if (!pr) {
    return {
      title: "Pull Request Not Found",
    };
  }

  return {
    title: `${pr.title} - Pull Request #${params.prId}`,
    description: pr.description || `Pull request in ${pr.repository_name}`,
  };
}
