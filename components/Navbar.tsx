"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-gray-900">AppName</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-600 hover:text-indigo-600 transition-colors duration-200 font-medium"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-indigo-600 transition-colors duration-200 font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              className="text-gray-600 hover:text-indigo-600 transition-colors duration-200 font-medium"
            >
              About
            </Link>
          </div>

          {/* User Session Info */}
          <div className="hidden md:flex items-center space-x-4">
            {status === "loading" && (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            )}

            {status === "authenticated" && session?.user && (
              <div className="flex items-center space-x-3">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "User avatar"}
                    className="w-8 h-8 rounded-full object-cover border-2 border-indigo-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600 font-semibold text-sm">
                      {session.user.name
                        ? session.user.name.charAt(0).toUpperCase()
                        : (session.user.email?.charAt(0).toUpperCase() ?? "U")}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  {session.user.name && (
                    <span className="text-sm font-medium text-gray-900 leading-tight">
                      {session.user.name}
                    </span>
                  )}
                  {session.user.email && (
                    <span className="text-xs text-gray-500 leading-tight">
                      {session.user.email}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="ml-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Sign Out
                </button>
              </div>
            )}

            {status === "unauthenticated" && (
              <div className="flex items-center space-x-3">
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors duration-200"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-indigo-600 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-3">
            <Link
              href="/"
              className="block text-gray-600 hover:text-indigo-600 transition-colors duration-200 font-medium py-1"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="block text-gray-600 hover:text-indigo-600 transition-colors duration-200 font-medium py-1"
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              className="block text-gray-600 hover:text-indigo-600 transition-colors duration-200 font-medium py-1"
              onClick={() => setMenuOpen(false)}
            >
              About
            </Link>

            <div className="pt-3 border-t border-gray-200">
              {status === "authenticated" && session?.user && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name ?? "User avatar"}
                        className="w-8 h-8 rounded-full object-cover border-2 border-indigo-100"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {session.user.name
                            ? session.user.name.charAt(0).toUpperCase()
                            : (session.user.email?.charAt(0).toUpperCase() ??
                              "U")}
                        </span>
                      </div>
                    )}
                    <div>
                      {session.user.name && (
                        <p className="text-sm font-medium text-gray-900">
                          {session.user.name}
                        </p>
                      )}
                      {session.user.email && (
                        <p className="text-xs text-gray-500">
                          {session.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Sign Out
                  </button>
                </div>
              )}

              {status === "unauthenticated" && (
                <div className="space-y-2">
                  <Link
                    href="/auth/signin"
                    className="block w-full text-center px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50 transition-colors duration-200"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="block w-full text-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors duration-200"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
