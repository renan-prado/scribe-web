/**
 * A versão do app, o marcador que separa "antes" de "depois" nas medições.
 *
 * Client-safe de propósito: o mesmo número carimba os eventos de LLM no
 * servidor (`lib/db/usage.ts`) e rotula o filtro do `/admin/usage`, e uma
 * segunda constante para a tela seria uma segunda fonte da verdade.
 *
 * A ORIGEM é o `version` do `package.json`, lido UMA vez em `next.config.ts` e
 * embutido no bundle como `NEXT_PUBLIC_APP_VERSION`. Ela NÃO está no schema Zod
 * de `lib/env/client.ts`, e isso é decisão, não esquecimento: aquele schema
 * valida o que uma PESSOA configura em `.env` e no painel da Vercel, e
 * declarar esta ali convidaria alguém a criar a variável à mão, dois números
 * de versão que um dia discordam. Aqui ela é derivada, nunca digitada.
 *
 * O valor só é um corte útil se SUBIR a cada entrega: ver `npm run release` e
 * a seção "Versão e release" do AGENTS.md da raiz. Sem o bump, todo evento
 * nasce com o mesmo rótulo e o filtro por versão não separa nada.
 */

/**
 * Sentinela para o contexto que não passou pelo build do Next, `node --test`,
 * um script solto em `tmp/`. Não é null: null na coluna `app_version` já
 * significa "anterior à medição", e uma linha que nasce hoje sem versão é um
 * problema diferente, que merece nome próprio quando aparecer no painel.
 */
export const UNKNOWN_APP_VERSION = "0.0.0-dev";

export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || UNKNOWN_APP_VERSION;

type Parsed = { numbers: number[]; pre: string };

function parse(version: string): Parsed {
  const [core = "", ...rest] = version.split("-");
  const numbers = core.split(".").map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return { numbers, pre: rest.join("-") };
}

/**
 * Ordena versões como VERSÕES, não como texto: "0.10.0" vem depois de
 * "0.9.0", e a ordenação do Postgres (ou um `.sort()` cru) diria o contrário,
 * silenciosamente, e justo na tabela que existe para dizer o que veio antes.
 *
 * Negativo quando `a` é mais antiga. Uma versão com sufixo (`0.2.0-rc.1`) é
 * mais antiga que a limpa de mesmo número, como manda o semver.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.numbers.length, pb.numbers.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa.numbers[i] ?? 0) - (pb.numbers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === "") return 1;
  if (pb.pre === "") return -1;
  return pa.pre.localeCompare(pb.pre);
}

/** Da mais nova para a mais antiga, a ordem em que o painel lê. */
export function sortVersionsDesc(versions: readonly string[]): string[] {
  return [...versions].sort((a, b) => compareVersions(b, a));
}
