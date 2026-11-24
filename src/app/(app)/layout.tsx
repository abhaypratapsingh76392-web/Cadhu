"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/client";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/wallet": "Wallet",
  "/payment-link": "Payment Link",
  "/connect": "Connect Provider",
  "/transactions": "Transactions",
  "/api-keys": "API",
  "/support": "Support",
  "/admin": "Admin Panel",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch("/api/csrf").catch(() => {});
    apiFetch("/api/me")
      .then(async (r) => {
        if (!r.ok) { router.push("/"); return; }
        const data = await r.json();
        setUser(data.user);
      })
      .catch(() => router.push("/"));
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-violet-500" />
      </div>
    );
  }

  const title = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] || "CashPe";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <Topbar title={title} onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
