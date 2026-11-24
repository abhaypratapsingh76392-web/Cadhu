"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, Spinner, EmptyState, StatusBadge, useToast } from "@/components/ui";
import { LinkIcon, CopyIcon, ExternalIcon, CheckIcon, AlertIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatINR, formatDate } from "@/lib/utils";

type Provider = { id: string; provider: string; type: string; selectedUpi: string | null; upiId: string | null };
type LinkRow = {
  linkId: string; amountPaise: number; commissionPaise: number; customerName: string;
  upiId: string; status: string; utr: string | null; createdAt: string;
};

export default function PaymentLinkPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const [form, setForm] = useState({ amount: "", customerName: "", customerEmail: "", customerPhone: "", note: "", providerId: "" });
  const [lastUrl, setLastUrl] = useState("");

  async function load() {
    try {
      const [p, l, w] = await Promise.all([
        apiJson<{ providers: Provider[] }>("/api/providers"),
        apiJson<{ links: LinkRow[] }>("/api/links"),
        apiJson<{ balancePaise: number }>("/api/wallet"),
      ]);
      setProviders(p.providers);
      setLinks(l.links);
      setBalance(w.balancePaise);
      if (p.providers.length && !form.providerId) setForm((f) => ({ ...f, providerId: p.providers[0].id }));
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setLastUrl("");
    try {
      const data = await apiJson<{ paymentUrl: string }>("/api/links", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      setLastUrl(data.paymentUrl);
      toast("success", "Payment link created successfully.");
      setForm({ amount: "", customerName: "", customerEmail: "", customerPhone: "", note: "", providerId: form.providerId });
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not create link");
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      toast("success", "Copied to clipboard");
      setTimeout(() => setCopied(""), 2000);
    });
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  const amountPaise = Math.round(Number(form.amount || 0) * 100);
  const commission = Math.round(amountPaise * 0.02);

  return (
    <div className="space-y-6 animate-fade-up">
      {providers.length === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="flex-1 text-sm text-indigo-800 dark:text-indigo-200">
            <strong>No provider connected.</strong> Connect a provider first to create payment links.
          </div>
          <Link href="/connect" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white">Connect</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <GlassCard className="p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><LinkIcon className="h-5 w-5 text-violet-500" /> Create Payment Link</h2>
          <form onSubmit={create} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Amount (INR)</span>
              <input type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 499"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
              {amountPaise > 0 && (
                <span className="mt-1.5 block text-xs text-slate-400">2% commission: {formatINR(commission)} · Wallet: {balance !== null ? formatINR(balance) : "—"}</span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Customer Name</span>
              <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer name"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email (opt)</span>
                <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} placeholder="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Phone (opt)</span>
                <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="phone"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Note (opt)</span>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Payment note"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Provider</span>
              <select required value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-slate-900">
                <option value="">Select provider</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.provider} — {p.selectedUpi || p.upiId}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={saving || providers.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:opacity-95 disabled:opacity-50">
              {saving ? <Spinner /> : <><LinkIcon className="h-4 w-4" /> Generate Link</>}
            </button>
          </form>

          {lastUrl && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
              <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300"><CheckIcon className="h-4 w-4" /> Link ready</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly value={lastUrl} className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs dark:border-emerald-500/20 dark:bg-slate-900" />
                <button onClick={() => copy(lastUrl, "new")} className="rounded-lg bg-emerald-600 p-2 text-white">{copied === "new" ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}</button>
              </div>
              <a href={`https://wa.me/?text=${encodeURIComponent("Pay here: " + lastUrl)}`} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300">
                <ExternalIcon className="h-3.5 w-3.5" /> Share on WhatsApp
              </a>
            </div>
          )}
        </GlassCard>

        <GlassCard className="overflow-hidden lg:col-span-3">
          <div className="p-5 pb-0">
            <h2 className="font-bold text-slate-900 dark:text-white">Your Links</h2>
          </div>
          {links.length === 0 ? (
            <EmptyState title="No payment links" subtitle="Generate your first link using the form." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                    <th className="px-5 py-3 font-semibold">Link</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => {
                    const url = `${window.location.origin}/pay/${l.linkId}`;
                    return (
                      <tr key={l.linkId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">{l.linkId}</p>
                          <p className="text-xs text-slate-400">{formatDate(l.createdAt)}</p>
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{formatINR(l.amountPaise)}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{l.customerName}</td>
                        <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => copy(url, l.linkId)} title="Copy link" className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">
                              {copied === l.linkId ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <CopyIcon className="h-4 w-4" />}
                            </button>
                            <a href={url} target="_blank" rel="noreferrer" title="Open payment page" className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">
                              <ExternalIcon className="h-4 w-4" />
                            </a>
                            <a href={`https://wa.me/?text=${encodeURIComponent("Pay here: " + url)}`} target="_blank" rel="noreferrer" title="Share on WhatsApp" className="rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white">WhatsApp</a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
