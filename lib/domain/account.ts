/**
 * O contrato da exclusão de conta, compartilhado entre a tela e a rota.
 *
 * Mora em `lib/domain/` porque as duas pontas precisam da MESMA palavra:
 * `/profile/delete` a imprime no rótulo do campo e a rota
 * `/api/account/delete` a exige no corpo. Duplicar a string nos dois lados
 * criaria o pior desfecho possível para esta tela, um botão que nunca conclui
 * porque a confirmação que ele manda não é a que o servidor espera.
 *
 * Não é segredo: a validação existe para provar que quem confirmou LEU, não
 * para impedir um `fetch` direto. Quem chama a rota na mão continua sendo
 * o dono da conta, e apagar a própria conta é o direito que esta rota serve.
 */
export const DELETE_CONFIRMATION = "EXCLUIR";
