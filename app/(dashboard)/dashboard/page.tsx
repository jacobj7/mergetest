import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import MergeScoreTrendChart from "@/components/MergeScoreTrendChart";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  connected: boolean;
  last_analyzed_at: string | null;
}

interface PRAnalysis {
  id: number;
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
  score: number;
  status: string;
  analyzed_at: string;
}

interface TrendDataPoint {
  date: string;
  avg_score: number;
}

async function getRepositories(userId: number): Promise<Repository[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT r.id, r.name, r.full_name, r.connected, r.last_analyzed_at
       FROM repositories r
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getRecentPRAnalyses(userId: number): Promise<PRAnalysis[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         pa.id,
         r.full_name as repo_full_name,
         pa.pr_number,
         pa.pr_title,
         pa.score,
         pa.status,
         pa.analyzed_at
       FROM pr_analyses pa
       JOIN repositories r ON pa.repository_id = r.id
       WHERE r.user_id = $1
       ORDER BY pa.analyzed_at DESC
       LIMIT 20`,
      [userId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getMergeScoreTrend(userId: number): Promise<TrendDataPoint[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
         DATE(pa.analyzed_at) as date,
         ROUND(AVG(pa.score)::numeric, 1) as avg_score
       FROM pr_analyses pa
       JOIN repositories r ON pa.repository_id = r.id
       WHERE r.user_id = $1
         AND pa.analyzed_at >= NOW() - INTERVAL '30 days'
         AND pa.status = 'completed'
       GROUP BY DATE(pa.analyzed_at)
       ORDER BY DATE(pa.analyzed_at) ASC`,
      [userId],
    );
    return result.rows.map((row) => ({
      date:
        row.date instanceof Date
          ? row.date.toISOString().split("T")[0]
          : String(row.date),
      avg_score: parseFloat(row.avg_score),
    }));
  } finally {
    client.release();
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBadgeColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-gray-100 text-gray-800";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userId = (session.user as { id: number }).id;

  const [repositories, recentAnalyses, trendData] = await Promise.all([
    getRepositories(userId),
    getRecentPRAnalyses(userId),
    getMergeScoreTrend(userId),
  ]);

  const connectedCount = repositories.filter((r) => r.connected).length;
  const totalAnalyses = recentAnalyses.length;
  const avgScore =
    recentAnalyses.length > 0
      ? Math.round(
          recentAnalyses.reduce((sum, a) => sum + a.score, 0) /
            recentAnalyses.length,
        )
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {session.user.name || session.user.email}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Connected Repositories
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {connectedCount} / {repositories.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
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
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Recent PR Analyses
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {totalAnalyses}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Average Merge Score
                    </dt>
                    <dd
                      className={`text-lg font-semibold ${getScoreColor(avgScore)}`}
                    >
                      {totalAnalyses > 0 ? `${avgScore}/100` : "N/A"}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Repositories Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Repositories
            </h2>
            <a
              href="/dashboard/repositories"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Manage repositories →
            </a>
          </div>

          {repositories.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
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
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No repositories
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by connecting a GitHub repository.
              </p>
              <div className="mt-6">
                <a
                  href="/dashboard/repositories"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Connect Repository
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="bg-white shadow rounded-lg p-5 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {repo.full_name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 truncate">
                        {repo.name}
                      </p>
                    </div>
                    <span
                      className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        repo.connected
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {repo.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center text-xs text-gray-500">
                    <svg
                      className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {repo.last_analyzed_at
                      ? `Last analyzed ${formatDate(repo.last_analyzed_at)}`
                      : "Never analyzed"}
                  </div>
                  <div className="mt-3">
                    <a
                      href={`/dashboard/repositories/${repo.id}`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View details →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 30-Day Merge Score Trend */}
        <div className="mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              30-Day Merge Score Trend
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Average daily merge scores across all repositories
            </p>
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400">
                <div className="text-center">
                  <svg
                    className="mx-auto h-10 w-10 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                  <p className="mt-2 text-sm">No trend data available yet</p>
                </div>
              </div>
            ) : (
              <MergeScoreTrendChart data={trendData} />
            )}
          </div>
        </div>

        {/* Recent PR Analyses Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent PR Analyses
            </h2>
            <a
              href="/dashboard/analyses"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all →
            </a>
          </div>

          {recentAnalyses.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
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
                PR analyses will appear here once repositories are connected and
                PRs are analyzed.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Repository
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        PR
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Title
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Score
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentAnalyses.map((analysis) => (
                      <tr
                        key={analysis.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs block">
                            {analysis.repo_full_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            #{analysis.pr_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="text-sm text-gray-900 truncate block max-w-xs"
                            title={analysis.pr_title}
                          >
                            {analysis.pr_title}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getScoreBadgeColor(
                              analysis.score,
                            )}`}
                          >
                            {analysis.score}/100
                          </span>
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
                          {formatDate(analysis.analyzed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
