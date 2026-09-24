import { describe, expect, it } from 'vitest';

import {
  TABELA_SIMPLES,
  anexoPorFatorR,
  calcularDas,
  calcularDasMei,
  calcularFatorRBase,
  compararDas,
  faixaDe,
  rbt12Proporcional,
} from './simples.js';

/** Atalhos para escrever reais nos testes sem contar zero. */
const reais = (valor: number): number => Math.round(valor * 100);

describe('tabela', () => {
  it('tem os cinco anexos com seis faixas cada', () => {
    const anexos = Object.values(TABELA_SIMPLES.anexos);
    expect(anexos).toHaveLength(5);
    for (const anexo of anexos) expect(anexo.faixas).toHaveLength(6);
  });

  it('declara o ano de vigencia e o fundamento legal', () => {
    expect(TABELA_SIMPLES.anoVigencia).toBe(2026);
    expect(TABELA_SIMPLES.fundamento).toMatch(/123\/2006/);
  });

  it('as faixas sobem sem buraco entre elas', () => {
    for (const anexo of Object.values(TABELA_SIMPLES.anexos)) {
      const tetos = anexo.faixas.map((f) => f.ate);
      expect([...tetos]).toEqual([...tetos].sort((a, b) => a - b));
    }
  });
});

describe('faixaDe', () => {
  it('o teto da faixa pertence a ela', () => {
    // R$ 180.000,00 ainda e primeira faixa; um centavo a mais ja e a segunda.
    expect(faixaDe(reais(180000), 'I').indice).toBe(1);
    expect(faixaDe(reais(180000) + 1, 'I').indice).toBe(2);
  });

  it('receita acima do teto do regime cai na ultima faixa', () => {
    expect(faixaDe(reais(5000000), 'I').indice).toBe(6);
  });
});

describe('calcularDas', () => {
  it('reproduz o exemplo classico do Anexo III', () => {
    // RBT12 de R$ 300.000 na 2a faixa: (300.000 x 11,2% - 9.360) / 300.000 = 8,08%.
    const resultado = calcularDas({
      receitaMesCentavos: reais(25000),
      rbt12Centavos: reais(300000),
      anexo: 'III',
    });

    expect(resultado.faixa).toBe(2);
    expect(resultado.aliquotaNominalPercentual).toBe(11.2);
    expect(resultado.aliquotaEfetivaPercentual).toBeCloseTo(8.08, 6);
    expect(resultado.dasCentavos).toBe(reais(2020));
  });

  it('reproduz o exemplo classico do Anexo I', () => {
    // (200.000 x 7,3% - 5.940) / 200.000 = 4,33%; sobre R$ 20.000 da R$ 866,00.
    const resultado = calcularDas({
      receitaMesCentavos: reais(20000),
      rbt12Centavos: reais(200000),
      anexo: 'I',
    });

    expect(resultado.aliquotaEfetivaPercentual).toBeCloseTo(4.33, 6);
    expect(resultado.dasCentavos).toBe(reais(866));
  });

  it('na primeira faixa a efetiva e a propria nominal, porque nao ha o que deduzir', () => {
    const resultado = calcularDas({
      receitaMesCentavos: reais(15000),
      rbt12Centavos: reais(150000),
      anexo: 'I',
    });

    expect(resultado.aliquotaEfetivaPercentual).toBeCloseTo(4, 6);
    expect(resultado.dasCentavos).toBe(reais(600));
  });

  it('arredonda para o centavo, sem sobra de ponto flutuante', () => {
    const resultado = calcularDas({
      receitaMesCentavos: 333333,
      rbt12Centavos: reais(250000),
      anexo: 'III',
    });

    expect(Number.isInteger(resultado.dasCentavos)).toBe(true);
  });

  it('empresa sem historico recebe aviso em vez de numero com ar de certeza', () => {
    const resultado = calcularDas({
      receitaMesCentavos: reais(10000),
      rbt12Centavos: 0,
      anexo: 'III',
    });

    expect(resultado.avisos).toContain('sem-historico');
    // Sem historico vale a nominal da primeira faixa: 6% de R$ 10.000.
    expect(resultado.dasCentavos).toBe(reais(600));
  });

  it('avisa quando passa do sublimite, onde ICMS e ISS saem do DAS', () => {
    const resultado = calcularDas({
      receitaMesCentavos: reais(100000),
      rbt12Centavos: reais(4000000),
      anexo: 'I',
    });

    expect(resultado.avisos).toContain('acima-do-sublimite');
  });

  it('avisa quando a empresa passou do teto do regime', () => {
    const resultado = calcularDas({
      receitaMesCentavos: reais(100000),
      rbt12Centavos: reais(5000000),
      anexo: 'I',
    });

    expect(resultado.avisos).toContain('acima-do-teto');
    expect(resultado.avisos).not.toContain('acima-do-sublimite');
  });

  it('marca o RBT12 estimado, para a tela poder dizer que e estimativa', () => {
    const resultado = calcularDas({
      receitaMesCentavos: reais(10000),
      rbt12Centavos: reais(120000),
      anexo: 'III',
      rbt12Estimado: true,
    });

    expect(resultado.avisos).toContain('rbt12-proporcional');
  });

  it('recusa valor que nao e centavo inteiro', () => {
    expect(() =>
      calcularDas({ receitaMesCentavos: 10.5, rbt12Centavos: reais(100000), anexo: 'I' }),
    ).toThrow(RangeError);
    expect(() =>
      calcularDas({ receitaMesCentavos: -100, rbt12Centavos: reais(100000), anexo: 'I' }),
    ).toThrow(RangeError);
  });

  it('mes sem faturamento nao gera DAS', () => {
    const resultado = calcularDas({
      receitaMesCentavos: 0,
      rbt12Centavos: reais(300000),
      anexo: 'III',
    });
    expect(resultado.dasCentavos).toBe(0);
  });
});

