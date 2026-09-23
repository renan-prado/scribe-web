import { Bone } from "../components/Bone";

/**
 * O esqueleto do `/import`.
 *
 * A tela é pequena, mas a rota é dinâmica e o formulário consulta o saldo antes
 * de decidir o que mostrar no botão — sem este arquivo, tocar "Importar" no
 * painel do `+` deixava a Biblioteca parada na tela sem sinal de que algo
 * aconteceu.
 *
 * Os ossos ficam CENTRALIZADOS, como o formulário de verdade
 * (`flex-1` + `justify-center` na página): um esqueleto encostado no topo
 * seguido de um formulário no meio da tela é o conteúdo saltando de lugar na
 * chegada.
 */
export default function ImportarLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col px-4 pb-10">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <Bone className="h-4 w-28" />
          <Bone className="h-13 w-full rounded-2xl" />
          <Bone className="mt-1 h-3 w-24 self-end" />
          <Bone className="mt-2 h-4 w-40" />
          <Bone className="mt-3 h-13.5 w-full rounded-full" />
        </div>
      </div>
    </main>
  );
}
