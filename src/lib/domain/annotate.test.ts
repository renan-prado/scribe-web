import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annotateText } from "./annotate";

/** Só as referências, na ordem em que aparecem no texto. */
function refs(text: string): string[] {
  return annotateText(text)
    .filter((s) => s.kind === "scripture")
    .map((s) => s.reference);
}

describe("annotateText: referências encadeadas", () => {
  it('"2Tm 1:5; 3:15" -> [2 Timóteo 1:5, 2 Timóteo 3:15]', () => {
    assert.deepEqual(refs("2Tm 1:5; 3:15"), ["2 Timóteo 1:5", "2 Timóteo 3:15"]);
  });

  it('"Jo 3:16, 17; 4:1" -> [João 3:16, João 3:17, João 4:1]', () => {
    assert.deepEqual(refs("Jo 3:16, 17; 4:1"), ["João 3:16", "João 3:17", "João 4:1"]);
  });

  it('"Gn 1:1; Êx 2:3; 4:5" -> [Gênesis 1:1, Êxodo 2:3, Êxodo 4:5]', () => {
    // O exemplo da tarefa usa "Ex" sem acento; a sigla cadastrada para Êxodo
    // (`BOOK_CANON`, `src/lib/bibles/books.ts`) é "Êx". O caso é o mesmo: duas
    // referências independentes (cada uma com o próprio livro) seguidas de
    // uma encadeada que herda o livro mais recente, Êxodo, não Gênesis.
    assert.deepEqual(refs("Gn 1:1; Êx 2:3; 4:5"), ["Gênesis 1:1", "Êxodo 2:3", "Êxodo 4:5"]);
  });

  it("encadeia uma faixa de versículos com hífen", () => {
    assert.deepEqual(refs("Mt 5:1; 6:5-9"), ["Mateus 5:1", "Mateus 6:5-9"]);
  });

  it("não encadeia por nome completo do livro também", () => {
    assert.deepEqual(refs("João 3:16; 4:1"), ["João 3:16", "João 4:1"]);
  });

  it("uma referência sem cadeia continua sozinha", () => {
    assert.deepEqual(refs("Jo 3:16"), ["João 3:16"]);
  });

  it("vírgula ou ponto e vírgula longe de uma referência não vira link", () => {
    assert.deepEqual(refs("Ele leu, com atenção, o texto; depois orou"), []);
  });

  it("vírgula seguida de palavra (não número) não é cadeia", () => {
    assert.deepEqual(refs("João 3:16, o mais famoso versículo"), ["João 3:16"]);
  });

  it("o delimitador e o espaço entre as duas referências continuam como texto comum", () => {
    const segments = annotateText("2Tm 1:5; 3:15");
    assert.deepEqual(
      segments.map((s) => (s.kind === "scripture" ? `[scripture:${s.reference}]` : s.text)),
      ["[scripture:2 Timóteo 1:5]", "; ", "[scripture:2 Timóteo 3:15]"]
    );
  });

  it("tolera espaço antes do delimitador também", () => {
    assert.deepEqual(refs("2Tm 1:5 ; 3:15"), ["2 Timóteo 1:5", "2 Timóteo 3:15"]);
  });
});
