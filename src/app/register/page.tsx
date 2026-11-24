"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo, GlassCard, Spinner, useToast } from "@/components/ui";
import { ThemeToggle } from "@/components/Topbar";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, CheckIcon } from "@/components/icons";
import { apiFetch } from "@/lib/client";
import { signInWithGoogleFirebase } from "@/lib/firebase-client";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { apiFetch("/api/csrf").catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      if (data.autoLogin) {
        toast("success", "Account created. Welcome to CashPe!");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setDone(true);
      toast("success", "Account created. Please verify your email.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function googleSignup() {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogleFirebase();
      if ("error" in result) { toast("error", result.error); return; }
      const res = await apiFetch("/api/auth/firebase", { method: "POST", body: JSON.stringify({ idToken: result.idToken }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google sign-in failed");
      toast("success", "Welcome to CashPe!");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/25 blur-3xl" />
      </div>
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-6 w-6"><path d="M7 12h6M10 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">CashPe</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto flex max-w-md px-5 pb-16 pt-4">
        <GlassCard className="w-full animate-fade-up p-6 sm:p-8">
          {!done ? (
            <>
              <div className="flex items-center gap-3">
                <Logo />
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Create account</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Start receiving UPI payments today</p>
                </div>
              </div>

              <button
                onClick={googleSignup}
                disabled={googleLoading}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
              >
                {googleLoading && <Spinner className="h-4 w-4" />}
                <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z"/></svg>
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                <span className="text-xs font-medium text-slate-400">or register with email</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name</span>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
                  <span className="relative block">
                    <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</span>
                  <span className="relative block">
                    <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                    <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, 1 letter, 1 number"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </span>
                </label>
                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:opacity-95 disabled:opacity-60">
                  {loading ? <Spinner /> : "Register with Email"}
                </button>
              </form>
              <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
                Already have an account? <Link href="/" className="font-bold text-violet-600 hover:underline dark:text-violet-400">Login</Link>
              </p>
            </>
          ) : (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
                <CheckIcon className="h-8 w-8" />
              </span>
              <h1 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">Check your email</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                We sent a verification link to <strong className="text-slate-800 dark:text-slate-100">{email}</strong>. It expires in 15 minutes and can be used once.
              </p>
              <Link href="/" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white">Back to Login</Link>
            </div>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
