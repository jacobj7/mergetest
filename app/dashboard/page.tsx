import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface PullRequestWithAnalysis {
  id: number;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  title: string;
  author: string;
  pr_url: string;
  created_at: Date;
  analysis_id: number | null;
  risk_score: number | null;
  risk_level: string | null;
  analyzed_at: Date | null;
}

async function getPullRequestsWithAnalyses(): Promise<
  PullRequestWithAnalysis[]
> {
  const result = await db.query(`
    SELECT
      pr.id,
      pr.repo_owner,
      pr.repo_name,
      pr.pr_number,
      pr.title,
      pr.author,
      pr.pr_url,
      pr.created_at,
      pa.id AS analysis_id,
      pa.risk_score,
      pa.risk_level,
      pa.analyzed_at
    FROM pull_requests pr
    LEFT JOIN pr_analyses pa ON pr.id = pa.pull_request_id
    ORDER BY pa.risk_score DESC NULLS LAST, pr.created_at DESC
  `);
  return result.rows;
}

function getRiskBadgeClasses(riskLevel: string | null): string {
  switch (riskLevel?.toLowerCase()) {
    case "critical":
      return "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200";
    case "high":
      return "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200";
    case "medium":
      return "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200";
    case "low":
      return "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200";
    default:
      return "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200";
  }
}

function getRiskScoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-red-600 font-bold";
  if (score >= 60) return "text-orange-600 font-semibold";
  if (score >= 40) return "text-yellow-600 font-semibold";
  return "text-green-600 font-semibold";
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const pullRequests = await getPullRequestsWithAnalyses();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Pull Request Risk Dashboard
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Monitor and analyze risk scores for all pull requests
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Signed in as{" "}
                <span className="font-medium text-gray-900">
                  {session.user?.name || session.user?.email}
                </span>
              </span>
              <Link
                href="/api/auth/signout"
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Sign out
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-bold">
                      {pullRequests.length}
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total PRs
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {pullRequests.length}
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
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-sm font-bold">
                      {
                        pullRequests.filter(
                          (pr) => pr.risk_level?.toLowerCase() === "critical",
                        ).length
                      }
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Critical Risk
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {
                        pullRequests.filter(
                          (pr) => pr.risk_level?.toLowerCase() === "critical",
                        ).length
                      }
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
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-bold">
                      {
                        pullRequests.filter(
                          (pr) => pr.risk_level?.toLowerCase() === "high",
                        ).length
                      }
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      High Risk
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {
                        pullRequests.filter(
                          (pr) => pr.risk_level?.toLowerCase() === "high",
                        ).length
                      }
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
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-bold">
                      {
                        pullRequests.filter((pr) => pr.analysis_id === null)
                          .length
                      }
                    </span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Not Analyzed
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {
                        pullRequests.filter((pr) => pr.analysis_id === null)
                          .length
                      }
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pull Requests Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Pull Requests
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Sorted by risk score (highest first)
            </p>
          </div>

          {pullRequests.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No pull requests
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                No pull requests have been tracked yet.
              </p>
            </div>
          ) : (
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
                      Pull Request
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Author
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Risk Level
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Risk Score
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Analyzed
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pullRequests.map((pr) => (
                    <tr
                      key={pr.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {pr.repo_owner}/{pr.repo_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              #{pr.pr_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate font-medium">
                          {pr.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(pr.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                {pr.author?.charAt(0)?.toUpperCase() || "?"}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {pr.author}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pr.risk_level ? (
                          <span className={getRiskBadgeClasses(pr.risk_level)}>
                            {pr.risk_level.charAt(0).toUpperCase() +
                              pr.risk_level.slice(1).toLowerCase()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Not analyzed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pr.risk_score !== null ? (
                          <div className="flex items-center">
                            <span
                              className={`text-sm ${getRiskScoreColor(pr.risk_score)}`}
                            >
                              {pr.risk_score.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">
                              / 100
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pr.analyzed_at ? (
                          <span title={new Date(pr.analyzed_at).toISOString()}>
                            {new Date(pr.analyzed_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/pr/${pr.id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
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
  );
}
