"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard, Spinner, useToast } from "@/components/ui";
import { SendIcon, PaperclipIcon, HeadsetIcon } from "@/components/icons";
import { apiJson } from "@/lib/client";
import { formatDate } from "@/lib/utils";

type Msg = { id: string; senderRole: string; body: string; imageBase64: string | null; createdAt: string };

export default function SupportPage() {
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await apiJson<{ messages: Msg[] }>("/api/support");
      setMessages(data.messages);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !preview) return;
    setSending(true);
    try {
      await apiJson("/api/support", { method: "POST", body: JSON.stringify({ body: text, imageBase64: preview || undefined }) });
      setText(""); setPreview("");
      load();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Could not send");
    } finally { setSending(false); }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("error", "Only image files allowed"); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-violet-500" /></div>;

  return (
    <div className="animate-fade-up">
      <GlassCard className="flex h-[calc(100vh-180px)] min-h-[480px] flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-white/5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white"><HeadsetIcon className="h-5 w-5" /></span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">CashPe Support</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Online — replies within a few minutes</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 dark:bg-white/[0.02]">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-indigo-500"><HeadsetIcon className="h-7 w-7" /></span>
              <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">Hi there. How can we help?</p>
              <p className="mt-1 max-w-xs text-sm text-slate-400">Send a message and our team will reply here. You can also attach a screenshot.</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === "user";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? "rounded-br-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white" : "rounded-bl-md bg-white text-slate-800 dark:bg-white/10 dark:text-slate-100"}`}>
                    {m.imageBase64 && <img src={m.imageBase64} alt="attachment" className="mb-2 max-h-48 rounded-xl" />}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>{formatDate(m.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {preview && (
          <div className="flex items-center gap-3 border-t border-slate-100 p-3 dark:border-white/5">
            <img src={preview} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
            <span className="flex-1 text-xs text-slate-400">Image attached</span>
            <button onClick={() => setPreview("")} className="text-xs font-bold text-rose-600">Remove</button>
          </div>
        )}

        <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-white/5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach image" className="rounded-xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10">
            <PaperclipIcon className="h-5 w-5" />
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..."
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5" />
          <button type="submit" disabled={sending || (!text.trim() && !preview)} aria-label="Send message"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {sending ? <Spinner /> : <><SendIcon className="h-4 w-4" /><span className="hidden sm:inline">Send</span></>}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
