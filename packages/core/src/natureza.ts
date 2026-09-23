/**
 * Natureza de um lancamento: o que ele significa no seu dinheiro.
 *
 * Nao existe no VBA de origem, e e a correcao de um erro que a planilha comete
 * calado. Tres linhas dos extratos reais provam o problema:
 *
 *     conta:   04/04/2026  -3958,01  Pagamento de fatura
 *     cartao:  2026-04-04  -3958,01  Pagamento recebido
 *     cartao:  2026-03-20     61,05  99food *Jyk Food
 *
 * Quem importa a conta e o cartao juntos tem o mesmo dinheiro tres vezes no
 * mes: as compras do cartao, o pagamento da fatura saindo da conta, e o
 * pagamento entrando no cartao. Somar tudo produz gasto inflado e receita
 * inventada.
 *
 * A despesa de verdade e a compra. O pagamento da fatura e dinheiro trocando
 * de bolso dentro da sua propria vida, e estorno e devolucao, nao renda.
 */

import { normalizar } from './texto.js';

export type Natureza =
  /** Devolucao de uma compra. Abate a despesa da categoria, nao vira receita. */
  | 'estorno'
  /** Dinheiro andando entre contas suas. Nao e receita nem despesa. */
  | 'transferencia';

const TRANSFERENCIA: readonly RegExp[] = [
  /^pagamento de fatura/,
  /^pagamento recebido/,
  /valor adicionado na conta por cartao de credito/,
];

const ESTORNO: readonly RegExp[] = [/^estorno/, /^credito de /, /^devolucao/];

/**
 * Descobre a natureza pela descricao do banco.
 *
 * Devolve `undefined` para a maioria absoluta das linhas, que sao despesa ou
 * receita comum. Ser conservador aqui e de proposito: classificar errado como
 * transferencia esconderia gasto real do relatorio.
 */
export function classificarNatureza(descricao: string): Natureza | undefined {
  const texto = normalizar(descricao);

  if (TRANSFERENCIA.some((padrao) => padrao.test(texto))) return 'transferencia';
  if (ESTORNO.some((padrao) => padrao.test(texto))) return 'estorno';

  return undefined;
}
