"use client";

import { useEffect, useState } from "react";
import { GlassCard, Spinner, EmptyState, useToast } from "@/components/ui";
import { CardIcon, TrashIcon, LockIcon, CheckIcon, PhoneIcon, ShieldIcon, XIcon, ClockIcon, RefreshIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { BUSINESS_PROVIDERS, PERSONAL_PROVIDERS, type ProviderDef } from "@/lib/providers";
import { formatINR, formatDate } from "@/lib/utils";

type ProviderRow = {
  id: string; provider: string; type: string; upiId: string | null; mobile: string | null;
  selectedUpi: string | null; upiIds: string[] | null; status: string; createdAt: string;
};
type HistoryItem = { utr: string; amountPaise: number; counterparty: string; date: string; status: string };
type Step = "select" | "business" | "mobile" | "password" | "otp" | "upi";

export default function ConnectPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProviderDef | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [upiId, setUpiId] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [upiIds, setUpiIds] = useState<string[]>([]);
  const [selectedUpi, setSelectedUpi] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiJson<{ providers: ProviderRow[] }>("/api/providers");
      setProviders(data.providers);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const locked = providers.length >= 3;

  function reset() {
    setUpiId(""); setMobile(""); setPassword(""); setOtp(""); setChallengeId(""); setDemoOtp("");
    setUpiIds([]); setSelectedUpi(""); setHistory([]); setAuthMode("password");
  }

  function pick(def: ProviderDef) {
    if (locked) { toast("error", "Maximum 3 providers allowed. Delete one first."); return; }
    reset();
    setSelected(def);
    setStep(def.type === "business" ? "business" : "mobile");
  }

  async function saveBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await apiJson("/api/providers", { method: "POST", body: JSON.stringify({ action: "business", provider: selected.id, upiId }) });
      toast("success", "Business provider connected successfully.");
      setStep("select"); setSelected(null); load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not save provider");
    } finally { setSaving(false); }
  }

  // Step 1: mobile → provider callback decides PIN or OTP
  async function startPersonal(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const data = await apiJson<{ challengeId: string; authMethod: "password" | "otp"; demoOtp?: string; message: string }>(
        "/api/providers",
        { method: "POST", body: JSON.stringify({ action: "personal_start", provider: selected.id, mobile }) }
      );
      setChallengeId(data.challengeId);
      setAuthMode(data.authMethod);
      if (data.authMethod === "otp") {
        setDemoOtp(data.demoOtp || "");
        setStep("otp");
        toast("success", data.message);
      } else {
        setStep("password");
        toast("info", data.message);
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not start verification");
    } finally { setSaving(false); }
  }

  function afterVerify(data: { upiIds: string[]; history: HistoryItem[] }) {
    setUpiIds(data.upiIds);
    setHistory(data.history || []);
    setSelectedUpi(data.upiIds[0] || "");
    setStep("upi");
    toast("success", "Verified. Ab UPI ID select karein jis par payment lena hai.");
  }

  // Step 2a: verify PIN — wrong PIN → error, then user can Forgot → OTP
  async function verifyPassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiJson<{ upiIds: string[]; history: HistoryItem[] }>(
        "/api/providers",
        { method: "POST", body: JSON.stringify({ action: "personal_verify", challengeId, password }) }
      );
      afterVerify(data);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Verification failed");
    } finally { setSaving(false); }
  }

  // Step 2b: forgot PIN → OTP
  async function forgotPin() {
    setSaving(true);
    try {
      const data = await apiJson<{ demoOtp: string; message: string }>(
        "/api/providers",
        { method: "POST", body: JSON.stringify({ action: "personal_forgot", challengeId }) }
      );
      setAuthMode("otp");
      setDemoOtp(data.demoOtp);
      setStep("otp");
      toast("success", data.message);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not send OTP");
    } finally { setSaving(false); }
  }

  // Step 2c: verify OTP
  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiJson<{ upiIds: string[]; history: HistoryItem[] }>(
        "/api/providers",
        { method: "POST", body: JSON.stringify({ action: "personal_verify_otp", challengeId, otp }) }
      );
      afterVerify(data);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "OTP verification failed");
    } finally { setSaving(false); }
  }

  // Step 3: select UPI ID → save provider
  async function savePersonal() {
    if (!selectedUpi) { toast("error", "Select a UPI ID to receive payments"); return; }
    setSaving(true);
    try {
      await apiJson("/api/providers", {
        method: "POST",
        body: JSON.stringify({ action: "personal_save", challengeId, mode: authMode, password, otp, selectedUpi }),
      });
      toast("success", `${selected?.name} connected successfully.`);
      setStep("select"); setSelected(null); load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not save provider");
    } finally { setSaving(false); }
  }

  async function doDelete() {
    if (!deleteId) return;
    try {
      await apiJson(`/api/providers/${deleteId}`, { method: "DELETE" });
      toast("success", "Provider deleted.");
      setDeleteId(null); load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not delete");
    }
  }

  function ProviderRowItem({ def }: { def: ProviderDef }) {
    return (
      <button onClick={() => pick(def)} disabled={locked}
        className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition ${locked ? "cursor-not-allowed border-slate-100 opacity-50 dark:border-white/5" : "border-slate-100 hover:border-violet-300 hover:bg-violet-50/50 dark:border-white/5 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/5"}`}>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${def.color} text-sm font-extrabold text-white shadow`}>{def.letter}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-slate-900 dark:text-white">{def.name}</span>
          <span className="block text-xs text-slate-400">{def.type === "business" ? "Connect with UPI ID / VPA" : "Mobile + PIN/OTP login"}</span>
        </span>
        {locked ? <LockIcon className="h-5 w-5 shrink-0 text-slate-400" /> : <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{def.tag}</span>}
      </button>
    );
  }

  function StepHeader({ title }: { title: string }) {
    return (
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
        <button onClick={() => { setStep("select"); setSelected(null); reset(); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close">
          <XIcon className="h-5 w-5" />
        </button>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      <GlassCard className="p-5">
        <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><CardIcon className="h-5 w-5 text-violet-500" /> Connected Providers ({providers.length}/3)</h2>
        {providers.length === 0 ? (
          <EmptyState title="No providers connected" subtitle="Select a provider below to start receiving payments." />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-100 p-4 dark:border-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold capitalize text-slate-900 dark:text-white">{p.provider.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-400">{p.type} · {formatDate(p.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold capitalize text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{p.status}</span>
                </div>
                <p className="mt-2 truncate rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200">{p.selectedUpi || p.upiId || p.mobile}</p>
                <button onClick={() => setDeleteId(p.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
                  <TrashIcon className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {step === "select" && (
        <GlassCard className="p-5">
          <h2 className="font-bold text-slate-900 dark:text-white">Select Provider</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Business Providers</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {BUSINESS_PROVIDERS.map((d) => <ProviderRowItem key={d.id} def={d} />)}
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">Personal Providers</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PERSONAL_PROVIDERS.map((d) => <ProviderRowItem key={d.id} def={d} />)}
          </div>
          {locked && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <LockIcon className="h-4 w-4 shrink-0" /> Maximum 3 providers reached. Delete a provider to add another.
            </p>
          )}
        </GlassCard>
      )}

      {step === "business" && selected && (
        <GlassCard className="mx-auto max-w-lg p-6 animate-pop-in">
          <StepHeader title={`Connect ${selected.name}`} />
          <form onSubmit={saveBusiness} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">UPI ID / VPA</span>
              <input required value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="e.g. yourname@okhdfcbank"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
            </label>
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Spinner /> : <><CheckIcon className="h-4 w-4" /> Save Provider</>}
            </button>
          </form>
        </GlassCard>
      )}

      {step === "mobile" && selected && (
        <GlassCard className="mx-auto max-w-lg p-6 animate-pop-in">
          <StepHeader title={`Connect ${selected.name}`} />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enter the mobile number linked to your {selected.name} account.</p>
          <form onSubmit={startPersonal} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Mobile Number</span>
              <span className="relative block">
                <PhoneIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                <input required inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
              </span>
            </label>
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Spinner /> : "Next"}
            </button>
          </form>
        </GlassCard>
      )}

      {step === "password" && selected && (
        <GlassCard className="mx-auto max-w-lg p-6 animate-pop-in">
          <StepHeader title={`${selected.name} — Login PIN`} />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <strong className="text-slate-800 dark:text-slate-100">{mobile}</strong> par registered {selected.name} account ka login PIN (4–6 digits) dalein.
          </p>
          <form onSubmit={verifyPassword} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">UPI App PIN / Password</span>
              <span className="relative block">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                <input required type="password" inputMode="numeric" maxLength={6} value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))} placeholder="4-6 digit PIN"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
              </span>
            </label>
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Spinner /> : <><ShieldIcon className="h-4 w-4" /> Verify</>}
            </button>
            <button type="button" onClick={forgotPin} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 disabled:opacity-60">
              <RefreshIcon className="h-4 w-4" /> Forgot PIN? Verify with OTP
            </button>
          </form>
        </GlassCard>
      )}

      {step === "otp" && selected && (
        <GlassCard className="mx-auto max-w-lg p-6 animate-pop-in">
          <StepHeader title={`${selected.name} — Enter OTP`} />
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <ShieldIcon className="h-4 w-4 text-violet-500" /> OTP sent to <strong className="text-slate-800 dark:text-slate-100">{mobile}</strong>
          </p>
          {demoOtp && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-500/10">
              <ClockIcon className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="text-indigo-800 dark:text-indigo-200">Provider SMS simulation — OTP: <strong className="text-lg tracking-widest">{demoOtp}</strong></span>
            </div>
          )}
          <form onSubmit={verifyOtp} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">6-digit OTP</span>
              <input required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
            </label>
            <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Spinner /> : "Verify OTP"}
            </button>
            <button type="button" onClick={forgotPin} disabled={saving} className="w-full text-center text-xs font-bold text-violet-600 hover:underline dark:text-violet-400">
              Resend OTP
            </button>
          </form>
        </GlassCard>
      )}

      {step === "upi" && selected && (
        <GlassCard className="mx-auto max-w-lg p-6 animate-pop-in">
          <StepHeader title="Select UPI ID" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Kis UPI ID par payments receive karni hain? Ek select karein.</p>
          <div className="mt-4 space-y-2">
            {upiIds.map((u) => (
              <button key={u} onClick={() => setSelectedUpi(u)}
                className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-sm font-semibold transition ${selectedUpi === u ? "border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10" : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"}`}>
                {u}
                {selectedUpi === u && <CheckIcon className="h-5 w-5 text-violet-600" />}
              </button>
            ))}
          </div>
          <button onClick={savePersonal} disabled={saving || !selectedUpi} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <Spinner /> : "Save Provider"}
          </button>
          {history.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Provider Payment History (last {history.length})</h3>
              <div className="mt-2 space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{formatINR(h.amountPaise)} — {h.counterparty}</p>
                      <p className="text-xs text-slate-400">{h.utr} · {formatDate(h.date)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold capitalize text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{h.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-pop-in dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15"><TrashIcon className="h-6 w-6" /></div>
            <h3 className="mt-3 font-bold text-slate-900 dark:text-white">Delete provider?</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This will disconnect the provider. Existing payment links remain in history.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold dark:border-white/10">Cancel</button>
              <button onClick={doDelete} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
