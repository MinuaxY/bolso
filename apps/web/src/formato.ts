import type { Competencia, DataCivil } from '@bolso/core';
import { formatarCentavos } from '@bolso/parsers';

export { formatarCentavos };

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** `2026-06` vira `Junho de 2026`. */
export function nomeCompetencia(competencia: Competencia): string {
  const [ano, mes] = competencia.split('-');
  const nome = MESES[Number(mes) - 1] ?? mes ?? '';
  return `${nome} de ${ano ?? ''}`;
}

/** `2026-06` vira `jun/26`, para caber em eixo de grafico. */
export function competenciaCurta(competencia: Competencia): string {
  const [ano, mes] = competencia.split('-');
  const nome = (MESES[Number(mes) - 1] ?? '').slice(0, 3).toLowerCase();
  return `${nome}/${(ano ?? '').slice(2)}`;
}

/** `2026-06-02` vira `02/06`. */
export function dataCurta(data: DataCivil): string {
  const [, mes, dia] = data.split('-');
  return `${dia ?? ''}/${mes ?? ''}`;
}

/** `2026-06-02` vira `02/06/2026`. */
export function dataCompleta(data: DataCivil): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia ?? ''}/${mes ?? ''}/${ano ?? ''}`;
}

export function plural(quantidade: number, singular: string, plural_: string): string {
  return `${String(quantidade)} ${quantidade === 1 ? singular : plural_}`;
}

/** `8.08` vira `8,08%`. Percentual com ponto num app de financas brasileiro
 *  parece erro de programa, e este e o numero que a pessoa vai comparar com a
 *  guia. */
export function formatarPercentual(valor: number, casas = 2): string {
  return `${valor.toFixed(casas).replace('.', ',')}%`;
}
