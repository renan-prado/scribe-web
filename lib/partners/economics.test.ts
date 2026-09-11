import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAYOUT_DAY_OF_MONTH, payoutDayForMonth } from "./economics";

/**
 * O único teste desta camada, e ele existe pela razão que `AGENTS.md` dá para
 * `lib/finance/*`: aritmética que decide dinheiro, sem banco no meio.
 *
 * `payoutDayForMonth` responde "que dia o parceiro recebe", e errar aqui não
 * quebra nada na tela: só paga no dia errado, ou promete um 30 de fevereiro
 * que nunca chega. É o tipo de defeito que ninguém vê até alguém reclamar.
 */
describe("payoutDayForMonth", () => {
  it("devolve o dia fixo nos meses que o têm", () => {
    // Janeiro (31), abril (30) e dezembro (31): o dia 30 existe em todos.
    assert.equal(payoutDayForMonth(2026, 0), PAYOUT_DAY_OF_MONTH);
    assert.equal(payoutDayForMonth(2026, 3), PAYOUT_DAY_OF_MONTH);
    assert.equal(payoutDayForMonth(2026, 11), PAYOUT_DAY_OF_MONTH);
  });

  it("antecipa para o último dia em fevereiro comum", () => {
    assert.equal(payoutDayForMonth(2026, 1), 28);
    assert.equal(payoutDayForMonth(2027, 1), 28);
  });

  it("respeita o ano bissexto", () => {
    assert.equal(payoutDayForMonth(2028, 1), 29);
    assert.equal(payoutDayForMonth(2024, 1), 29);
  });

  it("trata 1900 como não bissexto e 2000 como bissexto", () => {
    // A regra dos séculos (divisível por 100 não é bissexto, por 400 é) vem do
    // `Date` e não de uma conta nossa. O teste existe para garantir que a
    // implementação continue DELEGANDO isso, e não tentando calcular sozinha.
    assert.equal(payoutDayForMonth(1900, 1), 28);
    assert.equal(payoutDayForMonth(2000, 1), 29);
  });

  it("nunca devolve um dia que o mês não tem", () => {
    for (let month = 0; month < 12; month += 1) {
      const day = payoutDayForMonth(2026, month);
      const lastDay = new Date(2026, month + 1, 0).getDate();
      assert.ok(day <= lastDay, `mês ${month}: dia ${day} passa do fim (${lastDay})`);
      assert.ok(day >= 28, `mês ${month}: dia ${day} cedo demais`);
    }
  });
});
