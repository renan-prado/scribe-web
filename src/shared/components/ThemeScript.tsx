import { THEME_COLOR } from "@/shared/theme-color";

/**
 * Render-blocking theme bootstrap.
 *
 * Runs before first paint so a escolha do usuário já está aplicada quando o
 * documento renderiza, sem piscar de tema.
 *
 * O padrão é ESCURO, e continua NÃO sendo o `prefers-color-scheme` do
 * sistema: o tema do Scriba é uma decisão de produto, não o retrato do SO.
 * Quem nunca escolheu vê escuro, na landing e na área logada, que agora é
 * onde a marca está calibrada. O toggle continua mandando e a escolha persiste.
 *
 * **O `<html>` do root layout já nasce com `class="dark"`**, e este script
 * REMOVE a classe de quem escolheu claro, em vez de adicioná-la a quem
 * escolheu escuro. A inversão é o que evita a piscada para a maioria: enquanto
 * o padrão era claro, o HTML servido já era o padrão e só a minoria via o
 * ajuste; com o padrão escuro e o HTML nascendo claro, TODA visita começaria
 * branca. Vale também para quem tem JS desligado, que agora recebe escuro.
 *
 * Ele também escreve a `<meta name="theme-color">`, a cor da barra de status
 * do celular. Ela NÃO pode ser declarada em `metadata`/`viewport` do Next:
 * seria uma tag estática, e o tema daqui não vem do `prefers-color-scheme`
 * (que a meta sabe expressar por `media`) e sim do localStorage. Escrevendo-a
 * aqui existe uma única meta na página, sempre coerente com a classe `.dark`
 * que a linha acima acabou de aplicar. Sem JS não há meta e o navegador cai no
 * `theme_color` do manifest, que é o valor escuro.
 *
 * Keep the storage key in sync with `useTheme` (src/shared/hooks/use-theme.ts).
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem("scriba-theme");if(t!=="light"&&t!=="dark"){t="dark";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",t==="dark"?"${THEME_COLOR.dark}":"${THEME_COLOR.light}");}catch(e){}})();`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored bootstrap script
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
