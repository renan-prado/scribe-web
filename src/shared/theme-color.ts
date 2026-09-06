/**
 * A cor que o SISTEMA pinta ao redor do app: a barra de status do celular no
 * PWA instalado, a barra de endereço do Chrome no Android e a moldura da
 * janela no desktop.
 *
 * **Por que estes hexadecimais existem fora do `globals.css`.** Quem lê
 * `<meta name="theme-color">` é o navegador, antes de aplicar qualquer CSS, e
 * o manifest é JSON — nenhum dos dois enxerga um `var(--scriba-surface)`. Não
 * há como derivar um do outro, então este arquivo é o ÚNICO lugar onde a cor
 * pode estar duplicada, e os três consumidores importam daqui:
 *
 * - `ThemeScript` — escreve a meta antes do primeiro paint;
 * - `useTheme` — reescreve a meta quando o usuário troca de tema;
 * - `app/manifest.ts` — o `theme_color`, que é o fallback de quem abre o app
 *   sem JS e a cor da tela de splash na instalação.
 *
 * Os valores espelham `--scriba-surface` em `:root` e em `.dark`: é a
 * superfície que fica logo abaixo da barra nas telas de lista (`/feed`,
 * `/list`, `/studies`), onde o encontro entre as duas é visível. **Se o token
 * mudar em `app/globals.css`, mude aqui no mesmo commit.**
 */
export const THEME_COLOR = {
  light: "#F7FAFD",
  dark: "#0B0A19",
} as const;
