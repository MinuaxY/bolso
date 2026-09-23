import { describe, expect, it } from 'vitest';

import { analisarValorCentavos, detectarDecimalVirgula, formatarCentavos } from './dinheiro.js';

describe('analisarValorCentavos', () => {
  it('le os tres jeitos que o mesmo banco escreve valor', () => {
    expect(analisarValorCentavos('61,05')).toBe(6105); // decimal com virgula
    expect(analisarValorCentavos('25.67')).toBe(2567); // decimal com ponto
    expect(analisarValorCentavos('50')).toBe(5000); // sem decimal
  });

  it('desempata milhar e decimal pelo separador que vem por ultimo', () => {
    expect(analisarValorCentavos('1.259,27')).toBe(125927);
    expect(analisarValorCentavos('1,259.27')).toBe(125927);
    expect(analisarValorCentavos('1.234.567,89')).toBe(123456789);
  });

  it('trata separador solto de milhar como milhar, nao como decimal', () => {
    // Tres casas depois do separador nao e centavo em lugar nenhum.
    expect(analisarValorCentavos('1.259')).toBe(125900);
    expect(analisarValorCentavos('1,259')).toBe(125900);
  });

  it('preserva o sinal nos tres jeitos de escrever negativo', () => {
    expect(analisarValorCentavos('-235.30')).toBe(-23530);
    expect(analisarValorCentavos('235,30-')).toBe(-23530);
    expect(analisarValorCentavos('(235,30)')).toBe(-23530);
  });

  it('ignora simbolo de moeda e espaco, inclusive o nao separavel', () => {
    expect(analisarValorCentavos('R$ 1.259,27')).toBe(125927);
    expect(analisarValorCentavos('R$ 100,00')).toBe(10000);
  });

  it('nao perde centavo por ponto flutuante', () => {
    // 0,10 nao existe exatamente em binario. Somar cem vezes tem que dar 10,00.
    const dez = Array.from({ length: 100 }, () => analisarValorCentavos('0,10') ?? 0);
    expect(dez.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('completa uma casa decimal sozinha', () => {
    expect(analisarValorCentavos('12,5')).toBe(1250);
  });

  it('devolve null para o que nao e valor', () => {
    expect(analisarValorCentavos('')).toBeNull();
    expect(analisarValorCentavos('saldo')).toBeNull();
    expect(analisarValorCentavos('R$')).toBeNull();
    expect(analisarValorCentavos('12,5,6')).toBe(125600);
  });
});

describe('detectarDecimalVirgula', () => {
  it('reconhece o arquivo escrito com virgula', () => {
    expect(detectarDecimalVirgula(['61,05', '43,48', '12,82'])).toBe(true);
  });

  it('reconhece o arquivo escrito com ponto', () => {
    expect(detectarDecimalVirgula(['25.67', '34.57', '31.87'])).toBe(false);
  });

  it('decide pela maioria quando o arquivo mistura', () => {
    expect(detectarDecimalVirgula(['61,05', '43,48', '25.67'])).toBe(true);
  });
});

describe('formatarCentavos', () => {
  it('escreve como brasileiro le', () => {
    expect(formatarCentavos(125927)).toBe('R$ 1.259,27');
    expect(formatarCentavos(6105)).toBe('R$ 61,05');
    expect(formatarCentavos(5)).toBe('R$ 0,05');
    expect(formatarCentavos(0)).toBe('R$ 0,00');
  });

  it('mantem o sinal antes do simbolo', () => {
    expect(formatarCentavos(-23530)).toBe('-R$ 235,30');
  });

  it('poe separador de milhar em numero grande', () => {
    expect(formatarCentavos(123456789)).toBe('R$ 1.234.567,89');
  });
});
