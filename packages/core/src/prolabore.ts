/**
 * Pró-labore: INSS e IRRF do sócio.
 *
 * É o único DARF que uma empresa do Simples Nacional costuma encontrar. IRPJ,
 * IPI, CSLL, COFINS, PIS e CPP já estão dentro do DAS pelo art. 13 da LC
 * 123/2006 — quem está no Simples não recolhe nada disso em DARF. O que sai à
 * parte é o que incide sobre a retirada do sócio:
 *
 *   - INSS de 11% retido do pró-labore, em DARF previdenciário consolidado na
 *     DCTFWeb, até o dia 20 do mês seguinte;
 *   - IRRF, quando houver, até o último dia útil do mês seguinte;
 *   - e, só no Anexo IV, os 20% patronais, porque nesse anexo a contribuição
 *     patronal não está no DAS.
 *
 * A NOVIDADE DE 2026 QUE MUDA TUDO NESTA CONTA: a Lei 15.270/2025 criou um
 * redutor que zera o imposto até R$ 5.000 por mês e diminui gradualmente até
 * sumir em R$ 7.350. Ele é aplicado DEPOIS da tabela progressiva, sobre o
 * imposto calculado, e nunca deixa o imposto negativo.
 *
 * Duas conferências que a própria lei permite fazer, e que estão nos testes:
 * o redutor zera exatamente em R$ 7.350, e em R$ 5.000 ele é igual ao imposto
 * devido — que é como a isenção "até cinco mil" acontece na prática.
 */

import dados from '../dados/pessoa-fisica-2026.json';

export interface FaixaIrrf {
  readonly ate: number;
  readonly aliquotaBase: number;
  readonly deduzirCentavos: number;
}

interface TabelaPessoaFisica {
  readonly anoVigencia: number;
  readonly fundamento: string;
  readonly conferidoEm: string;
  readonly irrf: {
    readonly faixas: readonly FaixaIrrf[];
    readonly dependenteCentavos: number;
    readonly descontoSimplificadoCentavos: number;
    readonly redutorBaseCentavos: number;
    readonly redutorCoeficienteMilionesimos: number;
    readonly redutorTetoRendimentoCentavos: number;
  };
  readonly inss: {
    readonly salarioMinimoCentavos: number;
    readonly tetoCentavos: number;
    readonly aliquotaProLaboreBase: number;
    readonly aliquotaPatronalAnexoIVBase: number;
  };
}

export const TABELA_PESSOA_FISICA = dados as TabelaPessoaFisica;

export type AvisoProLabore =
  /** Pró-labore abaixo do salário mínimo: o INSS incide sobre o mínimo mesmo assim. */
  | 'abaixo-do-minimo'
  /** Contribuição travada no teto do INSS. */
  | 'no-teto-do-inss'
  /** Não há IRRF a reter: o redutor da Lei 15.270/2025 zerou o imposto. */
  | 'isento-pelo-redutor';

export interface EntradaProLabore {
  readonly proLaboreCentavos: number;
  readonly dependentes?: number;
  /** Pensão alimentícia, previdência complementar e outras deduções legais. */
  readonly outrasDeducoesCentavos?: number;
  /** No Anexo IV a contribuição patronal não está no DAS e sai à parte. */
  readonly anexoIV?: boolean;
}

export interface ResultadoProLabore {
  readonly proLaboreCentavos: number;
  readonly inss: {
    readonly baseCentavos: number;
    readonly contribuicaoCentavos: number;
  };
  readonly irrf: {
    readonly deducaoLegalCentavos: number;
    readonly descontoSimplificadoCentavos: number;
    readonly deducaoUsada: 'legal' | 'simplificado';
    readonly baseCentavos: number;
    readonly aliquotaNominalPercentual: number;
    readonly impostoPelaTabelaCentavos: number;
    readonly redutorCentavos: number;
    readonly impostoCentavos: number;
  };
  /** Contribuição patronal, só no Anexo IV. Zero nos demais. */
  readonly patronalCentavos: number;
  /** O que sobra na mão do sócio depois das retenções. */
  readonly liquidoCentavos: number;
  readonly avisos: readonly AvisoProLabore[];
}

