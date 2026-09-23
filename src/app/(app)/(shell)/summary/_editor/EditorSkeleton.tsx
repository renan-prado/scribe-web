import { Bone } from "../../components/Bone";

/**
 * O esqueleto do `/summary/new`, e o do `/summary/[id]/edit` por herança de segmento.
 *
 * A folha em branco não custa consulta nenhuma, mas o `Composer` é um pedaço
 * grande de JavaScript (o editor de blocos, o seletor de passagem), e é o
 * download dele que se espera aqui. Sem um `loading.tsx`, esse tempo é tela
 * parada depois do toque.
 *
 * A coluna é a da ESCRITA (`max-w-3xl`), a mesma da leitura do `/summary`: é
 * uma promessa do produto que o que se digita tem a largura do que sai, e um
 * esqueleto mais largo a quebraria antes mesmo de a tela abrir.
 */
export default function EscreverLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1024px] flex-col gap-6 px-4 pb-24 sm:gap-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Bone className="h-4 w-20" />
            <Bone className="h-8 w-24 rounded-full" />
          </div>
          <Bone className="h-9 w-4/5" />
          <Bone className="h-4 w-3/5" />
        </div>
        <div className="flex flex-col gap-3">
          <Bone className="h-3.5 w-full" />
          <Bone className="h-3.5 w-11/12" />
          <Bone className="h-3.5 w-2/3" />
        </div>
      </div>
    </main>
  );
}
