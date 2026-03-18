import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">CodeReview AI</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors font-medium"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Dashboard
          </Link>

          <Link
            href="/dashboard/repositories"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors font-medium"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            Repositories
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? "User avatar"}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                {session.user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user?.name ?? "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user?.email ?? ""}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
