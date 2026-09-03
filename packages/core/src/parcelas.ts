/**
 * Deteccao de compra parcelada.
 *
 * Traduz `DetectarParcela` e `ExtractBaseDesc` do VBA de origem.
 *
 * O formato reconhecido e o que o Nubank realmente emite, conferido nos
 * extratos de dezembro de 2025 a julho de 2026:
 *
 *     Amazon Marketplace Cc - Parcela 4/8
 *     Amsacessoriosltda - Parcela 3/6
 */

import type { Parcela } from './tipos.js';

/**
 * `Parcela 3/10` em qualquer lugar da descricao, com ou sem espaco em volta
 * da barra. A palavra e obrigatoria de proposito: um `3/10` solto tanto pode
 * ser parcela quanto data, medida ou parte do nome do estabelecimento.
 */
const PADRAO_PARCELA = /parcela\s+(\d{1,3})\s*\/\s*(\d{1,3})/i;

/** Onde comeca o sufixo de parcela, para poder cortar a descricao antes dele. */
const INICIO_SUFIXO = /\s*[-–—]?\s*parcela\s+\d{1,3}\s*\/\s*\d{1,3}.*$/i;

/**
 * Le `3/10` de uma descricao de extrato. Devolve `null` quando nao ha parcela
 * ou quando os numeros nao fazem sentido — parcela 5 de 3 e ruido, nao compra.
 */
export function detectarParcela(descricao: string): Parcela | null {
  const encontrado = PADRAO_PARCELA.exec(descricao);
  if (encontrado === null) return null;

  const atual = Number(encontrado[1]);
  const total = Number(encontrado[2]);

  if (atual < 1 || total < 1 || atual > total) return null;

  return { atual, total };
}

/**
 * Devolve a descricao sem o sufixo de parcela, que e o nome pelo qual as
 * parcelas de uma mesma compra se reconhecem entre si.
 *
 * `Amazon Marketplace Cc - Parcela 4/8` vira `Amazon Marketplace Cc`.
 */
export function descricaoSemParcela(descricao: string): string {
  return descricao.replace(INICIO_SUFIXO, '').trim();
}

/** Quantas parcelas ainda vao cair depois desta. */
export function parcelasRestantes(parcela: Parcela): number {
  return parcela.total - parcela.atual;
}

/**
 * Quanto da compra ainda esta em aberto, contando a parcela atual como ja
 * lancada. E o numero que importa antes de parcelar mais uma coisa.
 */
export function valorRestanteCentavos(parcela: Parcela, valorParcelaCentavos: number): number {
  return parcelasRestantes(parcela) * valorParcelaCentavos;
}
