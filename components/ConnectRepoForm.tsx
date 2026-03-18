"use client";

import { useState } from "react";
import { z } from "zod";

const formSchema = z.object({
  repositoryFullName: z
    .string()
    .min(1, "Repository name is required")
    .regex(
      /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
      "Must be in format owner/repo",
    ),
  scoreThreshold: z
    .number()
    .min(0, "Score threshold must be at least 0")
    .max(100, "Score threshold must be at most 100"),
});

type FormData = z.infer<typeof formSchema>;

interface ConnectedRepo {
  id: string;
  fullName: string;
  webhookSecret: string;
  scoreThreshold: number;
}

export default function ConnectRepoForm() {
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [scoreThreshold, setScoreThreshold] = useState<string>("70");
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>(
    {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState<ConnectedRepo | null>(
    null,
  );

  const validate = (): FormData | null => {
    const result = formSchema.safeParse({
      repositoryFullName,
      scoreThreshold: Number(scoreThreshold),
    });

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormData, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormData;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return null;
    }

    setErrors({});
    return result.data;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const data = validate();
    if (!data) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/repositories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: data.repositoryFullName,
          scoreThreshold: data.scoreThreshold,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to connect repository (${response.status})`,
        );
      }

      const result = await response.json();
      setConnectedRepo(result);
      setRepositoryFullName("");
      setScoreThreshold("70");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectAnother = () => {
    setConnectedRepo(null);
    setSubmitError(null);
  };

  if (connectedRepo) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Repository Connected!
          </h2>
        </div>

        <p className="text-gray-600 mb-6">
          <strong>{connectedRepo.fullName}</strong> has been successfully
          connected with a score threshold of{" "}
          <strong>{connectedRepo.scoreThreshold}</strong>.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Webhook Setup Instructions
          </h3>
          <p className="text-blue-800 text-sm mb-4">
            To enable automated PR reviews, you need to configure a webhook in
            your GitHub repository. Follow these steps:
          </p>

          <ol className="list-decimal list-inside space-y-3 text-sm text-blue-800">
            <li>
              Go to your repository on GitHub:{" "}
              <a
                href={`https://github.com/${connectedRepo.fullName}/settings/hooks`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:text-blue-600"
              >
                {connectedRepo.fullName} → Settings → Webhooks
              </a>
            </li>
            <li>
              Click <strong>Add webhook</strong>
            </li>
            <li>
              Set the <strong>Payload URL</strong> to:
              <div className="mt-1 bg-white border border-blue-300 rounded px-3 py-2 font-mono text-xs break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}
                /api/webhooks/github
              </div>
            </li>
            <li>
              Set <strong>Content type</strong> to{" "}
              <code className="bg-blue-100 px-1 rounded">application/json</code>
            </li>
            <li>
              Set the <strong>Secret</strong> to:
              <div className="mt-1 bg-white border border-blue-300 rounded px-3 py-2 font-mono text-xs break-all select-all">
                {connectedRepo.webhookSecret}
              </div>
              <p className="mt-1 text-xs text-blue-700">
                ⚠️ Save this secret securely — it will not be shown again.
              </p>
            </li>
            <li>
              Under{" "}
              <strong>
                Which events would you like to trigger this webhook?
              </strong>
              , select <strong>Let me select individual events</strong> and
              check <strong>Pull requests</strong>
            </li>
            <li>
              Ensure <strong>Active</strong> is checked, then click{" "}
              <strong>Add webhook</strong>
            </li>
          </ol>
        </div>

        <button
          onClick={handleConnectAnother}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors duration-200"
        >
          Connect Another Repository
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Connect a GitHub Repository
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Connect your repository to enable automated AI-powered pull request
        reviews.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5">
          <label
            htmlFor="repositoryFullName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Repository Full Name
          </label>
          <input
            id="repositoryFullName"
            type="text"
            value={repositoryFullName}
            onChange={(e) => setRepositoryFullName(e.target.value)}
            placeholder="owner/repository"
            className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.repositoryFullName
                ? "border-red-400 focus:ring-red-400"
                : "border-gray-300"
            }`}
            disabled={isLoading}
            aria-describedby={
              errors.repositoryFullName ? "repo-error" : undefined
            }
          />
          {errors.repositoryFullName && (
            <p id="repo-error" className="mt-1 text-xs text-red-600">
              {errors.repositoryFullName}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Example: <span className="font-mono">octocat/Hello-World</span>
          </p>
        </div>

        <div className="mb-6">
          <label
            htmlFor="scoreThreshold"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Score Threshold
          </label>
          <div className="flex items-center gap-3">
            <input
              id="scoreThreshold"
              type="number"
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(e.target.value)}
              min={0}
              max={100}
              className={`w-28 px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.scoreThreshold
                  ? "border-red-400 focus:ring-red-400"
                  : "border-gray-300"
              }`}
              disabled={isLoading}
              aria-describedby={
                errors.scoreThreshold ? "threshold-error" : "threshold-hint"
              }
            />
            <span className="text-sm text-gray-500">out of 100</span>
          </div>
          {errors.scoreThreshold ? (
            <p id="threshold-error" className="mt-1 text-xs text-red-600">
              {errors.scoreThreshold}
            </p>
          ) : (
            <p id="threshold-hint" className="mt-1 text-xs text-gray-400">
              PRs scoring below this threshold will be flagged for review.
            </p>
          )}
        </div>

        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin w-4 h-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Connecting...
            </>
          ) : (
            "Connect Repository"
          )}
        </button>
      </form>
    </div>
  );
}
