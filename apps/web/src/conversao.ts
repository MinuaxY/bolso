/**
 * De linha de extrato para lancamento do dominio.
 *
 * E aqui que o dado cru ganha categoria, competencia e parcela — as tres
 * coisas que o arquivo do banco nao tem e que fazem o painel existir.
 */

import {
  categorizar,
  competenciaDaCompra,
  competenciaDeDebito,
  detectarParcela,
  normalizar,
} from '@bolso/core';
import type { Despesa, ItemDeduplicavel, Lancamento, RegraCategorizacao } from '@bolso/core';
import type { IdFonte, LancamentoImportado } from '@bolso/parsers';

export interface ContextoImportacao {
  readonly fonte: IdFonte;
  readonly arquivo: string;
  readonly diaFechamento: number;
  readonly regras: readonly RegraCategorizacao[];
  /**
   * Compra no cartao segue o ciclo de fechamento; movimento de conta segue o
   * calendario. E a unica coisa que o leitor nao consegue decidir sozinho num
   * arquivo de banco desconhecido, entao a tela pergunta.
   */
  readonly ehCartao: boolean;
  readonly conta: string;
}

function identificador(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${String(Date.now())}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adivinha a forma de pagamento pela descricao de um extrato de conta. */
function formaProvavel(descricao: string): string {
  const texto = normalizar(descricao);
  if (texto.includes('pix')) return 'Pix';
  if (texto.includes('debito')) return 'Debito';
  if (texto.includes('boleto')) return 'Boleto';
  if (texto.includes('transferencia')) return 'Transferencia';
  return 'Outro';
}

export function converter(
  importado: LancamentoImportado,
  contexto: ContextoImportacao,
): Lancamento {
  const classificacao = categorizar(importado.descricaoOriginal, importado.tipo, contexto.regras);

  const competencia = contexto.ehCartao
    ? competenciaDaCompra(importado.data, contexto.diaFechamento)
    : competenciaDeDebito(importado.data);

  const base = {
    id: identificador(),
    data: importado.data,
    competencia,
    valorCentavos: importado.valorCentavos,
    descricao: classificacao.descricao,
    categoria: classificacao.categoria,
    origem: {
      descricaoOriginal: importado.descricaoOriginal,
      arquivo: contexto.arquivo,
      fonte: contexto.fonte,
      ...(importado.identificadorBanco !== undefined
        ? { identificadorBanco: importado.identificadorBanco }
        : {}),
    },
    ...(classificacao.precisaRevisao
      ? {
          precisaRevisao: true,
          ...(classificacao.motivoRevisao !== undefined
            ? { motivoRevisao: classificacao.motivoRevisao }
            : {}),
        }
      : {}),
    ...(importado.natureza !== undefined ? { natureza: importado.natureza } : {}),
  };

  if (importado.tipo === 'receita') {
    return {
      ...base,
      tipo: 'receita',
      status: classificacao.status === 'pendente' ? 'pendente' : 'recebido',
      conta: contexto.conta,
    };
  }

  // A fatura da XP tem coluna de parcela; a do Nubank so escreve na descricao.
  // Quando o arquivo informa, ele vence — ler texto e o ultimo recurso.
  const parcela = importado.parcela ?? detectarParcela(importado.descricaoOriginal);

  const despesa: Despesa = {
    ...base,
    tipo: 'despesa',
    status: classificacao.status === 'pendente' ? 'pendente' : 'pago',
    // O arquivo vence a regra: numa fatura de cartao, tudo foi no credito,
    // mesmo que a regra de categorizacao chute outra forma. A forma da regra
    // so vale quando a origem nao sabe — lancamento manual ou arquivo generico.
    formaPagamento: contexto.ehCartao
      ? 'Credito'
      : (classificacao.formaPagamento ?? formaProvavel(importado.descricaoOriginal)),
    ...(parcela !== null && parcela !== undefined ? { parcela } : {}),
  };

  return despesa;
}

/** Adapta um lancamento ja gravado para a comparacao de duplicidade. */
export function paraComparacao(lancamento: Lancamento): ItemDeduplicavel {
  return {
    data: lancamento.data,
    valorCentavos: lancamento.valorCentavos,
    descricaoOriginal: lancamento.origem?.descricaoOriginal ?? lancamento.descricao,
    ...(lancamento.origem?.identificadorBanco !== undefined
      ? { identificadorBanco: lancamento.origem.identificadorBanco }
      : {}),
    ...(lancamento.natureza !== undefined ? { natureza: lancamento.natureza } : {}),
  };
}
