/**
 * Agregacoes que as telas consomem.
 *
 * Toda a aritmetica do painel mora aqui, longe de React, para poder ser
 * conferida em teste. A tela so desenha o que este arquivo devolve.
 *
 * Regra que atravessa tudo: `natureza` manda no somatorio.
 * - `transferencia` nao entra em nada. E o mesmo dinheiro andando de bolso.
 * - `estorno` e uma despesa com sinal trocado: abate a categoria que ele
 *   devolveu, em vez de virar receita.
 */

import { somarMeses } from './data.js';
import { parcelasRestantes } from './parcelas.js';
import type { Competencia, Despesa, Lancamento } from './tipos.js';

export interface LinhaAgrupada {
  readonly chave: string;
  readonly centavos: number;
  readonly quantidade: number;
}

export interface ResumoMes {
  readonly competencia: Competencia;
  /** Despesas com status pago, ja descontados os estornos. */
  readonly despesasPagasCentavos: number;
  /** Despesas ainda pendentes no mes. */
  readonly despesasPendentesCentavos: number;
  readonly receitasRecebidasCentavos: number;
  readonly receitasPendentesCentavos: number;
  /** Recebido menos pago. O numero que responde "sobrou ou faltou". */
  readonly saldoRealizadoCentavos: number;
  /** Como o mes fecha se tudo que esta previsto acontecer. */
  readonly saldoPrevistoCentavos: number;
  /** Transferencias entre contas proprias, fora de qualquer total. */
  readonly transferenciasCentavos: number;
  readonly porCategoria: readonly LinhaAgrupada[];
  readonly porFormaPagamento: readonly LinhaAgrupada[];
  readonly quantidade: number;
  readonly emRevisao: number;
}

function ehContabil(lancamento: Lancamento): boolean {
  return lancamento.natureza !== 'transferencia';
}

/** Quanto este lancamento soma na despesa: estorno entra negativo. */
function pesoDeDespesa(lancamento: Despesa): number {
  return lancamento.natureza === 'estorno' ? -lancamento.valorCentavos : lancamento.valorCentavos;
}

function agrupar(
  lancamentos: readonly Despesa[],
  chaveDe: (lancamento: Despesa) => string,
): LinhaAgrupada[] {
  const mapa = new Map<string, { centavos: number; quantidade: number }>();

  for (const lancamento of lancamentos) {
    const chave = chaveDe(lancamento);
    const atual = mapa.get(chave) ?? { centavos: 0, quantidade: 0 };
    mapa.set(chave, {
      centavos: atual.centavos + pesoDeDespesa(lancamento),
      quantidade: atual.quantidade + 1,
    });
  }

  return [...mapa.entries()]
    .map(([chave, valores]) => ({ chave, ...valores }))
    .sort((a, b) => b.centavos - a.centavos);
}

export function resumirMes(
  lancamentos: readonly Lancamento[],
  competencia: Competencia,
): ResumoMes {
  const doMes = lancamentos.filter((l) => l.competencia === competencia);
  const contabeis = doMes.filter(ehContabil);

  const despesas = contabeis.filter((l): l is Despesa => l.tipo === 'despesa');
  const receitas = contabeis.filter((l) => l.tipo === 'receita');

  const soma = (valores: readonly number[]): number => valores.reduce((a, b) => a + b, 0);

  const despesasPagasCentavos = soma(
    despesas.filter((l) => l.status === 'pago').map(pesoDeDespesa),
  );
  const despesasPendentesCentavos = soma(
    despesas.filter((l) => l.status === 'pendente').map(pesoDeDespesa),
  );
  const receitasRecebidasCentavos = soma(
    receitas.filter((l) => l.status === 'recebido').map((l) => l.valorCentavos),
  );
  const receitasPendentesCentavos = soma(
    receitas.filter((l) => l.status === 'pendente').map((l) => l.valorCentavos),
  );

  return {
    competencia,
    despesasPagasCentavos,
    despesasPendentesCentavos,
    receitasRecebidasCentavos,
    receitasPendentesCentavos,
    saldoRealizadoCentavos: receitasRecebidasCentavos - despesasPagasCentavos,
    saldoPrevistoCentavos:
      receitasRecebidasCentavos +
      receitasPendentesCentavos -
      (despesasPagasCentavos + despesasPendentesCentavos),
    transferenciasCentavos: soma(
      doMes.filter((l) => l.natureza === 'transferencia').map((l) => l.valorCentavos),
    ),
    porCategoria: agrupar(despesas, (l) => l.categoria),
    porFormaPagamento: agrupar(despesas, (l) => l.formaPagamento),
    quantidade: doMes.length,
    emRevisao: doMes.filter((l) => l.precisaRevisao === true).length,
  };
}

/** Competencias que existem nos dados, da mais recente para a mais antiga. */
export function competenciasDisponiveis(
  lancamentos: readonly Lancamento[],
): readonly Competencia[] {
  return [...new Set(lancamentos.map((l) => l.competencia))].sort().reverse();
}

export interface PontoMensal {
  readonly competencia: Competencia;
  readonly despesasCentavos: number;
  readonly receitasCentavos: number;
  readonly saldoCentavos: number;
}

