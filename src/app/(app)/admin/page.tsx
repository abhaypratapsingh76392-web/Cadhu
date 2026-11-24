"use client";

import { useEffect, useState } from "react";
import { GlassCard, Spinner, EmptyState, StatusBadge, useToast } from "@/components/ui";
import { UsersIcon, ChartIcon, LinkIcon, ListIcon, HeadsetIcon, WalletIcon, SettingsIcon, SearchIcon, SendIcon, BellIcon, DownloadIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatINR, formatDate } from "@/lib/utils";

type Stats = { totalUsers: number; volumePaise: number; commissionPaise: number; activeLinks: number; last7Days: { date: string; volume: number; commission: number }[] };
type AdminUser = { id: string; name: string; email: string; role: string; emailVerified: boolean; walletBalancePaise: number; blocked: boolean; createdAt: string };
type AdminLink = { linkId: string; amountPaise: number; commissionPaise: number; customerName: string; upiId: string; status: string; utr: string | null; createdAt: string; user: { name: string; email: string } | null };
type WalletReq = { id: string; amountPaise: number; status: string; createdAt: string; user: { name: string; email: string } | null };
type Chat = { id: string; userId: string; lastMessage: string | null; unreadByAdmin: number; updatedAt: string; user: { name: string; email: string } | null };
type Msg = { id: string; senderRole: string; body: string; createdAt: string };

