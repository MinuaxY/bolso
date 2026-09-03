import { describe, expect, it } from 'vitest';

import { competenciaDaCompra, competenciaDeDebito } from './fatura.js';

describe('competenciaDaCompra', () => {
  const FECHAMENTO = 5;

  it('compra antes do fechamento cai na fatura do mes', () => {
    expect(competenciaDaCompra('2026-06-03', FECHAMENTO)).toBe('2026-06');
  });

  it('compra no proprio dia do fechamento ainda cai neste mes', () => {
    expect(competenciaDaCompra('2026-06-05', FECHAMENTO)).toBe('2026-06');
  });

  it('compra depois do fechamento cai na fatura seguinte', () => {
    expect(competenciaDaCompra('2026-06-06', FECHAMENTO)).toBe('2026-07');
  });

  it('compra de fim de ano vira para o ano seguinte', () => {
    expect(competenciaDaCompra('2026-12-20', FECHAMENTO)).toBe('2027-01');
  });

  it('respeita o dia de fechamento de cada cartao', () => {
    // O mesmo dia 10 cai em faturas diferentes conforme o cartao.
    expect(competenciaDaCompra('2026-06-10', 15)).toBe('2026-06');
    expect(competenciaDaCompra('2026-06-10', 5)).toBe('2026-07');
  });

  it('recusa dia de fechamento invalido em vez de chutar', () => {
    expect(() => competenciaDaCompra('2026-06-10', 0)).toThrow(RangeError);
    expect(() => competenciaDaCompra('2026-06-10', 32)).toThrow(RangeError);
    expect(() => competenciaDaCompra('2026-06-10', 5.5)).toThrow(RangeError);
  });

  it('recusa data invalida', () => {
    expect(() => competenciaDaCompra('06/06/2026', FECHAMENTO)).toThrow(TypeError);
  });
});

describe('competenciaDeDebito', () => {
  it('conta corrente nao tem ciclo: cai no mes em que aconteceu', () => {
    expect(competenciaDeDebito('2026-06-30')).toBe('2026-06');
    expect(competenciaDeDebito('2026-06-01')).toBe('2026-06');
  });
});
