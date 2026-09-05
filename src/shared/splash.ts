import SCREENS from "@/shared/splash-screens.json";

/**
 * As telas de abertura do PWA no iOS.
 *
 * O Android monta o splash sozinho, com o `background_color` e o ícone do
 * manifest. **O iOS não lê nada disso**: sem um `apple-touch-startup-image`
 * cuja media query case EXATAMENTE com o aparelho, ele abre o app numa tela
 * branca vazia — que é o que o Scriba fazia. Por isso é uma imagem por
 * resolução.
 *
 * A lista de resoluções mora em `splash-screens.json` porque os arquivos PNG
 * saem dela também: `scripts/generate-splash.mjs` lê o MESMO json. Aparelho
 * novo é uma linha lá e rodar o script — as duas metades não podem divergir,
 * senão ou sobra imagem que ninguém pede, ou falta a que o iPhone procura (e
 * aí ele volta ao branco, sem avisar).
 */
export const APPLE_STARTUP_IMAGES = SCREENS.map((screen) => ({
  url: `/brand/splash/splash-${screen.w}x${screen.h}.png`,
  // `orientation: portrait` porque o manifest trava o app em retrato; sem essa
  // parte, uma media query de paisagem casaria com a imagem errada no iPad.
  media: `(device-width: ${screen.dw}px) and (device-height: ${screen.dh}px) and (-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait)`,
}));
