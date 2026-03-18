import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";

interface PRAnalysis {
  id: string;
  pr_id: string;
  repo_id: string;
  pr_title: string;
  pr_number: number;
  sha: string;
  merge_score: number;
  score_breakdown: Record<string, number>;
  untested_paths: Array<{
    file: string;
    line_start: number;
    line_end: number;
    description?: string;
  }>;
  test_suggestions: string;
  analyzed_at: string;
  created_at: string;
}

async function getPRAnalysis(
  prId: string,
  repoId: string,
): Promise<PRAnalysis | null> {
  const result = await db.query(
    `SELECT * FROM pr_analysis WHERE pr_id = $1 AND repo_id = $2 ORDER BY analyzed_at DESC LIMIT 1`,
    [prId, repoId],
  );
  return result.rows[0] ?? null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-500";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100 border-green-300";
  if (score >= 60) return "bg-yellow-100 border-yellow-300";
  return "bg-red-100 border-red-300";
}

function getScoreBadgeVariant(
  score: number,
): "default" | "secondary" | "destructive" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Ready to Merge";
  if (score >= 60) return "Needs Review";
  return "Not Ready";
}

function ScoreGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const strokeColor =
    clampedScore >= 80 ? "#16a34a" : clampedScore >= 60 ? "#eab308" : "#dc2626";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(clampedScore)}`}>
            {clampedScore}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge
        variant={getScoreBadgeVariant(clampedScore)}
        className="text-sm px-3 py-1"
      >
        {getScoreLabel(clampedScore)}
      </Badge>
    </div>
  );
}

function ScoreBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const clampedValue = Math.max(0, Math.min(100, value));
        const barColor =
          clampedValue >= 80
            ? "bg-green-500"
            : clampedValue >= 60
              ? "bg-yellow-500"
              : "bg-red-500";

        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-medium ${getScoreColor(clampedValue)}`}>
                {clampedValue}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} transition-all duration-500`}
                style={{ width: `${clampedValue}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function PRDetailPage({
  params,
}: {
  params: { repoId: string; prId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    notFound();
  }

  const analysis = await getPRAnalysis(params.prId, params.repoId);

  if (!analysis) {
    notFound();
  }

  const analyzedDate = new Date(analysis.analyzed_at);
  const timeAgo = formatDistanceToNow(analyzedDate, { addSuffix: true });

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      {/* Header / Metadata */}
      <div
        className={`rounded-xl border-2 p-6 ${getScoreBgColor(analysis.merge_score)}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">
                #{analysis.pr_number}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm text-muted-foreground truncate">
                SHA:{" "}
                <code className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded">
                  {analysis.sha.slice(0, 8)}
                </code>
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight break-words">
              {analysis.pr_title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Analyzed {timeAgo} &mdash;{" "}
              <time dateTime={analysis.analyzed_at}>
                {analyzedDate.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </p>
          </div>
          <div className="flex-shrink-0">
            <ScoreGauge score={analysis.merge_score} />
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      {analysis.score_breakdown &&
        Object.keys(analysis.score_breakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreBreakdown breakdown={analysis.score_breakdown} />
            </CardContent>
          </Card>
        )}

      {/* Untested Code Paths */}
      {analysis.untested_paths && analysis.untested_paths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Untested Code Paths
              <Badge variant="secondary" className="text-xs">
                {analysis.untested_paths.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.untested_paths.map((path, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono text-foreground break-all">
                        {path.file}
                      </code>
                      <Badge
                        variant="outline"
                        className="text-xs font-mono shrink-0"
                      >
                        L{path.line_start}–{path.line_end}
                      </Badge>
                    </div>
                    {path.description && (
                      <p className="text-sm text-muted-foreground">
                        {path.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* LLM Test Suggestions */}
      {analysis.test_suggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              AI-Generated Test Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Suggestions
                </span>
              </div>
              <pre className="p-4 text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap break-words font-mono text-foreground">
                {analysis.test_suggestions}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state if no suggestions or paths */}
      {(!analysis.untested_paths || analysis.untested_paths.length === 0) &&
        !analysis.test_suggestions && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No untested paths or test suggestions were identified for this
                PR.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
