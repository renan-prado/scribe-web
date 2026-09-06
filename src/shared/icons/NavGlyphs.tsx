/**
 * Os glifos das quatro ABAS da barra inferior do celular (`MobileBottomNav`).
 * O microfone do botão central NÃO está aqui: ele é o `Mic` do lucide, e o
 * porquê está no cabeçalho da barra. Existe um `public/icons/recording.svg`
 * para ele, sem componente correspondente de propósito.
 *
 * São PREENCHIDOS, não traçados — não têm `stroke`, e por isso `strokeWidth`
 * não faz nada aqui. Quem vier do lucide vai estranhar: lá o peso se ajusta
 * pela espessura do traço; aqui o desenho é sólido e o único controle é o
 * tamanho.
 *
 * **Todos pintam com `currentColor`**, o que é a razão de existirem como
 * componente em vez de `<img src="/icons/feed.svg">`: um `<img>` não herda cor
 * nenhuma, e a barra precisa que o ícone acompanhe o estado ativo do item.
 * Nenhum deles recebe classe de cor própria — a cor desce do `text-*` do
 * `<TabLink>` que os envolve. Não acrescente `text-…` aqui dentro.
 *
 * Os originais estão em `public/icons/*.svg`, com o mesmo nome de cada
 * componente. Ao trocar um desenho, troque os DOIS: o arquivo é a fonte que o
 * designer edita, este arquivo é o que a aplicação renderiza. Do SVG original
 * saem o `<?xml?>`, o `id`/`data-name` do editor e o `width`/`height` de 512 —
 * o tamanho aqui vem sempre do `className`.
 *
 * O `viewBox` é 24 nos cinco, e ao contrário dos glifos do lucide estes ocupam
 * a caixa quase inteira — por isso a barra usa um `size` ÚNICO para os quatro
 * das abas. Quanto cada um desenha, de 24:
 *
 * | glifo   | largura | altura |
 * |---------|---------|--------|
 * | feed    | 24      | 24     |
 * | list    | 24      | 24     |
 * | study   | 24      | 24     |
 * | profile | 18      | 23     |
 *
 * O `profile` é o que menos preenche a caixa, e a 16px ele lê como um tico
 * menor que os vizinhos. Já foi compensado com um `scale` de 1,18 aqui dentro
 * e ficou PIOR — a silhueta cresce mas continua estreita, e o que se ganha em
 * massa se perde em um glifo alto demais para a fileira. Ficou como está.
 *
 * Ao trocar um desenho, MEÇA esta tabela de novo antes de concluir que o
 * `size` da barra está errado: quase sempre o que mudou foi a taxa de
 * preenchimento do arquivo novo.
 */

type GlyphProps = { className?: string };

export function FeedGlyph({ className }: GlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19,24H5c-2.757,0-5-2.243-5-5V9.724c0-1.665,.824-3.215,2.204-4.145L9.203,.855c1.699-1.146,3.895-1.146,5.594,0l7,4.724c1.379,.93,2.203,2.479,2.203,4.145v9.276c0,2.757-2.243,5-5,5ZM12,1.997c-.584,0-1.168,.172-1.678,.517L3.322,7.237c-.828,.558-1.322,1.487-1.322,2.486v9.276c0,1.654,1.346,3,3,3h14c1.654,0,3-1.346,3-3V9.724c0-.999-.494-1.929-1.321-2.486L13.678,2.514c-.51-.345-1.094-.517-1.678-.517Z" />
    </svg>
  );
}

export function ListGlyph({ className }: GlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="m21,17h-1v-4c0-.552-.447-1-1-1s-1,.448-1,1v4h-5c-1.654,0-3,1.346-3,3v.5c0,.827-.673,1.5-1.5,1.5s-1.5-.673-1.5-1.5V3.5c0-.539-.133-1.044-.351-1.5h5.351c.553,0,1-.448,1-1s-.447-1-1-1H3.5C1.57,0,0,1.57,0,3.5v.5c0,1.654,1.346,3,3,3h2v13.5c0,1.929,1.569,3.499,3.498,3.5h12.002c1.93,0,3.5-1.57,3.5-3.5v-.5c0-1.654-1.346-3-3-3ZM5,5h-2c-.552,0-1-.449-1-1v-.5c0-.827.673-1.5,1.5-1.5s1.5.673,1.5,1.5v1.5Zm17,15.5c0,.827-.673,1.5-1.5,1.5h-8.838c.217-.455.338-.963.338-1.5v-.5c0-.551.448-1,1-1h8c.552,0,1,.449,1,1v.5Zm-12.086-7.706c-.169.607.293,1.206.923,1.206h0c.429,0,.805-.286.918-.7.144-.525.311-1.051.512-1.576,2.744-.389,5.01-1.319,6.906-2.851,1.996-1.613,3.878-4.059,4.682-6.086.268-.675.162-1.421-.282-1.997-.443-.574-1.143-.864-1.854-.776-.995.122-4.438.675-6.946,2.701-2.804,2.264-3.816,6.13-4.134,7.785-.248.629-.555,1.68-.726,2.293Zm6.116-8.522c1.666-1.344,4.156-2.055,5.967-2.22-.554,1.396-2.067,3.641-4.079,5.267-.979.79-2.091,1.385-3.341,1.813,1.102-1.22,2.392-2.652,3.364-3.749.169-.191-.056-.475-.279-.352-1.617.888-2.997,1.891-4.158,2.85.537-1.287,1.335-2.647,2.526-3.609Z" />
    </svg>
  );
}

