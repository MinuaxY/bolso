import { describe, expect, it } from 'vitest';

import {
  descricaoSemParcela,
  detectarParcela,
  parcelasRestantes,
  valorRestanteCentavos,
} from './parcelas.js';

describe('detectarParcela', () => {
  // Estas descricoes sao o formato real emitido pelo Nubank, conferido nos
  // extratos de dezembro de 2025 a julho de 2026.
  it('le o formato que o banco realmente emite', () => {
    expect(detectarParcela('Amazon Marketplace Cc - Parcela 4/8')).toEqual({ atual: 4, total: 8 });
    expect(detectarParcela('Amsacessoriosltda - Parcela 3/6')).toEqual({ atual: 3, total: 6 });
  });

  it('aceita a ultima parcela', () => {
    expect(detectarParcela('Amazon Marketplace Cc - Parcela 4/4')).toEqual({ atual: 4, total: 4 });
  });

  it('nao se importa com caixa nem com espaco em volta da barra', () => {
    expect(detectarParcela('LOJA - PARCELA 2 / 12')).toEqual({ atual: 2, total: 12 });
  });

  it('devolve null quando nao ha parcela', () => {
    expect(detectarParcela('99food *Jyk Food')).toBeNull();
  });

  it('exige a palavra "parcela": barra solta e ambigua demais', () => {
    // Pode ser data, medida, ou parte do nome do estabelecimento.
    expect(detectarParcela('Estacionamento 24/7')).toBeNull();
    expect(detectarParcela('Pizzaria 1/2 Metro')).toBeNull();
  });

  it('rejeita numeracao impossivel', () => {
    expect(detectarParcela('Loja - Parcela 5/3')).toBeNull();
    expect(detectarParcela('Loja - Parcela 0/6')).toBeNull();
  });
});

describe('descricaoSemParcela', () => {
  it('corta o sufixo para as parcelas de uma compra se reconhecerem', () => {
    expect(descricaoSemParcela('Amazon Marketplace Cc - Parcela 4/8')).toBe(
      'Amazon Marketplace Cc',
    );
  });

  it('devolve as parcelas de uma mesma compra sob o mesmo nome', () => {
    const terceira = descricaoSemParcela('Amsacessoriosltda - Parcela 3/6');
    const quarta = descricaoSemParcela('Amsacessoriosltda - Parcela 4/6');
    expect(terceira).toBe(quarta);
  });

  it('nao mexe em descricao sem parcela', () => {
    expect(descricaoSemParcela('99app *99app')).toBe('99app *99app');
  });
});

describe('quanto ainda falta', () => {
  it('conta as parcelas que ainda vao cair', () => {
    expect(parcelasRestantes({ atual: 3, total: 10 })).toBe(7);
    expect(parcelasRestantes({ atual: 10, total: 10 })).toBe(0);
  });

  it('soma o que ainda esta comprometido nas proximas faturas', () => {
    // 7 parcelas de R$ 63,00 ainda por vir.
    expect(valorRestanteCentavos({ atual: 3, total: 10 }, 6300)).toBe(44100);
  });
});
