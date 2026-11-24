"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { GlassCard, Spinner, Logo } from "@/components/ui";
import { CheckCircleIcon, XCircleIcon } from "@/components/icons";
import { apiFetch } from "@/lib/client";

function VerifyInner() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("Verifying your email...");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMsg("No verification token found in link.");
      return;
    }
    apiFetch("/api/csrf").then(() =>
      apiFetch("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
    ).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setState("ok");
      setMsg("Email verified successfully. Redirecting to dashboard...");
      setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1600);
    }).catch((e) => {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Verification failed");
    });
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5">
      <GlassCard className="w-full max-w-md animate-pop-in p-8 text-center">
        <div className="flex justify-center"><Logo size={48} /></div>
        {state === "loading" && (
          <>
            <div className="mt-5 flex justify-center"><Spinner className="h-10 w-10 text-violet-500" /></div>
            <p className="mt-4 font-semibold text-slate-800 dark:text-slate-100">{msg}</p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="mt-5 flex justify-center text-emerald-500"><CheckCircleIcon className="h-14 w-14" /></div>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">Email Verified</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{msg}</p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="mt-5 flex justify-center text-rose-500"><XCircleIcon className="h-14 w-14" /></div>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">Verification Failed</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{msg}</p>
            <Link href="/" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white">Back to Login</Link>
          </>
        )}
      </GlassCard>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>}>
      <VerifyInner />
    </Suspense>
  );
}
