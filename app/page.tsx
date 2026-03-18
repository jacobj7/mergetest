"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <svg
            className="w-8 h-8 text-indigo-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          <span className="text-xl font-bold text-white">PRAnalyzer</span>
        </div>
        <button
          onClick={() => signIn("github")}
          className="flex items-center gap-2 bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors text-sm"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          Sign in
        </button>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
          <span className="text-indigo-300 text-sm font-medium">
            AI-Powered Code Review
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
          Smarter Pull Request
          <br />
          Analysis, Instantly
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Connect your GitHub repositories and let AI analyze your pull requests
          in seconds. Get actionable insights, catch bugs early, and ship better
          code faster.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button
            onClick={() => signIn("github")}
            className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Sign in with GitHub
          </button>
          <span className="text-gray-500 text-sm">
            Free to get started · No credit card required
          </span>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-indigo-500/30 transition-colors">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              AI-Powered Insights
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Claude AI analyzes your pull requests to surface potential bugs,
              security issues, and code quality improvements automatically.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-indigo-500/30 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Instant Analysis
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Get comprehensive PR analysis in seconds, not hours. Review diffs,
              understand context, and make informed decisions faster than ever.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-indigo-500/30 transition-colors">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Track History
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Keep a full history of all analyzed PRs across your repositories.
              Monitor trends, track improvements, and maintain code quality over
              time.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Connect GitHub",
              description:
                "Sign in with your GitHub account to securely connect your repositories.",
            },
            {
              step: "02",
              title: "Select a PR",
              description:
                "Choose any open or closed pull request from your connected repositories.",
            },
            {
              step: "03",
              title: "Get Analysis",
              description:
                "Receive a detailed AI-generated analysis with actionable recommendations.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-indigo-400 font-bold text-lg">
                  {item.step}
                </span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">
                {item.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-3xl p-10">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to ship better code?
          </h2>
          <p className="text-gray-400 mb-8">
            Join developers who use PRAnalyzer to catch issues before they reach
            production.
          </p>
          <button
            onClick={() => signIn("github")}
            className="inline-flex items-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-all hover:scale-105"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <span className="text-gray-400 text-sm font-medium">
              PRAnalyzer
            </span>
          </div>
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} PRAnalyzer. Built with Claude AI.
          </p>
        </div>
      </footer>
    </main>
  );
}
