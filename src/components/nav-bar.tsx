"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/", label: "About" },
  { href: "/market", label: "Market" },
  { href: "/lab", label: "Ideas Lab" },
];

export default function NavBar() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="nav sticky top-0 z-40">
      <div className="w-full max-w-[1200px] mx-auto flex items-center gap-4 sm:gap-9">
        <Link href="/" className="nav-brand">
          <span className="nav-mark">M</span>
          <span className="hidden sm:inline">Markedia</span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              aria-current={isCurrent(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {loading ? (
            <div className="w-24 h-9 rounded-full bg-neutral-200 animate-pulse" />
          ) : user ? (
            <>
              <Link
                href="/account"
                className="flex items-center gap-2 no-underline text-sm font-semibold text-neutral-700 hover:text-ink transition-colors"
              >
                <span className="avatar w-[26px] h-[26px] text-[11px]">{initials}</span>
                <span className="hidden sm:inline">{displayName}</span>
              </Link>
              <button onClick={() => signOut()} className="btn btn-ghost btn-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/account?mode=login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link href="/account?mode=signup" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
