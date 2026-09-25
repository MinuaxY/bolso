/**
 * Aritmetica de data civil.
 *
 * Tudo aqui opera sobre string `AAAA-MM-DD` e nunca constroi um `Date`. Um
 * `new Date('2026-06-02')` e meia-noite UTC, que no Brasil e dia 1 as 21h — e
 * uma compra do dia 2 apareceria no mes errado toda vez que caisse no dia 1.
 */

import type { Competencia, DataCivil } from './tipos.js';

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_COMPETENCIA = /^(\d{4})-(\d{2})$/;

export interface PartesData {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

export function diasNoMes(ano: number, mes: number): number {
  // Fevereiro de ano bissexto incluido: a regra completa, nao a aproximacao.
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[mes - 1] ?? 31;
}

export function ehDataCivil(valor: string): boolean {
  const partes = FORMATO_DATA.exec(valor);
  if (partes === null) return false;

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);

  if (mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= diasNoMes(ano, mes);
}

export function partesDe(data: DataCivil): PartesData {
  if (!ehDataCivil(data)) {
    throw new TypeError(`Data civil invalida: ${JSON.stringify(data)}. Esperado AAAA-MM-DD.`);
  }
  const partes = FORMATO_DATA.exec(data) as RegExpExecArray;
  return { ano: Number(partes[1]), mes: Number(partes[2]), dia: Number(partes[3]) };
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

export function competenciaDe(ano: number, mes: number): Competencia {
  const mesesExcedentes = mes - 1;
  const anoFinal = ano + Math.floor(mesesExcedentes / 12);
  const mesFinal = ((mesesExcedentes % 12) + 12) % 12 + 1;
  return `${anoFinal}-${doisDigitos(mesFinal)}`;
}

export function partesDaCompetencia(competencia: Competencia): { ano: number; mes: number } {
  const partes = FORMATO_COMPETENCIA.exec(competencia);
  if (partes === null) {
    throw new TypeError(
      `Competencia invalida: ${JSON.stringify(competencia)}. Esperado AAAA-MM.`,
    );
  }
  const mes = Number(partes[2]);
  if (mes < 1 || mes > 12) {
    throw new TypeError(`Competencia invalida: ${JSON.stringify(competencia)}. Mes fora de 1 a 12.`);
  }
  return { ano: Number(partes[1]), mes };
}

/**
 * Soma meses a uma competencia. `somarMeses('2026-11', 3)` da `2027-02`.
 */
export function somarMeses(competencia: Competencia, meses: number): Competencia {
  const { ano, mes } = partesDaCompetencia(competencia);
  return competenciaDe(ano, mes + meses);
}

/** A competencia em que a data cai, ignorando qualquer ciclo de fatura. */
export function competenciaDaData(data: DataCivil): Competencia {
  const { ano, mes } = partesDe(data);
  return competenciaDe(ano, mes);
}
