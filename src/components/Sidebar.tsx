"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  HomeIcon, WalletIcon, LinkIcon, CardIcon, ListIcon, KeyIcon, HeadsetIcon, LogoutIcon, XIcon, ShieldIcon,
} from "./icons";
import { Logo, Avatar } from "./ui";
import { apiFetch } from "@/lib/client";

const NAV = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon },
  { href: "/wallet", label: "Wallet", Icon: WalletIcon },
  { href: "/payment-link", label: "Payment Link", Icon: LinkIcon },
  { href: "/connect", label: "Connect Provider", Icon: CardIcon },
  { href: "/transactions", label: "Transactions", Icon: ListIcon },
  { href: "/api-keys", label: "API", Icon: KeyIcon },
  { href: "/support", label: "Support", Icon: HeadsetIcon },
];

export default function Sidebar({ user, open, onClose }: { user: { name: string; email: string; role: string }; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Cash<span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">Pe</span>
          </span>
        </Link>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-white/10" aria-label="Close menu">
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
        {user.role === "admin" && (
          <Link
            href="/admin"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
              pathname.startsWith("/admin")
                ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <ShieldIcon className="h-5 w-5 shrink-0" />
            Admin Panel
          </Link>
        )}
      </nav>
      <div className="border-t border-slate-200/70 p-4 dark:border-white/10">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-100/80 p-3 dark:bg-white/5">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
        >
          <LogoutIcon className="h-5 w-5" />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/70 bg-white/80 backdrop-blur-xl lg:block dark:border-white/10 dark:bg-slate-950/80">
        {content}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-slate-950">{content}</aside>
        </div>
      )}
    </>
  );
}
