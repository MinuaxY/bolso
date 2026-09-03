/**
 * Deduplicacao na importacao.
 *
 * Nao ha equivalente no VBA: a planilha simplesmente colava tudo de novo, e
 * reimportar o mesmo arquivo dobrava o mes. Este e o primeiro comportamento
 * que o Bolso ganha e a planilha nao tem.
 *
 * O problema tem uma sutileza que uma chave unica ingenua erra: duas compras
 * identicas no mesmo dia sao comuns e legitimas — dois cafes de sete reais na
 * mesma padaria. Elas nao podem ser tratadas como uma so. Por isso a
 * comparacao e por CONTAGEM: se o historico ja tem duas ocorrencias daquela
 * chave e o arquivo traz duas, nada e novo; se o arquivo traz tres, uma e
 * nova.
 */

import { normalizar } from './texto.js';
import type { DataCivil } from './tipos.js';

export interface ItemDeduplicavel {
  readonly data: DataCivil;
  readonly valorCentavos: number;
  /** Descricao como veio do banco, antes de qualquer regra de categorizacao. */
  readonly descricaoOriginal: string;
  /**
   * Identificador que o proprio banco deu a transacao, quando existe. O CSV
   * de conta do Nubank traz um UUID por linha, e ele resolve o problema
   * inteiro: e identidade de verdade, nao heuristica.
   */
  readonly identificadorBanco?: string;
}

/**
 * Chave de comparacao de um lancamento.
 *
 * Com identificador do banco, a chave e ele. Sem identificador, a chave e a
 * combinacao de data, valor e descricao normalizada — que e o mais proximo de
 * identidade que um extrato de cartao permite.
 */
export function chaveDeDuplicacao(item: ItemDeduplicavel): string {
  if (item.identificadorBanco !== undefined && item.identificadorBanco.length > 0) {
    return `banco:${item.identificadorBanco}`;
  }

  return `heuristica:${item.data}|${String(item.valorCentavos)}|${normalizar(item.descricaoOriginal)}`;
}

export interface ResultadoImportacao<T> {
  /** O que deve ser gravado. */
  readonly novos: readonly T[];
  /** O que ja existia e foi ignorado, para poder mostrar "12 ja estavam aqui". */
  readonly duplicados: readonly T[];
}

/**
 * Separa o que e novo do que ja existe, preservando a ordem do arquivo.
 */
export function classificarImportacao<T extends ItemDeduplicavel>(
  candidatos: readonly T[],
  existentes: readonly ItemDeduplicavel[],
): ResultadoImportacao<T> {
  const contagem = new Map<string, number>();

  for (const existente of existentes) {
    const chave = chaveDeDuplicacao(existente);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  const novos: T[] = [];
  const duplicados: T[] = [];

  for (const candidato of candidatos) {
    const chave = chaveDeDuplicacao(candidato);
    const restante = contagem.get(chave) ?? 0;

    if (restante > 0) {
      contagem.set(chave, restante - 1);
      duplicados.push(candidato);
    } else {
      novos.push(candidato);
    }
  }

  return { novos, duplicados };
}
