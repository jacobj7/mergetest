import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import RepositorySettingsForm from "@/components/RepositorySettingsForm";

interface PageProps {
  params: { repoId: string };
}

async function getRepository(repoId: string, userId: string) {
  const result = await db.query(
    `SELECT r.* FROM repositories r
     WHERE r.id = $1 AND r.user_id = $2`,
    [repoId, userId],
  );
  return result.rows[0] || null;
}

async function getRecentPRAnalyses(repoId: string) {
  const result = await db.query(
    `SELECT 
       pa.id,
       pa.pr_number,
       pa.pr_title,
       pa.score,
       pa.status,
       pa.created_at,
       pa.updated_at
     FROM pr_analyses pa
     WHERE pa.repository_id = $1
     ORDER BY pa.created_at DESC
     LIMIT 20`,
    [repoId],
  );
  return result.rows;
}

function getScoreBadgeColor(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-blue-100 text-blue-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RepositoryDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const repository = await getRepository(params.repoId, session.user.id);

  if (!repository) {
    notFound();
  }

  const prAnalyses = await getRecentPRAnalyses(params.repoId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <Link
              href="/repositories"
              className="hover:text-gray-700 transition-colors"
            >
              Repositories
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{repository.name}</span>
          </nav>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {repository.name}
              </h1>
              {repository.full_name && (
                <p className="text-gray-500 mt-1">{repository.full_name}</p>
              )}
              {repository.description && (
                <p className="text-gray-600 mt-2 max-w-2xl">
                  {repository.description}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {repository.github_url && (
                <a
                  href={repository.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  View on GitHub
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Repository Settings
              </h2>
              <RepositorySettingsForm
                repoId={params.repoId}
                initialScoreThreshold={repository.score_threshold ?? 70}
              />
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Statistics
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Analyses</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {prAnalyses.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {
                      prAnalyses.filter((pr) => pr.status === "completed")
                        .length
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Score</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {prAnalyses.filter((pr) => pr.score !== null).length > 0
                      ? Math.round(
                          prAnalyses
                            .filter((pr) => pr.score !== null)
                            .reduce((sum, pr) => sum + pr.score, 0) /
                            prAnalyses.filter((pr) => pr.score !== null).length,
                        )
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Score Threshold</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {repository.score_threshold ?? 70}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PR Analyses Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent PR Analyses
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Showing the last {prAnalyses.length} pull request analyses
                </p>
              </div>

              {prAnalyses.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No analyses yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    PR analyses will appear here once pull requests are
                    submitted for review.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PR
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {prAnalyses.map((analysis) => (
                        <tr
                          key={analysis.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-start">
                              <div>
                                <div className="text-sm font-medium text-gray-900 line-clamp-1 max-w-xs">
                                  {analysis.pr_title ||
                                    `PR #${analysis.pr_number}`}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  #{analysis.pr_number}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {analysis.score !== null ? (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScoreBadgeColor(
                                  analysis.score,
                                )}`}
                              >
                                {analysis.score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(
                                analysis.status,
                              )}`}
                            >
                              {analysis.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(analysis.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <Link
                              href={`/repositories/${params.repoId}/analyses/${analysis.id}`}
                              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
