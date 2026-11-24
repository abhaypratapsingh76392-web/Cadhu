"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, Spinner, EmptyState, StatusBadge } from "@/components/ui";
import { WalletIcon, LinkIcon, CardIcon, ListIcon, ArrowRightIcon, AlertIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatINR, formatDate } from "@/lib/utils";

type LinkRow = {
  linkId: string; amountPaise: number; commissionPaise: number; customerName: string;
  upiId: string; status: string; utr: string | null; createdAt: string;
};

export default function DashboardPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [providers, setProviders] = useState<{ id: string; provider: string; selectedUpi: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiJson<{ balancePaise: number }>("/api/wallet"),
      apiJson<{ links: LinkRow[] }>("/api/links"),
      apiJson<{ providers: { id: string; provider: string; selectedUpi: string | null }[] }>("/api/providers"),
    ])
      .then(([w, l, p]) => {
        setBalance(w.balancePaise);
        setLinks(l.links.slice(0, 5));
        setProviders(p.providers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  const successLinks = links.filter((l) => l.status === "success");
  const volume = successLinks.reduce((s, l) => s + l.amountPaise, 0);

  return (
    <div className="space-y-6 animate-fade-up">
      {balance !== null && balance < 5000 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <strong>Low wallet balance:</strong> {formatINR(balance)}. Add funds to keep creating payment links.
          </div>
          <Link href="/wallet" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">Add Funds</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-5 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Wallet Balance</p>
            <WalletIcon className="h-5 w-5 text-white/80" />
          </div>
          <p className="mt-2 text-3xl font-extrabold">{balance !== null ? formatINR(balance) : "—"}</p>
          <Link href="/wallet" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-white/90 hover:underline">Manage wallet <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Volume</p>
            <ListIcon className="h-5 w-5 text-violet-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">{formatINR(volume)}</p>
          <p className="mt-1 text-xs text-slate-400">Successful payments</p>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payment Links</p>
            <LinkIcon className="h-5 w-5 text-fuchsia-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">{links.length}</p>
          <Link href="/payment-link" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline dark:text-violet-400">Create link <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Providers</p>
            <CardIcon className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">{providers.length}<span className="text-base font-semibold text-slate-400"> / 3</span></p>
          <Link href="/connect" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline dark:text-violet-400">Connect provider <ArrowRightIcon className="h-3.5 w-3.5" /></Link>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white">Recent Payment Links</h2>
            <Link href="/transactions" className="text-xs font-bold text-violet-600 hover:underline dark:text-violet-400">View all</Link>
          </div>
          {links.length === 0 ? (
            <EmptyState title="No payment links yet" subtitle="Create your first payment link to start receiving UPI payments." />
          ) : (
            <div className="mt-4 space-y-3">
              {links.map((l) => (
                <Link key={l.linkId} href={`/pay/${l.linkId}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3.5 transition hover:border-violet-200 hover:bg-violet-50/50 dark:border-white/5 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{l.customerName} — {formatINR(l.amountPaise)}</p>
                    <p className="truncate text-xs text-slate-400">{l.linkId} · {formatDate(l.createdAt)}</p>
                  </div>
                  <StatusBadge status={l.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white">Quick Actions</h2>
          <div className="mt-4 space-y-2.5">
            <Link href="/payment-link" className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95">
              <LinkIcon className="h-5 w-5" /> Create Payment Link
            </Link>
            <Link href="/connect" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              <CardIcon className="h-5 w-5 text-violet-500" /> Connect Provider
            </Link>
            <Link href="/wallet" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              <WalletIcon className="h-5 w-5 text-fuchsia-500" /> Add Wallet Funds
            </Link>
            <Link href="/api-keys" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              <ListIcon className="h-5 w-5 text-indigo-500" /> API & Webhooks
            </Link>
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <p className="font-bold text-slate-700 dark:text-slate-200">How it works</p>
            <p className="mt-1">1. Connect a provider (UPI ID or mobile + OTP).</p>
            <p>2. Add wallet funds for 2% commission.</p>
            <p>3. Create a link and share it. Commission auto-deducts on success.</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
