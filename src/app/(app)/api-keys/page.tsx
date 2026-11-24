"use client";

import { useEffect, useState } from "react";
import { GlassCard, Spinner, useToast } from "@/components/ui";
import { KeyIcon, CopyIcon, CheckIcon, RefreshIcon, ExternalIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type Log = { id: string; url: string; statusCode: number | null; ok: boolean; createdAt: string };

export default function ApiPage() {
  const toast = useToast();
  const [apiKey, setApiKey] = useState("");
  const [webhook, setWebhook] = useState("");
  const [whitelist, setWhitelist] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [tab, setTab] = useState("PHP");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await apiJson<{ apiKey: string; webhookUrl: string; ipWhitelist: string[]; webhookLogs: Log[] }>("/api/settings/api");
      setApiKey(data.apiKey);
      setWebhook(data.webhookUrl || "");
      setWhitelist((data.ipWhitelist || []).join(", "));
      setLogs(data.webhookLogs || []);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      toast("success", "Copied");
      setTimeout(() => setCopied(""), 2000);
    });
  }

  async function regenerate() {
    setSaving(true);
    try {
      const data = await apiJson<{ apiKey: string }>("/api/settings/api", { method: "POST", body: JSON.stringify({ action: "regenerate" }) });
      setApiKey(data.apiKey);
      toast("success", "API key regenerated");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not regenerate");
    } finally { setSaving(false); }
  }

  async function saveWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiJson("/api/settings/api", { method: "POST", body: JSON.stringify({ action: "webhook", url: webhook }) });
      toast("success", "Webhook URL saved");
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not save");
    } finally { setSaving(false); }
  }

  async function saveWhitelist(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const ips = whitelist.split(",").map((s) => s.trim()).filter(Boolean);
      await apiJson("/api/settings/api", { method: "POST", body: JSON.stringify({ action: "whitelist", ips }) });
      toast("success", "IP whitelist saved");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not save");
    } finally { setSaving(false); }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://cashpe.onrender.com";
  const snippets: Record<string, string> = {
    PHP: `<?php\n$ch = curl_init("${origin}/api/v1?action=create_link");\ncurl_setopt($ch, CURLOPT_POST, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: ${apiKey}", "Content-Type: application/json"]);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["amount" => 499, "customer_name" => "Rahul", "provider_id" => "PROVIDER_ID"]));\n$response = curl_exec($ch);`,
    "Node.js": `const res = await fetch("${origin}/api/v1?action=create_link", {\n  method: "POST",\n  headers: { "X-API-Key": "${apiKey}", "Content-Type": "application/json" },\n  body: JSON.stringify({ amount: 499, customer_name: "Rahul", provider_id: "PROVIDER_ID" })\n});\nconst data = await res.json(); // { payment_url, link_id }`,
    cURL: `curl -X POST "${origin}/api/v1?action=create_link" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount":499,"customer_name":"Rahul","provider_id":"PROVIDER_ID"}'`,
    Python: `import requests\nr = requests.post("${origin}/api/v1?action=create_link",\n  headers={"X-API-Key": "${apiKey}"},\n  json={"amount": 499, "customer_name": "Rahul", "provider_id": "PROVIDER_ID"})\nprint(r.json())  # payment_url, link_id`,
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      <GlassCard className="p-5">
        <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><KeyIcon className="h-5 w-5 text-violet-500" /> API Key</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={apiKey} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm dark:border-white/10 dark:bg-white/5" />
          <div className="flex gap-2">
            <button onClick={() => copy(apiKey, "key")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-white/10">
              {copied === "key" ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <CopyIcon className="h-4 w-4" />} Copy
            </button>
            <button onClick={regenerate} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
              <RefreshIcon className="h-4 w-4" /> Regenerate
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">Rate limit: 60 requests/min per key. Send as <code className="rounded bg-slate-100 px-1 dark:bg-white/10">X-API-Key</code> header.</p>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><ExternalIcon className="h-5 w-5 text-fuchsia-500" /> Webhook</h2>
          <form onSubmit={saveWebhook} className="mt-4 space-y-3">
            <input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://your-server.com/webhook"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5" />
            <button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">Save Webhook</button>
          </form>
          {logs.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Recent deliveries</p>
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5">
                  <span className="truncate font-mono">{l.url}</span>
                  <span className={l.ok ? "font-bold text-emerald-600" : "font-bold text-rose-600"}>{l.statusCode || "failed"}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white">IP Whitelist (optional)</h2>
          <form onSubmit={saveWhitelist} className="mt-4 space-y-3">
            <input value={whitelist} onChange={(e) => setWhitelist(e.target.value)} placeholder="1.2.3.4, 5.6.7.8"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5" />
            <button type="submit" disabled={saving} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold dark:border-white/10 disabled:opacity-60">Save Whitelist</button>
          </form>
          <div className="mt-5 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <p className="font-bold text-slate-700 dark:text-slate-200">Endpoints</p>
            <p className="mt-1 font-mono">POST /api/v1?action=create_link</p>
            <p className="font-mono">GET /api/v1?action=status&amp;id=pl_xxx</p>
            <p className="font-mono">GET /api/v1?action=wallet</p>
            <p className="font-mono">GET /api/v1?action=transactions</p>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><RefreshIcon className="h-5 w-5 text-indigo-500" /> Callback System (Sab Automatic)</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">CashPe saare callbacks khud handle karta hai — koi extra setup nahi.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Google Login (Firebase Auth)</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">Firebase popup se automatic — koi callback URL set karne ki zaroorat nahi</p>
            <p className="mt-1 text-xs text-slate-400">Sirf Admin → Settings me Firebase config paste karein. Console me Google sign-in enable karein.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Payment Callback (Provider → CashPe)</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">POST {origin}/api/callback/payment</p>
            <p className="mt-1 font-mono text-xs text-slate-400">{"{ link_id, utr, status: \"success\" }"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Provider OTP / Session Callback</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">POST {origin}/api/callback/provider</p>
            <p className="mt-1 font-mono text-xs text-slate-400">X-API-Key header ke saath {"{ provider, mobile, session_token, upi_ids, selected_upi }"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Webhook (CashPe → Aapka Server)</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">{webhook || "Upar webhook URL save karein"}</p>
            <p className="mt-1 text-xs text-slate-400">Payment success par automatic POST jata hai (payment.success event).</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 p-3 dark:border-white/5">
          {Object.keys(snippets).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"}`}>
              {t}
            </button>
          ))}
          <button onClick={() => copy(snippets[tab], "code")} className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-white/10">
            {copied === "code" ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />} Copy
          </button>
        </div>
        <pre className="overflow-x-auto bg-slate-950 p-5 text-xs leading-relaxed text-emerald-300">{snippets[tab]}</pre>
        <p className="p-3 text-xs text-slate-400">Webhook payload on success: <code className="font-mono">{"{ event: \"payment.success\", link_id, amount, utr, ... }"}</code> — {logs.length ? `Last delivery ${formatDate(logs[0].createdAt)}` : "no deliveries yet"}</p>
      </GlassCard>
    </div>
  );
}
