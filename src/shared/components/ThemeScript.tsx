/**
 * Render-blocking theme bootstrap.
 *
 * Runs before first paint so a escolha do usuário já está aplicada quando o
 * documento renderiza — sem piscar de tema.
 *
 * O padrão é CLARO, não o `prefers-color-scheme` do sistema. O tema escuro do
 * Scriba é uma opção, não o retrato do SO: quem nunca escolheu vê a mesma
 * interface da landing page, que é onde a marca foi calibrada. O toggle
 * continua mandando e a escolha persiste.
 *
 * Keep the storage key in sync with `useTheme` (src/shared/hooks/use-theme.ts).
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem("scriba-theme");if(t!=="light"&&t!=="dark"){t="light";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.setAttribute("data-theme",t);}catch(e){}})();`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored bootstrap script
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
