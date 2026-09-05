"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_COLOR } from "@/shared/theme-color";

export type Theme = "light" | "dark";

const STORAGE_KEY = "scriba-theme";
/** Fired on every theme change so multiple toggles on a page stay in sync. */
const CHANGE_EVENT = "scriba-theme-change";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * A barra de status do celular no PWA instalado (e a barra de endereço do
 * Chrome no Android) segue esta meta. Sem esta linha o tema virava e a barra
 * ficava com a cor do tema anterior até o próximo carregamento — que é
 * justamente o que mais salta aos olhos num app instalado. O `ThemeScript`
 * cria a meta antes do primeiro paint; o `createElement` aqui é só para o caso
 * de alguém remover aquele bootstrap.
 */
function applyThemeColorMeta(theme: Theme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[theme];
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  applyThemeColorMeta(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / storage disabled — the in-memory class still applies
  }
  window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: theme }));
}

/**
 * Reads and writes the `.dark` class on <html>.
 *
 * `mounted` is false on the server and on the very first client render — use it
 * to suppress transitions so the control snaps to the real state instead of
 * animating from a wrong default.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);

    const onChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      setThemeState(next === "dark" ? "dark" : "light");
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  // Reads the live DOM instead of the updater's `current` — a state updater must
  // stay pure, and applyTheme dispatches an event that re-renders other
  // subscribers (the Toaster) synchronously.
  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme, toggleTheme, mounted, isDark: theme === "dark" };
}
