/**
 * O microfone do botão de gravar do v2 (`app/v2/home/RecordButton.tsx`).
 *
 * Original em `public/icons/microfone.svg`, e o arquivo continua sendo a fonte
 * que o designer edita: ao trocar o desenho, troque os DOIS. Do original saem
 * só o `id` do editor e o `width`/`height` de 512, o tamanho aqui vem sempre do
 * `className`. O `viewBox` de 32 e o `translate` do grupo ficam como estão,
 * são o enquadramento do arquivo; mexer neles é redesenhar o ícone.
 *
 * Pinta com `currentColor`, que é a razão de ser componente em vez de
 * `<img src="/icons/microfone.svg">`: um `<img>` não herda cor nenhuma, e este
 * glifo precisa acompanhar a tinta do botão.
 *
 * **Ele é PREENCHIDO, e isso tem história.** O microfone do botão central da
 * `MobileBottomNav` é traçado (o `Mic` do lucide) porque um glifo sólido dentro
 * daquele disco pequeno e colorido virava mancha, ver o cabeçalho de lá. Aqui o
 * disco é maior e a cor é chapada, e o sólido é o que o desenho do v2 pede. Se
 * um dia ele voltar a parecer mancha, o caminho é diminuir o `size` antes de
 * trocar o glifo: o desenho ocupa 14 de 32 na largura e 23 de 32 na altura,
 * então ele lê mais alto e mais estreito que um glifo do lucide do mesmo
 * tamanho nominal.
 */
export function MicGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <g transform="translate(-8 -2)">
        <path d="m23.7 21.9c-2.2 0-4-1.6-4-3.6v-9.1c0-2 1.8-3.6 4-3.6 2.2 0 4 1.6 4 3.6v9.1c0 2-1.8 3.6-4 3.6z" />
        <path d="m31.7 18.3v-1.8h-2v1.8c0 3-2.7 5.4-6 5.4s-6-2.4-6-5.4v-1.8h-2v1.8c0 3.4 2.6 6.2 6 7v3.9h-4v1.8h12v-1.8h-4v-3.9c3.4-.8 6-3.6 6-7z" />
      </g>
    </svg>
  );
}
