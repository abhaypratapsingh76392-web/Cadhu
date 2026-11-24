"use client";

import { useEffect, useState } from "react";
import { GlassCard, Spinner, EmptyState, StatusBadge, useToast } from "@/components/ui";
import { WalletIcon, PlusIcon, AlertIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatINR, formatDate } from "@/lib/utils";

type Tx = { id: string; type: string; amountPaise: number; balanceAfterPaise: number; description: string; createdAt: string };
type Req = { id: string; amountPaise: number; status: string; createdAt: string };

export default function WalletPage() {
  const toast = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiJson<{ balancePaise: number; transactions: Tx[]; requests: Req[] }>("/api/wallet");
      setBalance(data.balancePaise);
      setTxs(data.transactions);
      setReqs(data.requests);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addFunds(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiJson("/api/wallet", { method: "POST", body: JSON.stringify({ amount: Number(amount) }) });
      toast("success", "Wallet request submitted. Admin will approve shortly.");
      setAmount("");
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      {balance !== null && balance < 5000 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Warning:</strong> Wallet balance below ₹50. You may not be able to create payment links.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-6 text-white lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">Available Balance</p>
            <WalletIcon className="h-6 w-6 text-white/80" />
          </div>
          <p className="mt-3 text-4xl font-extrabold">{balance !== null ? formatINR(balance) : "—"}</p>
          <p className="mt-2 text-xs text-white/70">Used for 2% commission on each successful payment.</p>
          <form onSubmit={addFunds} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-white/90">Add Funds (INR)</span>
              <input type="number" min="10" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500"
                className="w-full rounded-xl border border-white/30 bg-white/15 px-4 py-3 text-sm font-semibold text-white placeholder-white/50 outline-none backdrop-blur focus:bg-white/25" />
            </label>
            <button type="submit" disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-violet-700 shadow transition hover:bg-white/90 disabled:opacity-60">
              {saving ? <Spinner /> : <><PlusIcon className="h-4 w-4" /> Request Add Funds</>}
            </button>
          </form>
        </GlassCard>

        <GlassCard className="p-5 lg:col-span-2">
          <h2 className="font-bold text-slate-900 dark:text-white">Wallet Requests</h2>
          {reqs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No fund requests yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {reqs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-white/5">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatINR(r.amountPaise)}</p>
                    <p className="text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="font-bold text-slate-900 dark:text-white">Transaction History</h2>
          <p className="text-xs text-slate-400">Date | Type | Amount | Description | Balance</p>
        </div>
        {txs.length === 0 ? (
          <EmptyState title="No wallet transactions" subtitle="Commission deductions and top-ups will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(t.createdAt)}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${t.type === "credit" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"}`}>{t.type}</span></td>
                    <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{t.type === "credit" ? "+" : "-"}{formatINR(t.amountPaise)}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.description}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatINR(t.balanceAfterPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
