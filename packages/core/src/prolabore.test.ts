import { describe, expect, it } from 'vitest';

import {
  TABELA_PESSOA_FISICA,
  calcularInssProLabore,
  calcularProLabore,
  calcularRedutor,
} from './prolabore.js';

const reais = (valor: number): number => Math.round(valor * 100);

describe('tabela de 2026', () => {
  it('declara vigencia e fundamento', () => {
    expect(TABELA_PESSOA_FISICA.anoVigencia).toBe(2026);
    expect(TABELA_PESSOA_FISICA.fundamento).toMatch(/15\.270\/2025/);
  });

  it('as faixas do IRRF sobem sem buraco', () => {
    const tetos = TABELA_PESSOA_FISICA.irrf.faixas.map((f) => f.ate);
    expect([...tetos]).toEqual([...tetos].sort((a, b) => a - b));
  });
});

describe('INSS do pro-labore', () => {
  it('retem 11% do valor retirado', () => {
    expect(calcularInssProLabore(reais(6000)).contribuicaoCentavos).toBe(reais(660));
  });

  it('nao desce abaixo do salario minimo, mesmo retirando menos', () => {
    const resultado = calcularInssProLabore(reais(1000));
    expect(resultado.baseCentavos).toBe(TABELA_PESSOA_FISICA.inss.salarioMinimoCentavos);
    // 11% de R$ 1.621,00
    expect(resultado.contribuicaoCentavos).toBe(reais(178.31));
  });

  it('trava no teto do INSS', () => {
    const resultado = calcularInssProLabore(reais(30000));
    expect(resultado.baseCentavos).toBe(TABELA_PESSOA_FISICA.inss.tetoCentavos);
    expect(resultado.contribuicaoCentavos).toBe(reais(932.31));
  });
});

describe('redutor da Lei 15.270/2025', () => {
  it('zera exatamente no teto de R$ 7.350, que e o que a lei diz', () => {
    expect(calcularRedutor(reais(7350))).toBeLessThanOrEqual(5);
    expect(calcularRedutor(reais(7350.01))).toBe(0);
    expect(calcularRedutor(reais(10000))).toBe(0);
  });

  it('em R$ 6.000 vale R$ 179,75, como no exemplo da Receita', () => {
    expect(calcularRedutor(reais(6000))).toBe(reais(179.75));
  });

  it('cresce quanto menor o rendimento', () => {
    expect(calcularRedutor(reais(5000))).toBeGreaterThan(calcularRedutor(reais(6000)));
  });
});

describe('calcularProLabore', () => {
  it('ate R$ 5.000 nao ha imposto, que e a isencao prometida pela lei', () => {
    // A isencao nao e uma faixa nova: e o redutor ficando igual ao imposto.
    const resultado = calcularProLabore({ proLaboreCentavos: reais(5000) });
    expect(resultado.irrf.impostoCentavos).toBe(0);
    expect(resultado.avisos).toContain('isento-pelo-redutor');
  });

  it('em R$ 6.000 retem INSS e IRRF com o redutor aplicado', () => {
    const resultado = calcularProLabore({ proLaboreCentavos: reais(6000) });

    expect(resultado.inss.contribuicaoCentavos).toBe(reais(660));
    expect(resultado.irrf.deducaoUsada).toBe('legal');
    expect(resultado.irrf.baseCentavos).toBe(reais(5340));
    expect(resultado.irrf.impostoPelaTabelaCentavos).toBe(reais(559.77));
    expect(resultado.irrf.redutorCentavos).toBe(reais(179.75));
    expect(resultado.irrf.impostoCentavos).toBe(reais(380.02));
    expect(resultado.liquidoCentavos).toBe(reais(6000 - 660 - 380.02));
  });

  it('acima de R$ 7.350 o redutor some e o imposto e a tabela cheia', () => {
    const resultado = calcularProLabore({ proLaboreCentavos: reais(20000) });

    expect(resultado.inss.contribuicaoCentavos).toBe(reais(932.31));
    expect(resultado.irrf.redutorCentavos).toBe(0);
    expect(resultado.irrf.impostoCentavos).toBe(reais(4334.88));
  });

  it('usa o desconto simplificado quando ele for melhor que as deducoes', () => {
    // Retirada pequena: 11% de INSS rende menos deducao que os R$ 607,20.
    const resultado = calcularProLabore({ proLaboreCentavos: reais(3000) });
    expect(resultado.irrf.deducaoUsada).toBe('simplificado');
    expect(resultado.irrf.baseCentavos).toBe(reais(3000) - reais(607.2));
  });

  it('dependente reduz a base, e o app nao esquece disso', () => {
    const sem = calcularProLabore({ proLaboreCentavos: reais(8000) });
    const com = calcularProLabore({ proLaboreCentavos: reais(8000), dependentes: 2 });

    expect(com.irrf.baseCentavos).toBe(sem.irrf.baseCentavos - 2 * reais(189.59));
    expect(com.irrf.impostoCentavos).toBeLessThan(sem.irrf.impostoCentavos);
  });

  it('pensao alimenticia e outras deducoes legais entram na conta', () => {
    const resultado = calcularProLabore({
      proLaboreCentavos: reais(8000),
      outrasDeducoesCentavos: reais(1000),
    });
    expect(resultado.irrf.deducaoLegalCentavos).toBe(reais(880) + reais(1000));
  });

  it('so o Anexo IV recolhe os 20% patronais a parte', () => {
    expect(calcularProLabore({ proLaboreCentavos: reais(6000) }).patronalCentavos).toBe(0);
    expect(
      calcularProLabore({ proLaboreCentavos: reais(6000), anexoIV: true }).patronalCentavos,
    ).toBe(reais(1200));
  });

  it('avisa quando a retirada fica abaixo do salario minimo', () => {
    const resultado = calcularProLabore({ proLaboreCentavos: reais(1000) });
    expect(resultado.avisos).toContain('abaixo-do-minimo');
    // O INSS incide sobre o minimo, entao o liquido fica menor que a retirada.
    expect(resultado.liquidoCentavos).toBe(reais(1000) - reais(178.31));
  });

  it('avisa quando trava no teto do INSS', () => {
    expect(calcularProLabore({ proLaboreCentavos: reais(30000) }).avisos).toContain(
      'no-teto-do-inss',
    );
  });

  it('nao retira pro-labore, nao ha o que reter', () => {
    const resultado = calcularProLabore({ proLaboreCentavos: 0 });
    expect(resultado.irrf.impostoCentavos).toBe(0);
  });

  it('recusa valor que nao e centavo inteiro', () => {
    expect(() => calcularProLabore({ proLaboreCentavos: 10.5 })).toThrow(RangeError);
    expect(() => calcularProLabore({ proLaboreCentavos: -1 })).toThrow(RangeError);
  });
});
