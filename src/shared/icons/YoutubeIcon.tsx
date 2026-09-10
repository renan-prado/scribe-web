import { cn } from "@/lib/utils";

/**
 * O glifo do YouTube, retângulo arredondado com o triângulo vazado.
 *
 * **Existe porque o lucide-react v1 não tem.** Os ícones de marca saíram da
 * biblioteca, e `Youtube` não é mais um export (o build quebra com TS2305). O
 * substituto genérico que estava aqui antes era o `MonitorPlay`, que diz
 * "vídeo" e não diz "YouTube", e num diálogo onde o modo se chama YouTube, a
 * marca é a informação.
 *
 * **`currentColor`, não o vermelho da marca.** Ele mora no mesmo disco que os
 * outros três ícones de modo (`BookOpenText`, `FileText`, `Captions`), e aquele
 * disco troca de fundo quando o card é selecionado, vai de `bg-scriba-surface`
 * para o gradiente do CTA. Um vermelho fixo brigaria com o gradiente
 * selecionado e quebraria a fileira quando não selecionado; herdando a cor, o
 * card do YouTube se comporta como os outros três e continua reconhecível pela
 * FORMA, que é o que identifica a marca de longe.
 *
 * Uso do logo aqui é nominativo: ele rotula a função que importa daquele
 * serviço. Não é `GoogleIcon`, que reproduz as cores oficiais porque fica sobre
 * fundo neutro no botão de login.
 */
export function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
