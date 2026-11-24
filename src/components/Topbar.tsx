"use client";

import { useEffect, useState } from "react";
import { MenuIcon, SunIcon, MoonIcon } from "./icons";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("cashpe-theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("cashpe-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-xl border border-slate-200 bg-white/70 p-2.5 text-slate-600 backdrop-blur transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
    >
      {dark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

export default function Topbar({ title, onMenu }: { title: string; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} aria-label="Open menu" className="rounded-xl border border-slate-200 bg-white/70 p-2.5 text-slate-600 lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <MenuIcon className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex dark:bg-emerald-500/15 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          UPI Live
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
