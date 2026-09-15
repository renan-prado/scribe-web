/**
 * A cor que o SISTEMA pinta ao redor do app: a barra de status do celular no
 * PWA instalado, a barra de endereço do Chrome no Android, a moldura da janela
 * no desktop e a tela de abertura.
 *
 * **Por que este hexadecimal existe fora do `globals.css`.** Quem lê
 * `<meta name="theme-color">` é o navegador, antes de aplicar qualquer CSS, e
 * o manifest é JSON: nenhum dos dois enxerga um `var(--v2-bg)`. Não há como
 * derivar um do outro, então este arquivo é o ÚNICO lugar onde a cor pode
 * estar duplicada. **Mudou `--v2-bg` em `app/globals.css`? Mude aqui no mesmo
 * commit.**
 *
 * **Era um par, `light` e `dark`, e um terceiro valor só para o app.** Isso
 * exigia três mecanismos para manter a barra certa: um script inline no
 * `<head>` lendo o localStorage antes do primeiro paint, um efeito de cliente
 * refazendo a conta dentro da área logada, e o `useTheme` reescrevendo a meta
 * a cada troca. Com um tema só no produto inteiro, o valor é constante, e
 * constante se declara: a `<meta>` sai do `viewport` do root layout, estática,
 * e os três mecanismos deixaram de existir.
 */
export const THEME_COLOR = "#212121";