describe('composicao do DAS — conferida contra uma guia real', () => {
  /**
   * Guia de 08/2026 de uma empresa de arquitetura em Sao Paulo, Anexo III pelo
   * Fator R, 1a faixa: faturamento de R$ 7.610,00 e DAS de R$ 456,59.
   *
   * O valor da guia e um centavo MENOR que o produto direto de 7.610 por 6%,
   * porque a Receita calcula tributo por tributo, arredonda cada um e soma.
   * Este teste existe porque a primeira versao do modulo errava esse centavo.
   */
  const REAL = {
    receita: reais(7610),
    rbt12: reais(90000),
    total: reais(456.59),
    porTributo: {
      irpj: reais(18.26),
      csll: reais(15.98),
      cofins: reais(58.54),
      pis: reais(12.69),
      cpp: reais(198.16),
      iss: reais(152.96),
    },
  };

  const resultado = calcularDas({
    receitaMesCentavos: REAL.receita,
    rbt12Centavos: REAL.rbt12,
    anexo: 'III',
  });

  it('o total bate com a guia, ao centavo', () => {
    expect(resultado.dasCentavos).toBe(REAL.total);
  });

  it('nao e o produto direto de faturamento por aliquota', () => {
    // 7.610,00 x 6% = 456,60. A guia diz 456,59.
    expect(REAL.receita * 6 / 100).toBe(reais(456.6));
    expect(resultado.dasCentavos).toBe(REAL.total);
  });

  it('cada tributo bate com a linha correspondente da guia', () => {
    for (const [tributo, esperado] of Object.entries(REAL.porTributo)) {
      const parcela = resultado.composicao.find((p) => p.tributo === tributo);
      expect(parcela?.centavos, tributo).toBe(esperado);
    }
  });

  it('o total e a soma das partes, e nao um numero a parte', () => {
    const soma = resultado.composicao.reduce((total, p) => total + p.centavos, 0);
    expect(soma).toBe(resultado.dasCentavos);
  });

  it('a partilha de toda faixa de todo anexo soma 100%', () => {
    for (const [nome, anexo] of Object.entries(TABELA_SIMPLES.anexos)) {
      anexo.faixas.forEach((faixa, indice) => {
        const soma = Object.values(faixa.partilha).reduce((total, parte) => total + parte, 0);
        expect(soma, `Anexo ${nome}, faixa ${String(indice + 1)}`).toBe(10000);
      });
    }
  });
});

describe('Fator R', () => {
  it('folha de 28% da receita e o ponto de virada', () => {
    expect(calcularFatorRBase(reais(28000), reais(100000))).toBe(2800);
    expect(anexoPorFatorR(reais(28000), reais(100000))).toBe('III');
  });

  it('um centavo abaixo de 28% ja joga para o Anexo V', () => {
    expect(anexoPorFatorR(reais(28000) - 1, reais(100000))).toBe('V');
  });

  it('folha generosa continua no Anexo III', () => {
    expect(anexoPorFatorR(reais(45000), reais(100000))).toBe('III');
  });

  it('sem folha, Anexo V', () => {
    expect(anexoPorFatorR(0, reais(100000))).toBe('V');
  });

  it('a diferenca entre os anexos e grande o bastante para valer a conta', () => {
    const entrada = { receitaMesCentavos: reais(20000), rbt12Centavos: reais(240000) };
    const comFolha = calcularDas({ ...entrada, anexo: 'III' });
    const semFolha = calcularDas({ ...entrada, anexo: 'V' });

    expect(semFolha.dasCentavos).toBeGreaterThan(comFolha.dasCentavos);
  });
});

describe('rbt12Proporcional', () => {
  it('empresa nova estima pela media dos meses, e nao pela soma', () => {
    // Somar daria R$ 30.000 e imposto menor que o devido.
    expect(rbt12Proporcional([reais(10000), reais(10000), reais(10000)])).toBe(reais(120000));
  });

  it('com doze meses ou mais, e a soma dos ultimos doze', () => {
    const doze = Array.from({ length: 12 }, () => reais(10000));
    expect(rbt12Proporcional(doze)).toBe(reais(120000));

    const quinze = Array.from({ length: 15 }, (_, i) => reais(i < 3 ? 99999 : 10000));
    expect(rbt12Proporcional(quinze)).toBe(reais(120000));
  });

  it('sem nenhum mes, nao ha historico', () => {
    expect(rbt12Proporcional([])).toBe(0);
  });
});

describe('MEI', () => {
  it('cobra 5% do salario minimo de INSS, mais os fixos da atividade', () => {
    // Salario minimo de 2026: R$ 1.621,00, entao o INSS e R$ 81,05.
    expect(calcularDasMei('comercio-industria')).toBe(reais(82.05));
    expect(calcularDasMei('servicos')).toBe(reais(86.05));
    expect(calcularDasMei('comercio-e-servicos')).toBe(reais(87.05));
  });
});

describe('compararDas', () => {
  it('diferenca de um centavo e arredondamento, nao erro', () => {
    expect(compararDas(reais(2020), reais(2020) + 1).veredito).toBe('confere');
  });

  it('aponta quando cobraram a mais', () => {
    const c = compararDas(reais(2020), reais(2500));
    expect(c.veredito).toBe('cobrou-a-mais');
    expect(c.diferencaCentavos).toBe(reais(480));
    expect(c.diferencaPercentual).toBeCloseTo(23.76, 2);
  });

  it('aponta quando cobraram a menos, que tambem e problema', () => {
    expect(compararDas(reais(2020), reais(1500)).veredito).toBe('cobrou-a-menos');
  });
});
