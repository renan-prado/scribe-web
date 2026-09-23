/**
 * A cor que o SISTEMA pinta ao redor do app: a barra de status do celular no
 * PWA instalado, a barra de endereço do Chrome no Android, a moldura da janela
 * no desktop e a tela de abertura.
 *
 * **Por que estes hexadecimais existem fora do `globals.css`.** Quem lê
 * `<meta name="theme-color">` é o navegador, antes de aplicar qualquer CSS, e
 * o manifest é JSON: nenhum dos dois enxerga um `var(--v2-bg)`. Não há como
 * derivar um do outro, então este arquivo é o ÚNICO lugar onde a cor pode
 * estar duplicada. **Mudou `--v2-bg` em `app/globals.css`? Mude aqui no mesmo
 * commit.**
 *
 * ## Por que são dois valores, e por que um deles ainda é constante
 *
 * O produto voltou a ter dois temas, então a barra de status tem duas cores —
 * `THEME_COLOR_BY_THEME` é o par, e quem o escreve na `<meta>` é o
 * `ThemeScript` (antes do primeiro paint) e o `useTheme` (a cada troca). Um
 * `media="(prefers-color-scheme: …)"` não serviria: o tema do Scriba é uma
 * escolha guardada no localStorage, não o retrato do sistema operacional.
 *
 * `THEME_COLOR` sozinho continua existindo e continua sendo o ESCURO, porque
 * os dois lugares que o consomem não têm como perguntar nada a ninguém: o
 * `manifest.ts` é JSON servido antes de a página existir, e as telas de
 * abertura são PNGs gerados em build (`src/scripts/generate-splash.mjs`). Os
 * dois desenham o instante ANTERIOR ao primeiro paint, quando ainda não há
 * documento para ler o localStorage — e o padrão do produto é o escuro.
 */
export const THEME_COLOR = "#212121";

/** O chão de cada tema: `--v2-bg` em `globals.css`, copiado aqui. */
export const THEME_COLOR_BY_THEME = {
  dark: THEME_COLOR,
  light: "#FFFFFF",
} as const;
