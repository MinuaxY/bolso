/**
 * Deteccao de assinatura recorrente.
 *
 * E a primeira razao de existir que o README lista: o aplicativo do banco
 * mostra o que saiu, mas nao avisa da assinatura que voce esqueceu que
 * assinou. E ninguem cancela por causa do valor do mes — R$ 34,90 nao doi.
 * Cancela quando ve os R$ 418,80 do ano, que e o numero que este arquivo
 * existe para calcular.
 *
 * Achar o que se repete e facil. O dificil e nao confundir, e sao tres
 * confusoes diferentes:
 *
 * 1. PARCELA E IDENTICA A ASSINATURA no extrato: mesma loja, mesmo valor,
 *    todo mes. A diferenca e que a parcela acaba — e o lancamento ja sabe
 *    disso, no campo `parcela`. Sem esta exclusao, toda compra em 10x viraria
 *    "assinatura" e o custo anual projetado seria ficcao.
 * 2. MERCADO NAO E ASSINATURA. Quem compra oito vezes por mes no mesmo
 *    mercado tem oito lancamentos parecidos todo mes; assinatura cobra uma
 *    vez. O que separa os dois nao e o valor, e a frequencia.
 * 3. PRECO DE ASSINATURA MUDA. Reajuste anual e servico cobrado em dolar
 *    mexem no valor. Exigir valor exato perderia justamente as assinaturas
 *    mais caras, que sao as que mais interessam.
 *
 * O que este arquivo NAO detecta, de proposito: assinatura anual. Uma
 * cobranca por ano nao tem como ser distinguida de uma compra avulsa dentro
 * de um extrato de poucos meses, e chutar aqui seria inventar.
 */

import { partesDaCompetencia } from './data.js';
import { detectarParcela } from './parcelas.js';
import { normalizar } from './texto.js';
import type { Categoria, Competencia, Despesa, Lancamento } from './tipos.js';

export type SituacaoAssinatura =
  /** Ainda cobrando: apareceu no mes mais recente do extrato, ou no anterior. */
  | 'ativa'
  /** Tem historico e parou. Ou foi cancelada, ou a cobranca falhou. */
  | 'encerrada';

export interface Assinatura {
  readonly descricao: string;
  readonly categoria: Categoria;
  /** Valor da cobranca mais recente. */
  readonly valorCentavos: number;
  /**
   * Doze vezes o valor atual. E uma projecao, nao um extrato: vale enquanto a
   * assinatura seguir cobrando o que cobra hoje. E o numero que muda decisao.
   */
  readonly anualCentavos: number;
  /** Tudo que ja foi cobrado dentro do periodo importado, somado. */
  readonly totalPagoCentavos: number;
  /** Em quantas competencias distintas houve cobranca. */
  readonly meses: number;
  readonly primeiraCompetencia: Competencia;
  readonly ultimaCompetencia: Competencia;
  readonly situacao: SituacaoAssinatura;
  /**
   * Quanto a cobranca subiu da primeira vista ate a atual, quando subiu o
   * bastante para nao ser variacao de cambio.
   */
  readonly aumentoCentavos?: number;
}

export interface OpcoesAssinatura {
  /** Quantas competencias distintas bastam para afirmar que ha um padrao. */
  readonly minimoMeses?: number;
  /** Quanto o valor pode variar em torno da mediana e ainda ser a mesma assinatura. */
  readonly tolerancia?: number;
}

/**
 * Tres meses. Dois pontos nao sao um padrao: duas compras iguais no mesmo
 * lugar em meses seguidos acontecem o tempo todo sem haver assinatura
 * nenhuma, e um falso positivo aqui vira um custo anual inventado na tela.
 */
const MINIMO_MESES = 3;

/**
 * 15% em torno da mediana. Cobre reajuste anual (a Netflix subiu 12,5% em
 * 2025) e a variacao de quem cobra em dolar, sem abrir tanto a ponto de duas
 * compras diferentes no mesmo lugar virarem a mesma assinatura.
 */
const TOLERANCIA = 0.15;

/** Abaixo disto, "aumento" e ruido de cambio, nao reajuste. */
const AUMENTO_MINIMO = 0.02;

interface Cobranca {
  readonly competencia: Competencia;
  readonly valorCentavos: number;
}

