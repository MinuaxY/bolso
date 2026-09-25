import { describe, expect, it } from 'vitest';

import { avaliarMetas, totalizarMetas } from './metas.js';
import type { Despesa, Lancamento } from './tipos.js';

let contador = 0;
function gasto(categoria: string, valor: number, parcial: Partial<Despesa> = {}): Despesa {
  contador++;
  return {
    id: `d${String(contador)}`,
    tipo: 'despesa',
    data: '2026-09-10',
    competencia: '2026-09',
    valorCentavos: Math.round(valor * 100),
    descricao: 'Compra',
    categoria,
    status: 'pago',
    formaPagamento: 'Credito',
    ...parcial,
  };
}

const reais = (valor: number): number => Math.round(valor * 100);

describe('avaliarMetas', () => {
  const lancamentos: Lancamento[] = [
    gasto('Alimentacao', 600),
    gasto('Alimentacao', 200),
    gasto('Transporte', 150),
  ];

  it('mostra quanto foi gasto contra o teto de cada categoria', () => {
    const [alimentacao] = avaliarMetas(lancamentos, '2026-09', [
      { categoria: 'Alimentacao', limiteCentavos: reais(1000) },
    ]);

    expect(alimentacao?.gastoCentavos).toBe(reais(800));
    expect(alimentacao?.restanteCentavos).toBe(reais(200));
    expect(alimentacao?.percentual).toBe(80);
  });

  it('ordena pela categoria mais apertada, que e a que precisa de atencao', () => {
    const avaliacoes = avaliarMetas(lancamentos, '2026-09', [
      { categoria: 'Transporte', limiteCentavos: reais(1000) },
      { categoria: 'Alimentacao', limiteCentavos: reais(1000) },
    ]);

    expect(avaliacoes.map((a) => a.categoria)).toEqual(['Alimentacao', 'Transporte']);
  });

  it('acende o amarelo a partir de 80% do teto', () => {
    const [meta] = avaliarMetas(lancamentos, '2026-09', [
      { categoria: 'Alimentacao', limiteCentavos: reais(1000) },
    ]);
    expect(meta?.situacao).toBe('atencao');
  });

  it('fica tranquilo bem abaixo do teto', () => {
    const [meta] = avaliarMetas(lancamentos, '2026-09', [
      { categoria: 'Alimentacao', limiteCentavos: reais(5000) },
    ]);
    expect(meta?.situacao).toBe('tranquilo');
  });

  it('marca o estouro e mostra o restante negativo', () => {
    const [meta] = avaliarMetas(lancamentos, '2026-09', [
      { categoria: 'Alimentacao', limiteCentavos: reais(500) },
    ]);

    expect(meta?.situacao).toBe('estourou');
    expect(meta?.restanteCentavos).toBe(reais(-300));
  });

  it('projeta o fechamento do mes pelo ritmo, que e o numero que muda decisao', () => {
    // R$ 800 em 10 dias de um mes de 30 -> fecha em R$ 2.400.
    const [meta] = avaliarMetas(
      lancamentos,
      '2026-09',
      [{ categoria: 'Alimentacao', limiteCentavos: reais(3000) }],
      '2026-09-10',
    );

    expect(meta?.diaDoMes).toBe(10);
    expect(meta?.projecaoCentavos).toBe(reais(2400));
    expect(meta?.situacao).toBe('tranquilo');
  });

  it('avisa antes de estourar quando o ritmo aponta para isso', () => {
    // Gastou 800 de 1.500 em 10 dias: esta em 53% do teto, mas fecha em 2.400.
    const [meta] = avaliarMetas(
      lancamentos,
      '2026-09',
      [{ categoria: 'Alimentacao', limiteCentavos: reais(1500) }],
      '2026-09-10',
    );

    expect(meta?.percentual).toBeLessThan(80);
    expect(meta?.projecaoCentavos).toBe(reais(2400));
    expect(meta?.situacao).toBe('atencao');
  });

  it('nao projeta mes que ja acabou: ali nao ha o que mudar', () => {
    const [meta] = avaliarMetas(
      lancamentos,
      '2026-09',
      [{ categoria: 'Alimentacao', limiteCentavos: reais(1000) }],
      '2026-11-05',
    );

    expect(meta?.projecaoCentavos).toBeUndefined();
  });

  it('respeita o tamanho do mes', () => {
    const fevereiro = [gasto('Alimentacao', 280, { competencia: '2026-02', data: '2026-02-10' })];
    const [meta] = avaliarMetas(
      fevereiro,
      '2026-02',
      [{ categoria: 'Alimentacao', limiteCentavos: reais(1000) }],
      '2026-02-10',
    );

    // R$ 280 em 10 dias de fevereiro (28 dias) -> R$ 784.
    expect(meta?.projecaoCentavos).toBe(reais(784));
  });

  it('categoria sem gasto nenhum aparece zerada, e nao some', () => {
    const [meta] = avaliarMetas(lancamentos, '2026-09', [
      { categoria: 'Lazer', limiteCentavos: reais(300) },
    ]);

    expect(meta?.gastoCentavos).toBe(0);
    expect(meta?.situacao).toBe('tranquilo');
  });

  it('nao projeta categoria que ainda nao comecou: "fecha em zero" nao informa nada', () => {
    const [meta] = avaliarMetas(
      lancamentos,
      '2026-09',
      [{ categoria: 'Lazer', limiteCentavos: reais(300) }],
      '2026-09-10',
    );

    expect(meta?.projecaoCentavos).toBeUndefined();
  });

  it('ignora meta sem teto definido', () => {
    expect(avaliarMetas(lancamentos, '2026-09', [{ categoria: 'Lazer', limiteCentavos: 0 }])).toHaveLength(
      0,
    );
  });

  it('nao conta transferencia nem deixa estorno virar gasto negativo', () => {
    const comRuido: Lancamento[] = [
      gasto('Compras', 500),
      gasto('Compras', 800, { natureza: 'estorno' }),
      gasto('Compras', 9999, { natureza: 'transferencia' }),
    ];

    const [meta] = avaliarMetas(comRuido, '2026-09', [
      { categoria: 'Compras', limiteCentavos: reais(1000) },
    ]);

    // 500 gastos menos 800 devolvidos daria negativo; o piso e zero.
    expect(meta?.gastoCentavos).toBe(0);
  });
});

describe('totalizarMetas', () => {
  it('soma o orcado, o gasto e quantas estouraram', () => {
    const avaliacoes = avaliarMetas(
      [gasto('Alimentacao', 1200), gasto('Transporte', 100)],
      '2026-09',
      [
        { categoria: 'Alimentacao', limiteCentavos: reais(1000) },
        { categoria: 'Transporte', limiteCentavos: reais(500) },
      ],
    );

    expect(totalizarMetas(avaliacoes)).toEqual({
      limiteCentavos: reais(1500),
      gastoCentavos: reais(1300),
      estouradas: 1,
    });
  });

  it('sem metas, tudo zerado', () => {
    expect(totalizarMetas([])).toEqual({ limiteCentavos: 0, gastoCentavos: 0, estouradas: 0 });
  });
});
