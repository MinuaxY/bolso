/**
 * Metas de gasto por categoria.
 *
 * E a unica funcionalidade do MVP que a planilha de origem nao tem, e ela
 * muda o que o Bolso faz: registrar o passado e diagnostico, meta e o que
 * muda comportamento enquanto o mes ainda esta acontecendo.
 *
 * Por isso o numero mais importante daqui nao e quanto ja foi gasto — e a
 * PROJECAO: mantido o ritmo ate aqui, em quanto o mes fecha. Saber no dia 12
 * que o mes vai estourar ainda da tempo de fazer algo; saber no dia 30 e so
 * constatacao.
 */

import { diasNoMes, partesDaCompetencia, partesDe } from './data.js';
import { resumirMes } from './relatorios.js';
import type { Competencia, DataCivil, Lancamento } from './tipos.js';

export interface Meta {
  readonly categoria: string;
  /** Teto mensal de gasto naquela categoria. */
  readonly limiteCentavos: number;
}

export type SituacaoMeta =
  /** Dentro do teto e no ritmo. */
  | 'tranquilo'
  /** Passou de 80% do teto, ou o ritmo aponta para estouro. */
  | 'atencao'
  /** Ja passou do teto. */
  | 'estourou';

export interface AvaliacaoMeta {
  readonly categoria: string;
  readonly limiteCentavos: number;
  readonly gastoCentavos: number;
  /** Negativo quando ja passou do teto. */
  readonly restanteCentavos: number;
  readonly percentual: number;
  readonly situacao: SituacaoMeta;
  /**
   * Em quanto o mes fecha mantendo o ritmo. Ausente quando o mes ja acabou ou
   * ainda nem comecou — projetar ai seria inventar.
   */
  readonly projecaoCentavos?: number;
  readonly diaDoMes?: number;
}

/** A partir de quanto do teto a meta acende o amarelo. */
const LIMIAR_ATENCAO = 0.8;

/**
 * Projeta o fechamento do mes pelo ritmo ate agora.
 *
 * Regra de tres simples sobre os dias corridos. Nao tenta ser esperta com dia
 * de semana ou sazonalidade: a pessoa entende "gastei 400 em 10 dias, o mes
 * fecha em 1200", e uma projecao que ela nao entende nao muda decisao nenhuma.
 */
function projetar(gastoCentavos: number, diaDoMes: number, diasDoMes: number): number {
  if (diaDoMes <= 0) return gastoCentavos;
  return Math.round((gastoCentavos / diaDoMes) * diasDoMes);
}

export function avaliarMetas(
  lancamentos: readonly Lancamento[],
  competencia: Competencia,
  metas: readonly Meta[],
  hoje?: DataCivil,
): readonly AvaliacaoMeta[] {
  const porCategoria = new Map(
    resumirMes(lancamentos, competencia).porCategoria.map((linha) => [linha.chave, linha.centavos]),
  );

  const { ano, mes } = partesDaCompetencia(competencia);
  const diasDoMes = diasNoMes(ano, mes);

  // So projeta se o mes de referencia for o mes em que estamos.
  let diaDoMes: number | undefined;
  if (hoje !== undefined) {
    const agora = partesDe(hoje);
    if (agora.ano === ano && agora.mes === mes) diaDoMes = agora.dia;
  }

  return metas
    .filter((meta) => meta.limiteCentavos > 0)
    .map((meta) => {
      const gasto = Math.max(0, porCategoria.get(meta.categoria) ?? 0);
      const percentual = (gasto / meta.limiteCentavos) * 100;
      // Sem gasto nenhum nao ha ritmo para projetar, e "fecha em R$ 0,00" e
      // ruido: a categoria ainda nao comecou.
      const projecao =
        diaDoMes === undefined || gasto === 0 ? undefined : projetar(gasto, diaDoMes, diasDoMes);

      const estourou = gasto > meta.limiteCentavos;
      const vaiEstourar = projecao !== undefined && projecao > meta.limiteCentavos;

      const situacao: SituacaoMeta = estourou
        ? 'estourou'
        : percentual >= LIMIAR_ATENCAO * 100 || vaiEstourar
          ? 'atencao'
          : 'tranquilo';

      return {
        categoria: meta.categoria,
        limiteCentavos: meta.limiteCentavos,
        gastoCentavos: gasto,
        restanteCentavos: meta.limiteCentavos - gasto,
        percentual,
        situacao,
        ...(projecao !== undefined ? { projecaoCentavos: projecao } : {}),
        ...(diaDoMes !== undefined ? { diaDoMes } : {}),
      };
    })
    .sort((a, b) => b.percentual - a.percentual);
}

/** Quanto foi orcado e quanto ja foi gasto no conjunto das metas. */
export function totalizarMetas(avaliacoes: readonly AvaliacaoMeta[]): {
  limiteCentavos: number;
  gastoCentavos: number;
  estouradas: number;
} {
  return {
    limiteCentavos: avaliacoes.reduce((soma, a) => soma + a.limiteCentavos, 0),
    gastoCentavos: avaliacoes.reduce((soma, a) => soma + a.gastoCentavos, 0),
    estouradas: avaliacoes.filter((a) => a.situacao === 'estourou').length,
  };
}
