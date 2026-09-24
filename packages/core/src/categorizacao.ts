/**
 * Motor de categorizacao automatica.
 *
 * Traduz `FindRule` do VBA de origem, com duas diferencas deliberadas
 * anotadas mais abaixo.
 *
 * A regra do jogo: vale a PRIMEIRA regra da lista cuja palavra-chave aparece
 * na descricao, comparadas as duas sem acento e sem caixa. A ordem da lista e
 * informacao, nao detalhe — `99food` precisa vir antes de `99`, senao toda
 * compra de comida vira corrida de aplicativo.
 */

import { classificarNatureza } from './natureza.js';
import { descricaoSemParcela } from './parcelas.js';
import { corrigirMojibake, normalizar } from './texto.js';
import type {
  Categoria,
  FormaPagamento,
  MotivoRevisao,
  RegraCategorizacao,
  StatusDespesa,
  StatusReceita,
  TipoLancamento,
} from './tipos.js';

/** Onde cai a despesa que nenhuma regra reconheceu. */
export const CATEGORIA_PADRAO_DESPESA: Categoria = 'Outros';
/** Onde cai a receita que nenhuma regra reconheceu. */
export const CATEGORIA_PADRAO_RECEITA: Categoria = 'Outras entradas';

/**
 * Palavra que a propria regra usa para se declarar ambigua.
 *
 * A planilha de origem tem uma regra para `99` com a descricao
 * "99 (verificar: corrida ou food?)", porque a descricao do banco as vezes
 * chega sem o sufixo que distingue. A regra atribui uma categoria util e ao
 * mesmo tempo pede conferencia.
 */
const MARCA_AMBIGUA = 'verificar';

export interface ResultadoCategorizacao {
  readonly categoria: Categoria;
  /** Nome limpo, ja sem o sufixo de parcela e sem a sujeira do extrato. */
  readonly descricao: string;
  readonly formaPagamento?: FormaPagamento;
  readonly status?: StatusDespesa | StatusReceita;
  readonly precisaRevisao: boolean;
  readonly motivoRevisao?: MotivoRevisao;
  /** Qual regra casou. `undefined` quando nenhuma casou. */
  readonly regra?: RegraCategorizacao;
}

/**
 * Encontra a primeira regra aplicavel a esta descricao.
 *
 * DIFERENCA 1 EM RELACAO AO VBA: o original ignorava a coluna "Aplica em" e
 * comparava a descricao contra todas as regras, de despesa e de receita
 * juntas. Uma regra de receita podia entao capturar uma despesa. Aqui o tipo
 * do lancamento filtra a lista antes da busca.
 */
export function encontrarRegra(
  descricaoBanco: string,
  tipo: TipoLancamento,
  regras: readonly RegraCategorizacao[],
): RegraCategorizacao | undefined {
  const descricaoNormalizada = normalizar(corrigirMojibake(descricaoBanco));

  return regras.find((regra) => {
    if (regra.aplicaEm !== tipo) return false;

    const chave = normalizar(regra.palavraChave);
    if (chave.length === 0) return false;

    return descricaoNormalizada.includes(chave);
  });
}

/**
 * Classifica uma descricao de extrato.
 *
 * DIFERENCA 2 EM RELACAO AO VBA: o original devolvia apenas um booleano
 * implicito de revisao. Aqui o motivo e explicito, porque "nenhuma regra
 * reconheceu" e "a regra pediu conferencia" pedem telas diferentes: o
 * primeiro caso quer uma regra nova, o segundo quer uma escolha.
 */
export function categorizar(
  descricaoBanco: string,
  tipo: TipoLancamento,
  regras: readonly RegraCategorizacao[],
): ResultadoCategorizacao {
  // Transferencia entre contas proprias e estorno ja se explicam pela natureza:
  // mandar para a fila de revisao seria pedir a pessoa que classificasse o
  // pagamento da propria fatura. Nos extratos reais do autor isso enchia a fila
  // com 25 das 65 descricoes.
  const natureza = classificarNatureza(descricaoBanco);
  const descricaoLimpa = descricaoSemParcela(corrigirMojibake(descricaoBanco)).trim();
  const regra = encontrarRegra(descricaoBanco, tipo, regras);

  if (regra === undefined) {
    return {
      categoria: tipo === 'despesa' ? CATEGORIA_PADRAO_DESPESA : CATEGORIA_PADRAO_RECEITA,
      descricao: descricaoLimpa,
      precisaRevisao: natureza === undefined,
      ...(natureza === undefined ? { motivoRevisao: 'sem-regra' as const } : {}),
    };
  }

  const descricao =
    regra.descricaoPadrao !== undefined && regra.descricaoPadrao.length > 0
      ? regra.descricaoPadrao
      : descricaoLimpa;

  const ambigua = natureza === undefined && normalizar(descricao).includes(MARCA_AMBIGUA);

  return {
    categoria: regra.categoria,
    descricao,
    ...(regra.formaPagamento !== undefined ? { formaPagamento: regra.formaPagamento } : {}),
    ...(regra.status !== undefined ? { status: regra.status } : {}),
    precisaRevisao: ambigua,
    ...(ambigua ? { motivoRevisao: 'regra-ambigua' as const } : {}),
    regra,
  };
}
