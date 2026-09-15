/**
 * A cor que o SISTEMA pinta ao redor do app: a barra de status do celular no
 * PWA instalado, a barra de endereço do Chrome no Android e a moldura da
 * janela no desktop.
 *
 * **Por que estes hexadecimais existem fora do `globals.css`.** Quem lê
 * `<meta name="theme-color">` é o navegador, antes de aplicar qualquer CSS, e
 * o manifest é JSON, nenhum dos dois enxerga um `var(--scriba-surface)`. Não
 * há como derivar um do outro, então este arquivo é o ÚNICO lugar onde a cor
 * pode estar duplicada, e os três consumidores importam daqui:
 *
 * - `ThemeScript`: escreve a meta antes do primeiro paint;
 * - `useTheme`: reescreve a meta quando o usuário troca de tema;
 * - `app/manifest.ts`: o `theme_color`, que é o fallback de quem abre o app
 *   sem JS e a cor da tela de splash na instalação.
 *
 * `light` e `dark` espelham `--scriba-surface` em `:root` e em `.dark`, e são
 * a cor do SITE: landing, páginas legais, a tela de entrada.
 *
 * **`app` não tem par claro, e é de propósito.** A área logada tem UM tema (a
 * classe `dark` é fixa no `(app)/layout.tsx`), então a barra do sistema ali
 * não acompanha o toggle: ela é sempre o grafite da página. Enquanto ela seguia
 * o tema, quem tinha escolhido claro via uma barra de status BRANCA colada num
 * app grafite, e quem estava no escuro via o #111111 do site encostado no
 * #212121 do app, perto o bastante para parecer defeito e longe o bastante para
 * se ver. Quem aplica é o `AppThemeColor`, montado pela moldura do app.
 *
 * **Se o token mudar em `app/globals.css`, mude aqui no mesmo commit** — vale
 * para os três: `--scriba-surface` nos dois temas e `--v2-bg` no `app`.
 */
export const THEME_COLOR = {
  light: "#FAFAFA",
  dark: "#111111",
  /** `--v2-bg`, o chão grafite da área logada. */
  app: "#212121",
} as const;
