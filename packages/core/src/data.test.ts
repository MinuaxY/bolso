import { describe, expect, it } from 'vitest';

import {
  competenciaDaData,
  competenciaDe,
  ehDataCivil,
  partesDaCompetencia,
  partesDe,
  somarMeses,
} from './data.js';

describe('ehDataCivil', () => {
  it('aceita data valida no formato do dominio', () => {
    expect(ehDataCivil('2026-06-02')).toBe(true);
  });

  it('recusa formato brasileiro, que e o erro provavel na importacao', () => {
    expect(ehDataCivil('02/06/2026')).toBe(false);
  });

  it('recusa dia que nao existe no mes', () => {
    expect(ehDataCivil('2026-02-30')).toBe(false);
    expect(ehDataCivil('2026-04-31')).toBe(false);
  });

  it('conhece ano bissexto', () => {
    expect(ehDataCivil('2024-02-29')).toBe(true);
    expect(ehDataCivil('2026-02-29')).toBe(false);
    expect(ehDataCivil('2000-02-29')).toBe(true);
    expect(ehDataCivil('1900-02-29')).toBe(false);
  });

  it('recusa mes fora da faixa', () => {
    expect(ehDataCivil('2026-13-01')).toBe(false);
    expect(ehDataCivil('2026-00-10')).toBe(false);
  });
});

describe('partesDe', () => {
  it('quebra a data em numeros', () => {
    expect(partesDe('2026-06-02')).toEqual({ ano: 2026, mes: 6, dia: 2 });
  });

  it('falha alto em vez de devolver numero errado', () => {
    expect(() => partesDe('ontem')).toThrow(TypeError);
  });
});

describe('competenciaDe', () => {
  it('monta a competencia com dois digitos no mes', () => {
    expect(competenciaDe(2026, 6)).toBe('2026-06');
    expect(competenciaDe(2026, 12)).toBe('2026-12');
  });

  it('vira o ano quando o mes passa de dezembro', () => {
    expect(competenciaDe(2026, 13)).toBe('2027-01');
    expect(competenciaDe(2026, 25)).toBe('2028-01');
  });

  it('volta o ano quando o mes e zero ou negativo', () => {
    expect(competenciaDe(2026, 0)).toBe('2025-12');
    expect(competenciaDe(2026, -1)).toBe('2025-11');
  });
});

describe('somarMeses', () => {
  it('projeta parcela para os meses seguintes', () => {
    expect(somarMeses('2026-11', 3)).toBe('2027-02');
  });

  it('anda para tras', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
  });

  it('nao muda nada ao somar zero', () => {
    expect(somarMeses('2026-06', 0)).toBe('2026-06');
  });

  it('recusa competencia mal formada', () => {
    expect(() => somarMeses('2026-13', 1)).toThrow(TypeError);
    expect(() => partesDaCompetencia('junho/2026')).toThrow(TypeError);
  });
});

describe('competenciaDaData', () => {
  it('ignora o dia', () => {
    expect(competenciaDaData('2026-06-30')).toBe('2026-06');
  });
});