const TABS = [
  { id: "dashboard", label: "Dashboard", Icon: ChartIcon },
  { id: "users", label: "Users", Icon: UsersIcon },
  { id: "links", label: "Payment Links", Icon: LinkIcon },
  { id: "transactions", label: "Transactions", Icon: ListIcon },
  { id: "support", label: "Support Chats", Icon: HeadsetIcon },
  { id: "wallet", label: "Wallet Requests", Icon: WalletIcon },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function AdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [links, setLinks] = useState<AdminLink[]>([]);
  const [linkStatus, setLinkStatus] = useState("");
  const [reqs, setReqs] = useState<WalletReq[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [settings, setSettings] = useState({ commissionPercent: "2", smtpHost: "", smtpUser: "", providerKeys: "" });
  const [firebaseText, setFirebaseText] = useState("");
  const [firebaseInfo, setFirebaseInfo] = useState<{ configured: boolean; projectId: string | null; apiKeyHint: string | null }>({ configured: false, projectId: null, apiKeyHint: null });
  const [firebaseBusy, setFirebaseBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [walletAmt, setWalletAmt] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    try {
      const [s, u, l, w, c, st, fb] = await Promise.all([
        apiJson<Stats>("/api/admin/stats"),
        apiJson<{ users: AdminUser[] }>("/api/admin/users"),
        apiJson<{ links: AdminLink[] }>("/api/admin/links"),
        apiJson<{ requests: WalletReq[] }>("/api/admin/wallet-requests"),
        apiJson<{ chats: Chat[] }>("/api/admin/support"),
        apiJson<{ settings: Record<string, string> }>("/api/admin/settings"),
        apiJson<{ configured: boolean; projectId: string | null; apiKeyHint: string | null }>("/api/admin/firebase"),
      ]);
      setStats(s); setUsers(u.users); setLinks(l.links); setReqs(w.requests); setChats(c.chats);
      setFirebaseInfo(fb);
      setSettings({
        commissionPercent: st.settings.commission_percent || "2",
        smtpHost: st.settings.smtp_host || "",
        smtpUser: st.settings.smtp_user || "",
        providerKeys: st.settings.provider_api_keys || "",
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Forbidden")) setForbidden(true);
      else toast("error", err instanceof Error ? err.message : "Could not load admin data");
    }
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  async function openChat(id: string) {
    setActiveChat(id);
    try {
      const data = await apiJson<{ messages: Msg[] }>(`/api/admin/support?chatId=${id}`);
      setMsgs(data.messages);
      loadAll();
    } catch { /* ignore */ }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChat || !reply.trim()) return;
    try {
      await apiJson("/api/admin/support", { method: "POST", body: JSON.stringify({ chatId: activeChat, body: reply }) });
      setReply("");
      openChat(activeChat);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Reply failed");
    }
  }

  async function userAction(action: string, userId: string, amount?: number) {
    try {
      await apiJson("/api/admin/users", { method: "POST", body: JSON.stringify({ action, userId, amount }) });
      toast("success", "Done");
      loadAll();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    }
  }

  async function reviewRequest(id: string, action: string) {
    try {
      await apiJson("/api/admin/wallet-requests", { method: "POST", body: JSON.stringify({ id, action }) });
      toast("success", action === "approve" ? "Request approved" : "Request rejected");
      loadAll();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Action failed");
    }
  }

  async function saveFirebase() {
    setFirebaseBusy(true);
    try {
      const data = await apiJson<{ projectId: string }>("/api/admin/firebase", { method: "POST", body: JSON.stringify({ action: "save", config: firebaseText }) });
      toast("success", `Firebase connected: ${data.projectId}. Testing...`);
      setFirebaseText("");
      await testFirebase();
      loadAll();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Invalid Firebase config");
    } finally { setFirebaseBusy(false); }
  }

  async function testFirebase() {
    setFirebaseBusy(true);
    try {
      const data = await apiJson<{ ok: boolean; message: string }>("/api/admin/firebase", { method: "POST", body: JSON.stringify({ action: "test" }) });
      toast(data.ok ? "success" : "error", data.message);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Firebase test failed");
    } finally { setFirebaseBusy(false); }
  }

  async function removeFirebase() {
    setFirebaseBusy(true);
    try {
      await apiJson("/api/admin/firebase", { method: "POST", body: JSON.stringify({ action: "remove" }) });
      toast("success", "Firebase disconnected");
      loadAll();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not remove");
    } finally { setFirebaseBusy(false); }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiJson("/api/admin/settings", { method: "POST", body: JSON.stringify(settings) });
      toast("success", "Settings saved");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not save");
    }
  }

  async function searchUsers() {
    try {
      const data = await apiJson<{ users: AdminUser[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`);
      setUsers(data.users);
    } catch { /* ignore */ }
  }

  async function filterLinks() {
    try {
      const data = await apiJson<{ links: AdminLink[] }>(`/api/admin/links${linkStatus ? `?status=${linkStatus}` : ""}`);
      setLinks(data.links);
    } catch { /* ignore */ }
  }

  if (forbidden) {
    return (
      <GlassCard className="p-10 text-center">
        <p className="text-lg font-bold text-slate-900 dark:text-white">Access Denied</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Admin panel sirf admin account ke liye hai. Pehla registered account hi admin banta hai.</p>
      </GlassCard>
    );
  }
  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  const maxVol = Math.max(1, ...((stats?.last7Days || []).map((d) => d.volume)));

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"}`}>
            <Icon className="h-4 w-4" /> {label}
            {id === "support" && chats.some((c) => c.unreadByAdmin > 0) && <BellIcon className="h-4 w-4" />}
          </button>
        ))}
      </div>

      {tab === "dashboard" && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Users", value: String(stats.totalUsers) },
              { label: "Total Volume", value: formatINR(stats.volumePaise) },
              { label: "Commission Earned", value: formatINR(stats.commissionPaise) },
              { label: "Active Links", value: String(stats.activeLinks) },
            ].map((c) => (
              <GlassCard key={c.label} className="p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{c.value}</p>
              </GlassCard>
            ))}
          </div>
          <GlassCard className="p-5">
            <h3 className="font-bold text-slate-900 dark:text-white">Last 7 Days Volume</h3>
            <div className="mt-5 flex h-40 items-end gap-3">
              {stats.last7Days.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">{formatINR(d.volume)}</span>
                  <div className="w-full rounded-t-xl bg-gradient-to-t from-indigo-500 to-fuchsia-500 transition-all hover:opacity-80" style={{ height: `${Math.max(4, (d.volume / maxVol) * 110)}px` }} />
                  <span className="text-[10px] text-slate-400">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "users" && (
        <GlassCard className="p-5">
          <div className="flex flex-wrap gap-2">
            <span className="relative flex-1 min-w-[200px]">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none dark:border-white/10 dark:bg-white/5" />
            </span>
            <button onClick={searchUsers} className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white">Search</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                  <th className="py-3 pr-4 font-semibold">User</th><th className="py-3 pr-4 font-semibold">Role</th><th className="py-3 pr-4 font-semibold">Wallet</th><th className="py-3 pr-4 font-semibold">Verified</th><th className="py-3 pr-4 font-semibold">Status</th><th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="py-3 pr-4"><p className="font-semibold text-slate-900 dark:text-white">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></td>
                    <td className="py-3 pr-4"><StatusBadge status={u.role} /></td>
                    <td className="py-3 pr-4 font-bold">{formatINR(u.walletBalancePaise)}</td>
                    <td className="py-3 pr-4">{u.emailVerified ? "Yes" : "No"}</td>
                    <td className="py-3 pr-4"><StatusBadge status={u.blocked ? "blocked" : "active"} /></td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input type="number" placeholder="Amt" value={walletAmt[u.id] || ""} onChange={(e) => setWalletAmt({ ...walletAmt, [u.id]: e.target.value })}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5" />
                        <button onClick={() => userAction("credit", u.id, Number(walletAmt[u.id]))} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">Credit</button>
                        <button onClick={() => userAction("debit", u.id, Number(walletAmt[u.id]))} className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-white">Debit</button>
                        {u.blocked
                          ? <button onClick={() => userAction("unblock", u.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold dark:border-white/10">Unblock</button>
                          : <button onClick={() => userAction("block", u.id)} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white">Block</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {tab === "links" && (
        <GlassCard className="p-5">
          <div className="flex flex-wrap gap-2">
            <select value={linkStatus} onChange={(e) => setLinkStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-900">
              <option value="">All statuses</option>
              <option value="pending">Pending</option><option value="success">Success</option><option value="expired">Expired</option>
            </select>
            <button onClick={filterLinks} className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white">Filter</button>
          </div>
          {links.length === 0 ? <EmptyState title="No links" /> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                    <th className="py-3 pr-4 font-semibold">Link</th><th className="py-3 pr-4 font-semibold">Merchant</th><th className="py-3 pr-4 font-semibold">Amount</th><th className="py-3 pr-4 font-semibold">Status</th><th className="py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.linkId} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="py-3 pr-4 font-semibold">{l.linkId}</td>
                      <td className="py-3 pr-4">{l.user?.name || "—"}<p className="text-xs text-slate-400">{l.user?.email}</p></td>
                      <td className="py-3 pr-4 font-bold">{formatINR(l.amountPaise)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={l.status} /></td>
                      <td className="py-3 text-slate-400">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {tab === "transactions" && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Global Transactions</h3>
            <a href="/api/transactions/export" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10"><DownloadIcon className="h-4 w-4" /> Export CSV</a>
          </div>
          {links.length === 0 ? <EmptyState title="No transactions" /> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-white/5">
                    <th className="py-3 pr-4 font-semibold">Link</th><th className="py-3 pr-4 font-semibold">Customer</th><th className="py-3 pr-4 font-semibold">Amount</th><th className="py-3 pr-4 font-semibold">UTR</th><th className="py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.linkId} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="py-3 pr-4 font-semibold">{l.linkId}</td>
                      <td className="py-3 pr-4">{l.customerName}</td>
                      <td className="py-3 pr-4 font-bold">{formatINR(l.amountPaise)}</td>
                      <td className="py-3 pr-4 text-slate-400">{l.utr || "—"}</td>
                      <td className="py-3"><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {tab === "support" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <GlassCard className="p-4 lg:col-span-1">
            <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><BellIcon className="h-4 w-4 text-violet-500" /> Inbox</h3>
            <div className="mt-3 space-y-2">
              {chats.length === 0 ? <p className="text-sm text-slate-400">No chats yet.</p> : chats.map((c) => (
                <button key={c.id} onClick={() => openChat(c.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${activeChat === c.id ? "border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10" : "border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{c.user?.name || "User"}</p>
                    {c.unreadByAdmin > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{c.unreadByAdmin}</span>}
                  </div>
                  <p className="truncate text-xs text-slate-400">{c.user?.email}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.lastMessage || "No messages"}</p>
                </button>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="flex min-h-[420px] flex-col overflow-hidden lg:col-span-2">
            {!activeChat ? (
              <EmptyState title="Select a chat" subtitle="Click a user to view and reply to their messages." />
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {msgs.length === 0 ? <p className="text-center text-sm text-slate-400">No messages yet.</p> : msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.senderRole === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${m.senderRole === "admin" ? "rounded-br-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white" : "rounded-bl-md bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100"}`}>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${m.senderRole === "admin" ? "text-white/70" : "text-slate-400"}`}>{formatDate(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendReply} className="flex gap-2 border-t border-slate-100 p-3 dark:border-white/5">
                  <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as admin..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5" />
                  <button type="submit" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white"><SendIcon className="h-4 w-4" /> Reply</button>
                </form>
              </>
            )}
          </GlassCard>
        </div>
      )}

      {tab === "wallet" && (
        <GlassCard className="p-5">
          <h3 className="font-bold text-slate-900 dark:text-white">Wallet Requests</h3>
          {reqs.length === 0 ? <EmptyState title="No wallet requests" /> : (
            <div className="mt-4 space-y-2">
              {reqs.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3.5 dark:border-white/5">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{formatINR(r.amountPaise)} — {r.user?.name || "User"}</p>
                    <p className="text-xs text-slate-400">{r.user?.email} · {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => reviewRequest(r.id, "approve")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button>
                        <button onClick={() => reviewRequest(r.id, "reject")} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">Reject</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {tab === "settings" && (
        <GlassCard className="max-w-2xl p-5">
          <h3 className="font-bold text-slate-900 dark:text-white">Settings</h3>
          <form onSubmit={saveSettings} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Commission %</span>
              <input type="number" step="0.1" min="0" value={settings.commissionPercent} onChange={(e) => setSettings({ ...settings, commissionPercent: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">SMTP Host</span>
              <input value={settings.smtpHost} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} placeholder="smtp.gmail.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">SMTP User</span>
              <input value={settings.smtpUser} onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })} placeholder="user@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Provider API Keys (JSON)</span>
              <textarea rows={3} value={settings.providerKeys} onChange={(e) => setSettings({ ...settings, providerKeys: e.target.value })} placeholder='{"phonepe":"..."}'
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs outline-none dark:border-white/10 dark:bg-white/5" />
            </label>
            <button type="submit" className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white">Save Settings</button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Firebase (Firestore) — Sirf Firebase Dalein, Koi API Key Nahi</h3>
              {firebaseInfo.configured ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Connected: {firebaseInfo.projectId}</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Not configured</span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Firebase Console → Project Settings → &quot;Your apps&quot; → Web app banayein → wahan se <strong>firebaseConfig</strong> ka poora object jaisa-ka-waisa copy karke yahan paste kar dein.
              Koi JSON file ya service account nahi chahiye. Isi ek config se:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <li>Google login (Firebase Authentication) chalega — koi Google Client ID nahi chahiye</li>
              <li>Users, providers, payment links, wallet, support chats — sab Firestore me live sync hoga</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">Firebase Console → Authentication → Sign-in method me <strong>Google enable</strong> karna na bhoolein, aur Authorized domains me apna domain add karein.</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Firebase Config (seedha paste karein — jaise console me dikhta hai)</span>
              <textarea rows={8} value={firebaseText} onChange={(e) => setFirebaseText(e.target.value)}
                placeholder={'const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "myapp.firebaseapp.com",\n  projectId: "myapp",\n  storageBucket: "myapp.appspot.com",\n  messagingSenderId: "123...",\n  appId: "1:123:web:abc..."\n};'}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={saveFirebase} disabled={firebaseBusy || !firebaseText.trim()} className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {firebaseBusy ? "Working..." : "Save Firebase Config"}
              </button>
              <button type="button" onClick={testFirebase} disabled={firebaseBusy} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold dark:border-white/10 disabled:opacity-50">Test Connection</button>
              {firebaseInfo.configured && (
                <button type="button" onClick={removeFirebase} disabled={firebaseBusy} className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Disconnect</button>
              )}
            </div>
            {firebaseInfo.configured && (
              <p className="mt-3 text-xs text-slate-400">
                Project: <strong className="text-slate-600 dark:text-slate-200">{firebaseInfo.projectId}</strong> · API key: {firebaseInfo.apiKeyHint} ·
                Collections: users, providers, payment_links, wallet_transactions, support_chats, support_messages
              </p>
            )}
            <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <p className="font-bold text-slate-700 dark:text-slate-200">Firestore Rules (Firebase Console → Firestore → Rules me paste karein)</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}`}</pre>
              <p className="mt-1">Development ke liye upar wala rule kaafi hai. Production me apne hisaab se secure karein.</p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
