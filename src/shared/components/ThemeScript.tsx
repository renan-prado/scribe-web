/**
 * Render-blocking theme bootstrap.
 *
 * Runs before first paint so the `.dark` class is already on <html> when the
 * document renders — no flash of the light theme. Reads the persisted choice
 * from localStorage and falls back to the OS preference.
 *
 * Keep the storage key in sync with `useTheme` (src/shared/hooks/use-theme.ts).
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem("scriba-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.setAttribute("data-theme",t);}catch(e){}})();`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored bootstrap script
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
