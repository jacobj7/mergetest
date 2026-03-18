import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface PRDetailPageProps {
  params: { prId: string };
}

interface PRAnalysis {
  id: number;
  pr_id: number;
  risk_score: number;
  risk_level: string;
  summary: string;
  findings: string[] | null;
  recommendations: string[] | null;
  created_at: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  pr_author: string;
  pr_state: string;
  repo_name: string;
  repo_full_name: string;
  repo_owner: string;
}

function getRiskColor(riskLevel: string): string {
  switch (riskLevel?.toLowerCase()) {
    case "critical":
      return "text-red-700 bg-red-100 border-red-300";
    case "high":
      return "text-orange-700 bg-orange-100 border-orange-300";
    case "medium":
      return "text-yellow-700 bg-yellow-100 border-yellow-300";
    case "low":
      return "text-green-700 bg-green-100 border-green-300";
    default:
      return "text-gray-700 bg-gray-100 border-gray-300";
  }
}

function getRiskGaugeColor(score: number): string {
  if (score >= 80) return "#dc2626";
  if (score >= 60) return "#ea580c";
  if (score >= 40) return "#ca8a04";
  return "#16a34a";
}

function RiskGauge({ score }: { score: number }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const radius = 80;
  const strokeWidth = 16;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (clampedScore / 100) * circumference;
  const color = getRiskGaugeColor(clampedScore);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 200, height: 110 }}>
        <svg
          width="200"
          height="110"
          viewBox="0 0 200 110"
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={`M ${strokeWidth / 2 + (200 - 2 * (strokeWidth / 2 + radius)) / 2 + radius} ${110} A ${radius} ${radius} 0 0 1 ${200 - strokeWidth / 2 - (200 - 2 * (strokeWidth / 2 + radius)) / 2 - radius + 200} ${110}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M ${100 - radius} ${100} A ${radius} ${radius} 0 0 1 ${100 + radius} ${100}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Foreground arc */}
          <path
            d={`M ${100 - radius} ${100} A ${radius} ${radius} 0 0 1 ${100 + radius} ${100}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-4xl font-bold" style={{ color }}>
            {clampedScore}
          </span>
          <span className="text-sm text-gray-500">/ 100</span>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-600 font-medium">Risk Score</p>
    </div>
  );
}

export default async function PRDetailPage({ params }: PRDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const prId = parseInt(params.prId, 10);
  if (isNaN(prId)) {
    notFound();
  }

  let analysis: PRAnalysis | null = null;

  try {
    const result = await db.query<PRAnalysis>(
      `SELECT
        pa.id,
        pa.pr_id,
        pa.risk_score,
        pa.risk_level,
        pa.summary,
        pa.findings,
        pa.recommendations,
        pa.created_at,
        pr.pr_number,
        pr.title AS pr_title,
        pr.html_url AS pr_url,
        pr.author AS pr_author,
        pr.state AS pr_state,
        r.name AS repo_name,
        r.full_name AS repo_full_name,
        r.owner AS repo_owner
      FROM pr_analyses pa
      JOIN pull_requests pr ON pa.pr_id = pr.id
      JOIN repos r ON pr.repo_id = r.id
      WHERE pa.pr_id = $1
        AND r.user_id = $2
      ORDER BY pa.created_at DESC
      LIMIT 1`,
      [prId, (session.user as { id: string }).id],
    );

    if (result.rows.length === 0) {
      notFound();
    }

    analysis = result.rows[0];

    // Parse JSON fields if they come back as strings
    if (typeof analysis.findings === "string") {
      try {
        analysis.findings = JSON.parse(analysis.findings);
      } catch {
        analysis.findings = [];
      }
    }
    if (typeof analysis.recommendations === "string") {
      try {
        analysis.recommendations = JSON.parse(analysis.recommendations);
      } catch {
        analysis.recommendations = [];
      }
    }
  } catch (error) {
    console.error("Error fetching PR analysis:", error);
    notFound();
  }

  if (!analysis) {
    notFound();
  }

  const riskBadgeClass = getRiskColor(analysis.risk_level);
  const formattedDate = new Date(analysis.created_at).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <Link
              href="/dashboard"
              className="hover:text-gray-700 transition-colors"
            >
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium truncate max-w-xs">
              {analysis.repo_full_name}
            </span>
            <span>/</span>
            <span className="text-gray-900 font-medium">
              PR #{analysis.pr_number}
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {analysis.pr_title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span>
                  <span className="font-medium">Repo:</span>{" "}
                  {analysis.repo_full_name}
                </span>
                <span>•</span>
                <span>
                  <span className="font-medium">Author:</span>{" "}
                  {analysis.pr_author}
                </span>
                <span>•</span>
                <span>
                  <span className="font-medium">State:</span>{" "}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      analysis.pr_state === "open"
                        ? "bg-green-100 text-green-700"
                        : analysis.pr_state === "merged"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {analysis.pr_state}
                  </span>
                </span>
                <span>•</span>
                <span>Analyzed {formattedDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={analysis.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Risk Overview */}
          <div className="lg:col-span-1 space-y-6">
            {/* Risk Score Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Risk Overview
              </h2>
              <RiskGauge score={analysis.risk_score} />
              <div className="mt-4 flex justify-center">
                <span
                  className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${riskBadgeClass}`}
                >
                  {analysis.risk_level?.toUpperCase() ?? "UNKNOWN"} RISK
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Stats
              </h2>
              <dl className="space-y-3">
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-600">Findings</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {analysis.findings?.length ?? 0}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-600">Recommendations</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    {analysis.recommendations?.length ?? 0}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-600">PR Number</dt>
                  <dd className="text-sm font-semibold text-gray-900">
                    #{analysis.pr_number}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Summary
              </h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {analysis.summary || "No summary available."}
              </p>
            </div>

            {/* Findings */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Findings
              </h2>
              {analysis.findings && analysis.findings.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.findings.map((finding, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {index + 1}
                      </span>
                      <p className="text-gray-700 leading-relaxed text-sm">
                        {finding}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm">No findings identified.</p>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recommendations
              </h2>
              {analysis.recommendations &&
              analysis.recommendations.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {index + 1}
                      </span>
                      <p className="text-gray-700 leading-relaxed text-sm">
                        {rec}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  No recommendations at this time.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Dashboard
              </Link>

              <a
                href={analysis.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Open PR on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