export function StudyGlyph({ className }: GlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="m8.001,7.746c.042.005-.042,0,0,0h0Zm-3.977-1.752c-.123.538.214,1.074.752,1.197,1.012.231,2.181.423,3.224.555.497,0,.927-.369.991-.875.069-.548-.319-1.048-.867-1.117-.979-.123-1.955-.295-2.902-.512-.537-.126-1.075.214-1.198.752Zm3.977,9.776c-.042,0,.042.005,0,0h0Zm.123-1.992c-.975-.122-1.951-.294-2.901-.511-.537-.124-1.075.213-1.198.752-.123.538.214,1.074.752,1.197,1.015.232,2.183.424,3.224.554.497,0,.928-.37.991-.876.068-.548-.32-1.048-.868-1.116Zm-.123-2.032c-.042,0,.042.005,0,0h0Zm.124-1.992c-.979-.123-1.955-.295-2.902-.512-.537-.127-1.075.214-1.198.752s.214,1.074.752,1.197c1.012.231,2.181.423,3.224.555.497,0,.927-.369.991-.875.069-.548-.319-1.048-.867-1.117Zm7.874,6.017c-.042.005.041,0,0,0h0Zm4.236,4.675c-1.006.267-2.037.483-3.087.649,1.745.434,3.807.815,5.896.907.552.024.979.491.955,1.043-.023.537-.466.956-.998.956-.015,0-.03,0-.045,0-4.949-.217-9.601-1.893-10.956-2.421-1.355.528-6.006,2.204-10.956,2.421-.015,0-.03,0-.045,0-.532,0-.975-.419-.998-.956-.024-.552.403-1.019.955-1.043,2.089-.092,4.151-.473,5.896-.907-1.051-.166-2.082-.382-3.088-.649-2.216-.588-3.764-2.583-3.764-4.852V4.5C0,3.098.635,1.798,1.743.936,2.837.084,4.232-.21,5.566.128c2.576.653,4.561.946,6.437.952,1.869-.006,3.854-.299,6.431-.952,1.333-.337,2.73-.044,3.823.808,1.107.862,1.743,2.162,1.743,3.564v11.094c0,2.269-1.548,4.264-3.765,4.852ZM11,3.053c-1.755-.09-3.627-.403-5.924-.985-.199-.051-.4-.075-.599-.075-.538,0-1.065.18-1.505.521-.618.481-.972,1.205-.972,1.986v11.094c0,1.362.936,2.562,2.276,2.918,2.138.567,4.395.892,6.724.97V3.053Zm8.723,15.459c1.341-.355,2.277-1.556,2.277-2.918V4.5c0-.781-.354-1.505-.972-1.986-.604-.469-1.367-.635-2.104-.446-2.299.583-4.172.896-5.924.986v16.429c2.326-.077,4.585-.403,6.723-.97Zm-3.724-10.766c-.043.005.041,0,0,0h0Zm2.778-2.504c-.948.217-1.925.389-2.902.512-.548.069-.937.569-.867,1.117.063.506.494.875.991.875,1.043-.131,2.211-.323,3.224-.555.538-.123.875-.659.752-1.197-.123-.539-.661-.879-1.197-.752Zm-2.778,6.504c-.043.005.041,0,0,0h0Zm2.778-2.504c-.948.217-1.925.389-2.902.512-.548.069-.937.569-.867,1.117.063.506.494.875.991.875,1.043-.131,2.211-.323,3.224-.555.538-.123.875-.659.752-1.197-.123-.54-.661-.878-1.197-.752Zm0,4.025c-.951.217-1.927.389-2.901.511-.548.068-.937.568-.868,1.116.063.506.494.876.991.876,1.04-.13,2.208-.321,3.224-.554.538-.123.875-.659.752-1.197-.123-.54-.661-.877-1.197-.752Z" />
    </svg>
  );
}

export function ProfileGlyph({ className }: GlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12,12A6,6,0,1,0,6,6,6.006,6.006,0,0,0,12,12ZM12,2A4,4,0,1,1,8,6,4,4,0,0,1,12,2Z" />
      <path d="M12,14a9.01,9.01,0,0,0-9,9,1,1,0,0,0,2,0,7,7,0,0,1,14,0,1,1,0,0,0,2,0A9.01,9.01,0,0,0,12,14Z" />
    </svg>
  );
}
