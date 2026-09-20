"use client";

import { CloudOff } from "lucide-react";
import { useNetworkStatus } from "@/shared/hooks/use-network-status";

/**
 * A pastilha "Modo offline". Ela só existe quando a rede cai, e some sozinha.
 *
 * ## Por que ela precisa existir
 *
 * Porque o Scriba passou a funcionar sem rede e não CONTAVA isso. Escrever
 * continua funcionando, a Biblioteca continua abrindo do disco, a gravação
 * continua sendo guardada — e para quem está do outro lado da tela isso é
 * indistinguível de um app que está prestes a perder tudo. O medo não vem da
 * falta de internet, vem de não saber se o trabalho está em algum lugar. Uma
 * linha que diz "estou offline, e sei disso" é a diferença entre as duas
 * leituras.
 *
 * ## Por que ela é pequena, e por que fica embaixo
 *
 * Porque não é um erro: é um MODO. Uma faixa vermelha no topo trata a falta de
 * rede como um acidente a ser resolvido agora, e aqui ela não impede nada do
 * que a pessoa veio fazer. A pastilha pousa no canto de baixo à esquerda, onde
 * não disputa com o título da tela nem com o `+` do `CreateDock` (que é o canto
 * oposto), e no tamanho em que se lê sem se impor.
 *
 * `z-40` a põe acima do véu do dock (`z-20`) e da faixa dele (`z-30`), porque é
 * justamente com o painel de criar aberto que a informação mais importa: as
 * três portas custam rede em graus diferentes, e saber que não há rede antes de
 * escolher é o que evita o toque frustrado.
 *
 * `pointer-events-none`: ela não faz nada. Um alvo de toque que não responde é
 * pior que nenhum, e ela ainda cobriria o canto da lista por onde se rola.
 *
 * ## Onde ela mora
 *
 * No layout de `(barra)`, uma vez, e não em cada tela. É o mesmo raciocínio do
 * `PendingCaptureRunner` ao lado dela: o estado é do APARELHO, não da página, e
 * repetido em sete telas bastaria esquecer uma para o aviso sumir justamente
 * onde alguém estava trabalhando.
 */
export function OfflineBadge() {
  const online = useNetworkStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-v2-card px-3 py-1.5 text-[11px] font-medium text-v2-ink-soft shadow-lg shadow-black/20 ring-1 ring-inset ring-v2-card-hover"
    >
      <CloudOff aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
      Modo offline
      {/* A segunda metade da frase, e a que de fato acalma. "Modo offline"
          sozinho nomeia o problema; é isto que diz que não há nada a fazer a
          respeito. Some no celular, onde a pastilha inteira não caberia sem
          brigar com a lista: ali a palavra sozinha já muda o que a pessoa
          conclui ao ver um salvamento demorar. */}
      <span className="hidden text-v2-ink-mute sm:inline">· seu trabalho fica guardado aqui</span>
    </div>
  );
}
