import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "../ui/button";

export function toggleAppTheme(): boolean {
  if (typeof window === "undefined") return false;
  const isCurrentlyDark = document.documentElement.classList.contains("dark");
  const nextDark = !isCurrentlyDark;
  if (nextDark) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
  window.dispatchEvent(new CustomEvent("nexusops-theme-toggle", { detail: { isDark: nextDark } }));
  return nextDark;
}

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    const handleThemeToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.isDark === "boolean") {
        setIsDark(customEvent.detail.isDark);
      } else {
        setIsDark((prev) => !prev);
      }
    };
    window.addEventListener("nexusops-theme-toggle", handleThemeToggle);
    return () => window.removeEventListener("nexusops-theme-toggle", handleThemeToggle);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark((prev) => !prev)}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600 transition-transform" />
      )}
    </Button>
  );
};
