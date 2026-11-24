"use client";

import { use, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Logo, Spinner } from "@/components/ui";
import { CheckCircleIcon, XCircleIcon, ClockIcon, QrIcon, ExternalIcon, ShieldIcon, RefreshIcon } from "@/components/icons";
import { formatINR } from "@/lib/utils";

type LinkData = {
  linkId: string; amountPaise: number; customerName: string; upiId: string;
  status: string; utr: string | null; createdAt: string; note: string | null;
};

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [link, setLink] = useState<LinkData | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [utr, setUtr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [polling, setPolling] = useState(true);
  const idRef = useRef(id);
  idRef.current = id;

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/pay/${idRef.current}/status`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Link not found"); setPolling(false); return null; }
      return data;
    } catch { return null; }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchStatus();
      if (cancelled || !data) return;
      if (data.status === "success" || data.status === "expired") setPolling(false);
      // Fetch full link details via status + we need merchant info: use links public fetch
      try {
        const res = await fetch(`/api/pay/${idRef.current}/details`);
        if (res.ok) {
          const d = await res.json();
          setLink(d.link);
          const upi = `upi://pay?pa=${encodeURIComponent(d.link.upiId)}&pn=${encodeURIComponent("CashPe Merchant")}&am=${(d.link.amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(d.link.note || d.link.linkId)}`;
          const url = await QRCode.toDataURL(upi, { width: 260, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } });
          setQr(url);
        }
      } catch { /* ignore */ }
    })();
    const interval = setInterval(async () => {
      const data = await fetchStatus();
      if (data && (data.status === "success" || data.status === "expired")) {
        setPolling(false);
        setLink((l) => (l ? { ...l, status: data.status, utr: data.utr } : l));
      }
    }, 3000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmPayment() {
    setVerifying(true);
    try {
      const res = await fetch(`/api/pay/${idRef.current}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setPolling(false);
      setLink((l) => (l ? { ...l, status: "success", utr: data.utr } : l));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally { setVerifying(false); }
  }

  if (error && !link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5">
        <div className="w-full max-w-md rounded-3xl bg-white/90 p-8 text-center shadow-2xl backdrop-blur-xl dark:bg-slate-900/90">
          <div className="flex justify-center text-rose-500"><XCircleIcon className="h-14 w-14" /></div>
          <h1 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">Link Not Found</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
        <Spinner className="h-10 w-10 text-white" />
      </div>
    );
  }

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(link.upiId)}&pn=${encodeURIComponent("CashPe Merchant")}&am=${(link.amountPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(link.note || link.linkId)}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/25 blur-3xl" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600 shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-6 w-6"><path d="M7 12h6M10 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">CashPe</span>
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur"><ShieldIcon className="h-3 w-3" /> Secure UPI</span>
        </div>

        <div className="w-full animate-pop-in rounded-3xl border border-white/30 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:bg-slate-900/90">
          {link.status === "success" ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-10 w-10"><path className="check-path" d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">Payment Successful</h1>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">{formatINR(link.amountPaise)}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">UTR: <strong className="text-slate-800 dark:text-slate-100">{link.utr}</strong></p>
              <p className="mt-1 text-xs text-slate-400">Paid to {link.upiId}</p>
            </div>
          ) : link.status === "expired" ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10"><ClockIcon className="h-10 w-10" /></span>
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">Link Expired</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This payment link expired after 30 minutes. Please ask the merchant for a new link.</p>
            </div>
          ) : (
            <>
              <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">Pay to CashPe Merchant</p>
              <p className="mt-1 text-center text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">{formatINR(link.amountPaise)}</p>
              <p className="mt-1 text-center text-xs text-slate-400">For: {link.customerName}{link.note ? ` · ${link.note}` : ""}</p>

              <div className="mx-auto mt-5 w-fit rounded-2xl border border-slate-100 bg-white p-3 shadow-inner dark:border-white/10">
                {qr ? <img src={qr} alt="UPI QR Code" className="h-[220px] w-[220px]" /> : <div className="flex h-[220px] w-[220px] items-center justify-center"><Spinner className="h-8 w-8 text-violet-500" /></div>}
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400"><QrIcon className="h-3.5 w-3.5" /> Scan with any UPI app</p>

              <a href={upiDeepLink} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:opacity-95">
                <ExternalIcon className="h-4 w-4" /> Open UPI App
              </a>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                <span className="text-xs text-slate-400">Already paid?</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Enter UTR / Reference No.</span>
                <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 123456789012"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5" />
              </label>
              <button onClick={confirmPayment} disabled={verifying}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                {verifying ? <Spinner /> : <><CheckCircleIcon className="h-4 w-4" /> Verify Payment</>}
              </button>
              <button onClick={confirmPayment} disabled={verifying}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                <RefreshIcon className="h-4 w-4" /> Demo: Simulate Payment Received
              </button>

              {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-center text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

              {polling && (
                <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                  Waiting for payment... auto-checking every 3 seconds
                </p>
              )}
            </>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-white/60">Powered by CashPe — Receive Payments. Anytime. Anywhere.</p>
      </div>
    </div>
  );
}
