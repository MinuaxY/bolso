/**
 * Ciclo de fatura do cartao de credito.
 *
 * Traduz `TargetMonthSheet` do VBA de origem.
 *
 * A ideia: uma compra feita depois do fechamento da fatura nao entra na
 * fatura deste mes, entra na do mes seguinte. Sem isso, o gasto de fim de mes
 * aparece no mes errado e o total nunca bate com o que o banco cobra.
 *
 * No VBA o dia de fechamento era a constante 5. Aqui e parametro, porque cada
 * cartao fecha num dia e a pessoa pode ter mais de um.
 */

import { competenciaDe, partesDe } from './data.js';
import type { Competencia, DataCivil } from './tipos.js';

/**
 * Em que fatura cai uma compra.
 *
 * `competenciaDaCompra('2026-06-03', 5)` da `2026-06`: comprou antes do
 * fechamento, entra na fatura deste mes.
 * `competenciaDaCompra('2026-06-06', 5)` da `2026-07`: comprou depois, ja e a
 * fatura seguinte.
 */
export function competenciaDaCompra(data: DataCivil, diaFechamento: number): Competencia {
  if (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) {
    throw new RangeError(
      `Dia de fechamento invalido: ${String(diaFechamento)}. Esperado um inteiro de 1 a 31.`,
    );
  }

  const { ano, mes, dia } = partesDe(data);

  return dia > diaFechamento ? competenciaDe(ano, mes + 1) : competenciaDe(ano, mes);
}

/**
 * Lancamento de conta corrente nao tem ciclo: cai no mes em que aconteceu.
 * Existe como funcao propria para o resto do sistema nunca ter que decidir
 * entre uma coisa e outra com um `if` espalhado.
 */
export function competenciaDeDebito(data: DataCivil): Competencia {
  const { ano, mes } = partesDe(data);
  return competenciaDe(ano, mes);
}
