"use client";

import { useState } from "react";
import { z } from "zod";

interface ScoreThresholdFormProps {
  repoId: string;
  currentThreshold: number;
}

const thresholdSchema = z.object({
  threshold: z
    .number()
    .min(0, "Threshold must be at least 0")
    .max(100, "Threshold must be at most 100"),
});

export default function ScoreThresholdForm({
  repoId,
  currentThreshold,
}: ScoreThresholdFormProps) {
  const [threshold, setThreshold] = useState<string>(
    currentThreshold.toString(),
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const parsedValue = parseFloat(threshold);

    const validation = thresholdSchema.safeParse({ threshold: parsedValue });
    if (!validation.success) {
      setStatus("error");
      setErrorMessage(
        validation.error.errors[0]?.message || "Invalid threshold value",
      );
      return;
    }

    try {
      const response = await fetch(`/api/repositories/${repoId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scoreThreshold: parsedValue }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.message || `Request failed with status ${response.status}`,
        );
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThreshold(e.target.value);
    if (status !== "idle") {
      setStatus("idle");
      setErrorMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="scoreThreshold"
          className="block text-sm font-medium text-gray-700"
        >
          Score Threshold
        </label>
        <p className="mt-1 text-sm text-gray-500">
          Set the minimum score required (0–100). Pull requests scoring below
          this threshold will be flagged.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="scoreThreshold"
            type="number"
            min={0}
            max={100}
            step={1}
            value={threshold}
            onChange={handleChange}
            disabled={status === "loading"}
            className="block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            required
          />
          <span className="text-sm text-gray-500">/ 100</span>
        </div>
      </div>

      {status === "success" && (
        <div
          role="alert"
          className="rounded-md bg-green-50 p-3 text-sm text-green-800 border border-green-200"
        >
          Score threshold updated successfully.
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200"
        >
          {errorMessage ||
            "Failed to update score threshold. Please try again."}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {status === "loading" ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            "Save Threshold"
          )}
        </button>
      </div>
    </form>
  );
}
