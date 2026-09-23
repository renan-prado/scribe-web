import { THEME_COLOR_BY_THEME } from "@/shared/theme-color";

/**
 * O tema aplicado ANTES DO PRIMEIRO PAINT, sem piscada.
 *
 * O padrão é ESCURO, e continua NÃO sendo o `prefers-color-scheme` do sistema:
 * o tema do Scriba é uma decisão de produto, não o retrato do SO. Quem nunca
 * escolheu vê escuro, na landing e na área logada; quem escolheu vê o que
 * escolheu, e a escolha persiste no localStorage.
 *
 * **O `<html>` do root layout já nasce com `class="dark"`**, e este script
 * ACRESCENTA `light` (tirando `dark`) para quem escolheu claro, em vez de
 * acrescentar `dark` para quem escolheu escuro. A inversão é o que evita a
 * piscada para a maioria: o HTML servido já é o padrão, então só a minoria
 * paga o ajuste. Com o padrão escuro e o HTML nascendo claro, TODA visita
 * começaria branca. Vale também para quem tem JS desligado, que recebe escuro.
 *
 * Ele também reescreve o `content` da `<meta name="theme-color">`, a cor da
 * barra de status do celular. A meta já vem no HTML (`viewport.themeColor` do
 * root layout, no valor escuro), então aqui não se cria tag nenhuma no caso
 * normal — só se corrige o valor de quem está no claro, e antes de a barra ser
 * pintada. Sem JS, ela fica no escuro, coerente com a classe que o `<html>`
 * trouxe.
 *
 * `document.head` pode não existir ainda dependendo de onde o script é
 * injetado, daí o `createElement` de reserva; `documentElement` sempre existe.
 *
 * A chave do localStorage tem de bater com a de `useTheme`
 * (`THEME_STORAGE_KEY`, em `src/shared/hooks/use-theme.ts`). Ela é literal aqui
 * porque este script é uma string, não um módulo: ele roda antes de qualquer
 * bundle.
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem("scriba-theme");if(t!=="light"){t="dark";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.classList.toggle("light",t==="light");r.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);}m.setAttribute("content",t==="light"?"${THEME_COLOR_BY_THEME.light}":"${THEME_COLOR_BY_THEME.dark}");}catch(e){}})();`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: script estático, escrito aqui
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
