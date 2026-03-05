"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center gap-6">
            <Link href="/providers" className="text-lg font-bold text-blue-600">
              CloudPass
            </Link>
            {user && (
              <div className="hidden sm:flex items-center gap-4">
                <Link href="/providers" className="text-sm text-gray-600 hover:text-gray-900">
                  Providers
                </Link>
                <Link href="/review" className="text-sm text-gray-600 hover:text-gray-900">
                  Review
                </Link>
                {user.is_admin && (
                  <Link href="/admin/import" className="text-sm text-gray-600 hover:text-gray-900">
                    Import
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="text-sm text-gray-500 hidden sm:inline">{user.display_name}</span>
                <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:inline-flex">
                  Logout
                </Button>
                <button
                  className="sm:hidden p-2 text-gray-600 hover:text-gray-900"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Toggle menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {menuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {user && menuOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            <Link href="/providers" onClick={closeMenu} className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
              Providers
            </Link>
            <Link href="/review" onClick={closeMenu} className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
              Review
            </Link>
            {user.is_admin && (
              <Link href="/admin/import" onClick={closeMenu} className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                Import
              </Link>
            )}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <span className="block px-3 py-1 text-xs text-gray-400">{user.display_name}</span>
              <button
                onClick={() => { closeMenu(); logout(); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
