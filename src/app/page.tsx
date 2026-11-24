"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Logo, GlassCard, Spinner, useToast } from "@/components/ui";
import { ThemeToggle } from "@/components/Topbar";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, ShieldIcon, ZapIcon, WalletIcon, LinkIcon, CheckIcon, AlertIcon, RefreshIcon } from "@/components/icons";
import { apiFetch } from "@/lib/client";
import { signInWithGoogleFirebase } from "@/lib/firebase-client";

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/csrf").catch(() => {});
    apiFetch("/api/me").then((r) => { if (r.ok) router.push("/dashboard"); }).catch(() => {});
  }, [router]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setUnverified(false);
    try {
      const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) {
        if (data.unverified) setUnverified(true);
        throw new Error(data.error || "Login failed");
      }
      toast("success", "Welcome back. Redirecting to dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      const res = await apiFetch("/api/auth/resend", { method: "POST", body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not resend");
      toast("success", "Verification email sent. Check your inbox.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not resend");
    } finally {
      setResending(false);
    }
  }

  async function googleLogin() {
    setGoogleLoading(true);
    setGoogleError("");
    try {
      const result = await signInWithGoogleFirebase();
      if ("error" in result) { setGoogleError(result.error); return; }
      const res = await apiFetch("/api/auth/firebase", { method: "POST", body: JSON.stringify({ idToken: result.idToken }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google sign-in failed");
      toast("success", "Welcome. Redirecting to dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_55%)]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-6 w-6"><path d="M7 12h6M10 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">CashPe</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/register" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25">Create account</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:items-center lg:pt-14">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <ZapIcon className="h-3.5 w-3.5" /> UPI Payment Gateway — Live
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Receive Payments.
            <br />
            <span className="text-white/85">Anytime. Anywhere.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
            Connect PhonePe, Paytm, Google Pay and BharatPe. Create UPI payment links in seconds, track every rupee and pay only 2% commission.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {[
              { Icon: ZapIcon, title: "Instant links", sub: "QR + UPI deep link" },
              { Icon: WalletIcon, title: "Smart wallet", sub: "2% commission only" },
              { Icon: ShieldIcon, title: "Secure", sub: "OTP + encryption" },
            ].map(({ Icon, title, sub }) => (
              <div key={title} className="rounded-2xl border border-white/20 bg-white/10 p-3.5 backdrop-blur">
                <Icon className="h-5 w-5 text-white" />
                <p className="mt-2 text-sm font-bold text-white">{title}</p>
                <p className="text-xs text-white/70">{sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75">
            {["No setup fee", "Max 3 providers", "API + Webhooks"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><CheckIcon className="h-4 w-4" /> {t}</span>
            ))}
          </div>
        </div>

        <GlassCard className="animate-fade-up p-6 sm:p-8" >
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Login to your CashPe dashboard</p>

          {googleError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {googleError}
            </div>
          )}

          <button
            onClick={googleLogin}
            disabled={googleLoading}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          >
            {googleLoading && <Spinner className="h-4 w-4" />}
            <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z"/></svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <span className="text-xs font-medium text-slate-400">or login with email</span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <form onSubmit={login} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
              <span className="relative block">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</span>
              <span className="relative block">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </span>
            </label>

            {unverified && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> Email not verified. Verify to login.
                </p>
                <button type="button" onClick={resend} disabled={resending} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-60">
                  {resending ? <Spinner className="h-3.5 w-3.5" /> : <RefreshIcon className="h-3.5 w-3.5" />} Resend verification
                </button>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? <Spinner /> : <><LockIcon className="h-4 w-4" /> Login</>}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
            New to CashPe?{" "}
            <Link href="/register" className="font-bold text-violet-600 hover:underline dark:text-violet-400">Create an account</Link>
          </p>
        </GlassCard>
      </main>

      <footer className="relative z-10 pb-6 text-center text-xs text-white/60">
        CashPe UPI Payment Gateway — Secure. Fast. Reliable.
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>}>
      <LoginInner />
    </Suspense>
  );
}