/** Quantos meses separam duas competencias. Negativo se a segunda for anterior. */
function distanciaEmMeses(de: Competencia, ate: Competencia): number {
  const a = partesDaCompetencia(de);
  const b = partesDaCompetencia(ate);
  return (b.ano - a.ano) * 12 + (b.mes - a.mes);
}

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[meio] ?? 0;
  return Math.round(((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2);
}

/**
 * Se este lancamento pode ser uma cobranca de assinatura.
 *
 * Parcela sai porque acaba; transferencia e estorno saem porque nao sao
 * compra. Receita nem chega aqui.
 */
function podeSerAssinatura(lancamento: Lancamento): lancamento is Despesa {
  if (lancamento.tipo !== 'despesa') return false;
  if (lancamento.natureza !== undefined) return false;
  if (lancamento.parcela !== undefined) return false;
  // Lancamento digitado a mao pode trazer a parcela so no texto.
  return detectarParcela(lancamento.descricao) === null;
}

/**
 * Agrupa por estabelecimento. A descricao ja chega limpa da regra de
 * categorizacao — `99food *Jyk Food` virou `99Food` na importacao —, entao
 * aqui basta normalizar caixa e acento.
 */
function chaveDe(lancamento: Despesa): string {
  return normalizar(lancamento.descricao);
}

/**
 * Decide se uma serie de cobrancas do mesmo lugar e uma assinatura.
 *
 * Devolve `null` quando nao e, e o motivo de nao ser esta no corpo: poucos
 * meses, cobranca demais por mes, buraco grande no meio, ou valor instavel.
 */
function avaliarSerie(
  cobrancas: readonly Cobranca[],
  minimoMeses: number,
  tolerancia: number,
): { readonly meses: number; readonly valores: readonly number[] } | null {
  const competencias = new Set(cobrancas.map((c) => c.competencia));
  const meses = competencias.size;
  if (meses < minimoMeses) return null;

  // Mercado nao e assinatura: assinatura cobra uma vez por mes. Uma cobranca
  // extra em todo o historico passa — cobranca duplicada acontece, e quem tem
  // uma assinatura cobrada duas vezes precisa justamente ver isso.
  if (cobrancas.length > meses + 1) return null;

  // Buraco no meio. Um mes sem cobranca e cartao trocado ou cobranca que
  // falhou e voltou; dois meses ja e outra coisa, nao um padrao mensal.
  const primeira = cobrancas[0]?.competencia ?? '';
  const ultima = cobrancas[cobrancas.length - 1]?.competencia ?? '';
  const janela = distanciaEmMeses(primeira, ultima) + 1;
  if (janela - meses > 1) return null;

  const valores = cobrancas.map((c) => c.valorCentavos);
  const centro = mediana(valores);
  const dentro = valores.filter((v) => Math.abs(v - centro) <= centro * tolerancia).length;
  if (dentro < Math.ceil(valores.length * (2 / 3))) return null;

  return { meses, valores };
}

/**
 * Assinaturas encontradas no extrato, da mais cara por ano para a mais
 * barata, com as encerradas no fim.
 *
 * Precisa de pelo menos tres meses de extrato importado para encontrar
 * qualquer coisa — ver `MINIMO_MESES`. Com menos que isso devolve vazio, e a
 * tela e que explica por que.
 */
export function detectarAssinaturas(
  lancamentos: readonly Lancamento[],
  opcoes: OpcoesAssinatura = {},
): readonly Assinatura[] {
  const minimoMeses = opcoes.minimoMeses ?? MINIMO_MESES;
  const tolerancia = opcoes.tolerancia ?? TOLERANCIA;

  const candidatos = lancamentos.filter(podeSerAssinatura);
  if (candidatos.length === 0) return [];

  // O "hoje" dos dados e a competencia mais recente que existe no extrato
  // inteiro, e nao a data da maquina: quem importa em outubro um extrato que
  // vai ate agosto nao tem nenhuma assinatura encerrada por isso.
  const maisRecente = lancamentos
    .map((l) => l.competencia)
    .reduce((a, b) => (a > b ? a : b));

  const grupos = new Map<string, Despesa[]>();
  for (const lancamento of candidatos) {
    const chave = chaveDe(lancamento);
    const grupo = grupos.get(chave);
    if (grupo === undefined) grupos.set(chave, [lancamento]);
    else grupo.push(lancamento);
  }

  const encontradas: Assinatura[] = [];

  for (const grupo of grupos.values()) {
    const ordenado = [...grupo].sort((a, b) => a.competencia.localeCompare(b.competencia));
    const cobrancas: Cobranca[] = ordenado.map((l) => ({
      competencia: l.competencia,
      valorCentavos: l.valorCentavos,
    }));

    const serie = avaliarSerie(cobrancas, minimoMeses, tolerancia);
    if (serie === null) continue;

    const primeiro = ordenado[0] as Despesa;
    const ultimo = ordenado[ordenado.length - 1] as Despesa;
    const valorCentavos = ultimo.valorCentavos;
    const aumento = valorCentavos - primeiro.valorCentavos;

    encontradas.push({
      descricao: ultimo.descricao,
      categoria: ultimo.categoria,
      valorCentavos,
      anualCentavos: valorCentavos * 12,
      totalPagoCentavos: serie.valores.reduce((a, b) => a + b, 0),
      meses: serie.meses,
      primeiraCompetencia: primeiro.competencia,
      ultimaCompetencia: ultimo.competencia,
      situacao: distanciaEmMeses(ultimo.competencia, maisRecente) <= 1 ? 'ativa' : 'encerrada',
      ...(aumento > primeiro.valorCentavos * AUMENTO_MINIMO ? { aumentoCentavos: aumento } : {}),
    });
  }

  return encontradas.sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === 'ativa' ? -1 : 1;
    return b.anualCentavos - a.anualCentavos;
  });
}

/**
 * Quanto as assinaturas ativas custam por ano, somadas.
 *
 * So as ativas: somar o que ja foi cancelado inflaria o numero que a pessoa
 * usa para decidir, e e justamente o numero que precisa ser confiavel.
 */
export function custoAnualCentavos(assinaturas: readonly Assinatura[]): number {
  return assinaturas
    .filter((a) => a.situacao === 'ativa')
    .reduce((total, a) => total + a.anualCentavos, 0);
}
