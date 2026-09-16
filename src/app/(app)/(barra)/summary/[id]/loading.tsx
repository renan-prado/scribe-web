import { Bone } from "../../components/Bone";

/**
 * O esqueleto do resumo aberto.
 *
 * É o `loading.tsx` que mais importa do app inteiro, porque é a navegação que
 * mais se faz: tocar num post-it da Biblioteca. Sem ele, a rota é dinâmica
 * (`getSession` bate no banco) e o toque no cartão não produzia NADA na tela
 * até a resposta voltar — o dedo já saiu e a Biblioteca ainda está lá, o que se
 * lê como toque que não pegou, e a pessoa toca de novo.
 *
 * Ele copia a ANATOMIA do que vem (pastilha, título grande, linha de data,
 * parágrafos de larguras desiguais), e não um retângulo genérico: um esqueleto
 * com a forma errada troca a espera por um pulo de layout na chegada, que é
 * pior — a espera ao menos avisa.
 *
 * A largura da coluna é a da LEITURA (`max-w-3xl`), não a dos 1024 do `<main>`:
 * é onde o texto vai pousar, e ossos ocupando a barra inteira prometeriam uma
 * linha de leitura que o resumo não tem.
 *
 * A barra do topo não está aqui — ela é do layout, já está na tela, e continua
 * inteira enquanto isto cintila. Ver `Bone`.
 */
export default function SummaryLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1024px] flex-col gap-6 px-4 pb-8 sm:gap-8 sm:px-6 sm:pb-10">
      <div className="flex flex-col gap-3">
        <Bone className="h-5 w-24 rounded-full" />
        <Bone className="h-8 w-11/12" />
        <Bone className="h-8 w-2/3" />
        <Bone className="mt-1 h-3.5 w-48" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {[0, 1, 2].map((block) => (
          <div key={`block-${block}`} className="flex flex-col gap-2.5">
            <Bone className="h-5 w-2/5" />
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-4/5" />
            <Bone className="h-3.5 w-3/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
