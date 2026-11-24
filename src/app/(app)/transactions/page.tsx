"use client";

import { useEffect, useState } from "react";
import { GlassCard, Spinner, EmptyState, StatusBadge, useToast } from "@/components/ui";
import { DownloadIcon, XIcon, SearchIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatINR, formatDate } from "@/lib/utils";

type Tx = {
  linkId: string; amountPaise: number; commissionPaise: number; customerName: string;
  customerEmail: string | null; upiId: string; status: string; utr: string | null;
  createdAt: string; provider: string; note: string | null;
};

export default function TransactionsPage() {
  const toast = useToast();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<Tx | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (provider) params.set("provider", provider);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await apiJson<{ transactions: Tx[] }>(`/api/transactions?${params.toString()}`);
      setTxs(data.transactions);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function exportCsv() {
    window.location.href = "/api/transactions/export";
    toast("success", "CSV download started");
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[140px]">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-slate-900">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <label className="block flex-1 min-w-[140px]">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">Provider</span>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. phonepe_business"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-white/5" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-slate-900" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-slate-900" />
          </label>
          <button onClick={load} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white">
            <SearchIcon className="h-4 w-4" /> Filter
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
            <DownloadIcon className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>
        ) : txs.length === 0 ? (
          <EmptyState title="No transactions found" subtitle="Adjust filters or create a payment link to see transactions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                  <th className="px-5 py-3 font-semibold">Link ID</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Provider</th>
                  <th className="px-5 py-3 font-semibold">UPI ID</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">UTR</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.linkId} onClick={() => setDetail(t)} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{t.linkId}</td>
                    <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{formatINR(t.amountPaise)}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.customerName}</td>
                    <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{t.provider.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.upiId}</td>
                    <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{t.utr || "—"}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-pop-in dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Transaction Detail</h3>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"><XIcon className="h-5 w-5" /></button>
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              {[
                ["Link ID", detail.linkId],
                ["Amount", formatINR(detail.amountPaise)],
                ["Commission (2%)", formatINR(detail.commissionPaise)],
                ["Customer", detail.customerName],
                ["Email", detail.customerEmail || "—"],
                ["Provider", detail.provider.replace(/_/g, " ")],
                ["UPI ID", detail.upiId],
                ["Status", detail.status],
                ["UTR", detail.utr || "—"],
                ["Note", detail.note || "—"],
                ["Date", formatDate(detail.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2 last:border-0 dark:border-white/5">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="text-right font-semibold capitalize text-slate-800 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
