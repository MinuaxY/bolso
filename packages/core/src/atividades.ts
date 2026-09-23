/**
 * De atividade para anexo do Simples Nacional.
 *
 * ATENCAO AO QUE ESTE ARQUIVO NAO E: uma consulta oficial.
 *
 * A Lei Complementar 123/2006 classifica a empresa pela DESCRICAO da
 * atividade, nao pelo codigo CNAE. Nao existe tabela oficial de CNAE para
 * anexo — os anexos VI e VII da Resolucao CGSN 140/2018, que sao os que listam
 * CNAEs, tratam de quais atividades IMPEDEM a opcao pelo Simples, e nao de
 * qual anexo se aplica a quem entrou.
 *
 * Toda tabela "CNAE x anexo" que circula por ai, esta inclusive, e
 * interpretacao derivada. Serve para orientar e para dar nome ao que a pessoa
 * faz; quem confirma e o contador, e a tela diz isso.
 *
 * O limiar do Fator R, por outro lado, NAO depende de atividade nenhuma: sao
 * 28% para todo mundo, fixados em lei. O que a atividade decide e se a empresa
 * entra na regra do Fator R — nao qual o percentual dela.
 */

import dados from '../dados/atividades-simples-2026.json';
import type { Anexo } from './simples.js';
import { normalizar } from './texto.js';

export interface Atividade {
  readonly id: string;
  readonly nome: string;
  readonly anexo: Anexo;
  /** Verdadeiro quando a atividade oscila entre os anexos III e V pelo Fator R. */
  readonly fatorR: boolean;
  /** Prefixos de CNAE que costumam corresponder a esta atividade. */
  readonly cnaes: readonly string[];
  readonly fundamento: string;
  readonly exemplos: string;
}

interface ArquivoAtividades {
  readonly anoVigencia: number;
  readonly conferidoEm: string;
  readonly aviso: string;
  readonly atividades: readonly Atividade[];
}

const ARQUIVO = dados as ArquivoAtividades;

export const ATIVIDADES: readonly Atividade[] = ARQUIVO.atividades;
export const AVISO_ATIVIDADES = ARQUIVO.aviso;

/** Deixa `62.01-5/01`, `6201501` e `62.01` comparaveis entre si. */
function somenteDigitos(cnae: string): string {
  return cnae.replace(/\D/g, '');
}

/**
 * Procura a atividade de um CNAE.
 *
 * Compara por prefixo de digitos, entao `6201-5/01` casa com a regra `62`.
 * Quando mais de uma regra casa, vence a mais especifica — `69.20`
 * (contabilidade, Anexo III) tem que vencer um eventual prefixo `69`.
 */
export function atividadePorCnae(cnae: string): Atividade | undefined {
  const digitos = somenteDigitos(cnae);
  if (digitos.length < 2) return undefined;

  let melhor: Atividade | undefined;
  let tamanhoDaRegra = 0;

  for (const atividade of ATIVIDADES) {
    for (const regra of atividade.cnaes) {
      const prefixo = somenteDigitos(regra);
      if (digitos.startsWith(prefixo) && prefixo.length > tamanhoDaRegra) {
        melhor = atividade;
        tamanhoDaRegra = prefixo.length;
      }
    }
  }

  return melhor;
}

/** Busca por texto no nome e nos exemplos, para quem nao sabe o CNAE de cor. */
export function buscarAtividades(termo: string): readonly Atividade[] {
  const procurado = normalizar(termo);
  if (procurado.length === 0) return ATIVIDADES;

  const porCnae = atividadePorCnae(termo);
  if (porCnae !== undefined) return [porCnae];

  return ATIVIDADES.filter(
    (atividade) =>
      normalizar(atividade.nome).includes(procurado) ||
      normalizar(atividade.exemplos).includes(procurado),
  );
}