/** Serie do ano para o grafico, da competencia mais antiga para a mais nova. */
export function evolucaoMensal(lancamentos: readonly Lancamento[]): readonly PontoMensal[] {
  return [...competenciasDisponiveis(lancamentos)].reverse().map((competencia) => {
    const resumo = resumirMes(lancamentos, competencia);
    return {
      competencia,
      despesasCentavos: resumo.despesasPagasCentavos + resumo.despesasPendentesCentavos,
      receitasCentavos: resumo.receitasRecebidasCentavos + resumo.receitasPendentesCentavos,
      saldoCentavos: resumo.saldoPrevistoCentavos,
    };
  });
}

export interface CompraParcelada {
  readonly descricao: string;
  readonly valorParcelaCentavos: number;
  readonly total: number;
  readonly ultimaParcelaVista: number;
  readonly restantes: number;
  readonly valorRestanteCentavos: number;
  readonly ultimaCompetencia: Competencia;
  readonly quitacaoPrevista: Competencia;
}

/**
 * Compras parceladas ainda em aberto, da que mais deve para a que menos deve.
 *
 * Agrupa pela descricao ja sem o sufixo de parcela — e por isso que
 * `descricaoSemParcela` existe. Considera a maior parcela vista de cada
 * compra: se o extrato de junho mostra a 4 de 8, faltam quatro.
 */
export function comprasParceladas(
  lancamentos: readonly Lancamento[],
): readonly CompraParcelada[] {
  const porCompra = new Map<string, CompraParcelada>();

  for (const lancamento of lancamentos) {
    if (lancamento.tipo !== 'despesa' || lancamento.parcela === undefined) continue;

    const chave = `${lancamento.descricao}|${String(lancamento.parcela.total)}`;
    const anterior = porCompra.get(chave);
    if (anterior !== undefined && anterior.ultimaParcelaVista >= lancamento.parcela.atual) continue;

    const restantes = parcelasRestantes(lancamento.parcela);

    porCompra.set(chave, {
      descricao: lancamento.descricao,
      valorParcelaCentavos: lancamento.valorCentavos,
      total: lancamento.parcela.total,
      ultimaParcelaVista: lancamento.parcela.atual,
      restantes,
      valorRestanteCentavos: restantes * lancamento.valorCentavos,
      ultimaCompetencia: lancamento.competencia,
      quitacaoPrevista: somarMeses(lancamento.competencia, restantes),
    });
  }

  return [...porCompra.values()]
    .filter((compra) => compra.restantes > 0)
    .sort((a, b) => b.valorRestanteCentavos - a.valorRestanteCentavos);
}

export interface CompromissoFuturo {
  readonly competencia: Competencia;
  readonly centavos: number;
}

/**
 * Quanto das proximas faturas ja esta comprometido por parcelamento.
 *
 * E a informacao que o aplicativo do banco nao mostra e que mais muda decisao:
 * antes de parcelar mais uma coisa, quanto dos proximos meses ja foi gasto.
 */
export function comprometimentoFuturo(
  lancamentos: readonly Lancamento[],
  meses = 12,
): readonly CompromissoFuturo[] {
  const acumulado = new Map<Competencia, number>();

  for (const compra of comprasParceladas(lancamentos)) {
    for (let i = 1; i <= Math.min(compra.restantes, meses); i++) {
      const competencia = somarMeses(compra.ultimaCompetencia, i);
      acumulado.set(competencia, (acumulado.get(competencia) ?? 0) + compra.valorParcelaCentavos);
    }
  }

  return [...acumulado.entries()]
    .map(([competencia, centavos]) => ({ competencia, centavos }))
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
}

export type Escopo = 'pessoal' | 'empresa';

/**
 * Receita reconhecida em cada competencia, para alimentar o modulo fiscal.
 *
 * Transferencia fica de fora: pagamento de fatura e resgate de investimento
 * nao sao faturamento. Com `escopo`, soma so o que foi marcado como da empresa
 * — que e o que separa o DAS da vida pessoal de quem mistura as duas contas.
 */
export function receitasPorCompetencia(
  lancamentos: readonly Lancamento[],
  escopo?: Escopo,
): ReadonlyMap<Competencia, number> {
  const mapa = new Map<Competencia, number>();

  for (const lancamento of lancamentos) {
    if (lancamento.tipo !== 'receita' || lancamento.natureza !== undefined) continue;
    if (escopo !== undefined && lancamento.escopo !== escopo) continue;

    mapa.set(
      lancamento.competencia,
      (mapa.get(lancamento.competencia) ?? 0) + lancamento.valorCentavos,
    );
  }

  return mapa;
}

/**
 * Se a pessoa ja separou alguma coisa entre pessoal e empresa.
 *
 * Enquanto nao separou, o modulo fiscal soma tudo e avisa; a partir do
 * primeiro lancamento marcado, ele passa a confiar na separacao dela.
 */
export function temEscopoMarcado(lancamentos: readonly Lancamento[]): boolean {
  return lancamentos.some((lancamento) => lancamento.escopo !== undefined);
}
