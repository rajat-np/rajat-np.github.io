/**
 * ThemeToggle Component - Dark mode toggle button
 *
 * Copyright (c) 2018-present Rajat Soni
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information
 */

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Default to light mode
      setTheme("light");
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="w-9 h-9 p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
        <div className="w-5 h-5" />
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 shadow-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      aria-label="Toggle theme"
      aria-pressed={theme === "dark"}
      type="button"
    >
      <span className="text-xl leading-none">
        {theme === "dark" ? "☽" : "☀︎"}
      </span>
    </button>
  );
}