function exigirCentavos(valor: number, nome: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser um inteiro de centavos maior ou igual a zero.`);
  }
}

/** Divisão inteira arredondando meio para cima, como a guia faz. */
function dividirArredondando(numerador: bigint, denominador: bigint): number {
  return Number((2n * numerador + denominador) / (2n * denominador));
}

/**
 * INSS do sócio: 11% sobre o pró-labore.
 *
 * A base tem piso no salário mínimo — retirar menos que isso não reduz a
 * contribuição — e teto no limite previdenciário do ano.
 */
export function calcularInssProLabore(proLaboreCentavos: number): {
  baseCentavos: number;
  contribuicaoCentavos: number;
} {
  exigirCentavos(proLaboreCentavos, 'Pró-labore');

  const { salarioMinimoCentavos, tetoCentavos, aliquotaProLaboreBase } = TABELA_PESSOA_FISICA.inss;
  const base = Math.min(Math.max(proLaboreCentavos, salarioMinimoCentavos), tetoCentavos);

  return {
    baseCentavos: base,
    contribuicaoCentavos: dividirArredondando(
      BigInt(base) * BigInt(aliquotaProLaboreBase),
      10000n,
    ),
  };
}

function faixaDoIrrf(baseCentavos: number): FaixaIrrf {
  const faixas = TABELA_PESSOA_FISICA.irrf.faixas;
  return faixas.find((faixa) => baseCentavos <= faixa.ate) ?? (faixas[faixas.length - 1] as FaixaIrrf);
}

/**
 * Redutor da Lei 15.270/2025.
 *
 * `978,62 − 0,133145 × rendimento`, calculado sobre o rendimento BRUTO e não
 * sobre a base já deduzida — foi assim que a Receita fez nos exemplos
 * oficiais. Some acima de R$ 7.350.
 */
export function calcularRedutor(rendimentoCentavos: number): number {
  exigirCentavos(rendimentoCentavos, 'Rendimento');

  const { redutorBaseCentavos, redutorCoeficienteMilionesimos, redutorTetoRendimentoCentavos } =
    TABELA_PESSOA_FISICA.irrf;

  if (rendimentoCentavos > redutorTetoRendimentoCentavos) return 0;

  const desconto = dividirArredondando(
    BigInt(rendimentoCentavos) * BigInt(redutorCoeficienteMilionesimos),
    1000000n,
  );

  return Math.max(0, redutorBaseCentavos - desconto);
}

export function calcularProLabore(entrada: EntradaProLabore): ResultadoProLabore {
  exigirCentavos(entrada.proLaboreCentavos, 'Pró-labore');

  const avisos: AvisoProLabore[] = [];
  const { irrf, inss } = TABELA_PESSOA_FISICA;

  const contribuicao = calcularInssProLabore(entrada.proLaboreCentavos);

  if (entrada.proLaboreCentavos < inss.salarioMinimoCentavos) avisos.push('abaixo-do-minimo');
  if (entrada.proLaboreCentavos > inss.tetoCentavos) avisos.push('no-teto-do-inss');

  const dependentes = entrada.dependentes ?? 0;
  const outras = entrada.outrasDeducoesCentavos ?? 0;
  exigirCentavos(outras, 'Outras deduções');

  const deducaoLegal =
    contribuicao.contribuicaoCentavos + dependentes * irrf.dependenteCentavos + outras;

  // A pessoa fica com o que for melhor para ela, que é o que a lei manda.
  const usarSimplificado = irrf.descontoSimplificadoCentavos > deducaoLegal;
  const deducao = usarSimplificado ? irrf.descontoSimplificadoCentavos : deducaoLegal;

  const base = Math.max(0, entrada.proLaboreCentavos - deducao);
  const faixa = faixaDoIrrf(base);

  const impostoPelaTabela = Math.max(
    0,
    dividirArredondando(BigInt(base) * BigInt(faixa.aliquotaBase), 10000n) - faixa.deduzirCentavos,
  );

  // O redutor abate o imposto, nunca vira crédito.
  const redutor = Math.min(calcularRedutor(entrada.proLaboreCentavos), impostoPelaTabela);
  const imposto = impostoPelaTabela - redutor;

  if (imposto === 0 && impostoPelaTabela > 0) avisos.push('isento-pelo-redutor');

  const patronal =
    entrada.anexoIV === true
      ? dividirArredondando(
          BigInt(contribuicao.baseCentavos) * BigInt(inss.aliquotaPatronalAnexoIVBase),
          10000n,
        )
      : 0;

  return {
    proLaboreCentavos: entrada.proLaboreCentavos,
    inss: contribuicao,
    irrf: {
      deducaoLegalCentavos: deducaoLegal,
      descontoSimplificadoCentavos: irrf.descontoSimplificadoCentavos,
      deducaoUsada: usarSimplificado ? 'simplificado' : 'legal',
      baseCentavos: base,
      aliquotaNominalPercentual: faixa.aliquotaBase / 100,
      impostoPelaTabelaCentavos: impostoPelaTabela,
      redutorCentavos: redutor,
      impostoCentavos: imposto,
    },
    patronalCentavos: patronal,
    liquidoCentavos: entrada.proLaboreCentavos - contribuicao.contribuicaoCentavos - imposto,
    avisos,
  };
}
