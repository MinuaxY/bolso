import { describe, expect, it } from 'vitest';

import {
  competenciasDisponiveis,
  comprasParceladas,
  comprometimentoFuturo,
  evolucaoMensal,
  resumirMes,
} from './relatorios.js';
import type { Despesa, Lancamento, Receita } from './tipos.js';

let contador = 0;
function despesa(parcial: Partial<Despesa> = {}): Despesa {
  contador++;
  return {
    id: `d${String(contador)}`,
    tipo: 'despesa',
    data: '2026-06-10',
    competencia: '2026-06',
    valorCentavos: 10000,
    descricao: 'Compra',
    categoria: 'Alimentacao',
    status: 'pago',
    formaPagamento: 'Credito',
    ...parcial,
  };
}
function receita(parcial: Partial<Receita> = {}): Receita {
  contador++;
  return {
    id: `r${String(contador)}`,
    tipo: 'receita',
    data: '2026-06-05',
    competencia: '2026-06',
    valorCentavos: 500000,
    descricao: 'Salario',
    categoria: 'Salario',
    status: 'recebido',
    conta: 'Nubank',
    ...parcial,
  };
}

describe('resumirMes', () => {
  it('separa o que aconteceu do que ainda vai acontecer', () => {
    const resumo = resumirMes(
      [
        despesa({ valorCentavos: 30000, status: 'pago' }),
        despesa({ valorCentavos: 20000, status: 'pendente' }),
        receita({ valorCentavos: 500000, status: 'recebido' }),
        receita({ valorCentavos: 100000, status: 'pendente' }),
      ],
      '2026-06',
    );

    expect(resumo.despesasPagasCentavos).toBe(30000);
    expect(resumo.despesasPendentesCentavos).toBe(20000);
    expect(resumo.receitasRecebidasCentavos).toBe(500000);
    expect(resumo.saldoRealizadoCentavos).toBe(470000);
    expect(resumo.saldoPrevistoCentavos).toBe(550000);
  });

  it('ignora lancamento de outro mes', () => {
    const resumo = resumirMes(
      [despesa({ competencia: '2026-06' }), despesa({ competencia: '2026-07' })],
      '2026-06',
    );
    expect(resumo.quantidade).toBe(1);
  });

  it('nao conta transferencia como receita nem como despesa', () => {
    // O pagamento da fatura sai da conta e entra no cartao. Se contasse, o
    // mesmo dinheiro apareceria como gasto e como renda no mesmo mes.
    const resumo = resumirMes(
      [
        despesa({ valorCentavos: 30000 }),
        despesa({ valorCentavos: 395801, natureza: 'transferencia' }),
        receita({ valorCentavos: 395801, natureza: 'transferencia' }),
      ],
      '2026-06',
    );

    expect(resumo.despesasPagasCentavos).toBe(30000);
    expect(resumo.receitasRecebidasCentavos).toBe(0);
    expect(resumo.transferenciasCentavos).toBe(791602);
  });

  it('estorno abate a despesa da categoria em vez de virar receita', () => {
    const resumo = resumirMes(
      [
        despesa({ valorCentavos: 10000, categoria: 'Compras' }),
        despesa({ valorCentavos: 3000, categoria: 'Compras', natureza: 'estorno' }),
      ],
      '2026-06',
    );

    expect(resumo.despesasPagasCentavos).toBe(7000);
    expect(resumo.receitasRecebidasCentavos).toBe(0);
    expect(resumo.porCategoria).toEqual([{ chave: 'Compras', centavos: 7000, quantidade: 2 }]);
  });

  it('agrupa por categoria, da maior para a menor', () => {
    const resumo = resumirMes(
      [
        despesa({ valorCentavos: 5000, categoria: 'Transporte' }),
        despesa({ valorCentavos: 30000, categoria: 'Alimentacao' }),
        despesa({ valorCentavos: 10000, categoria: 'Alimentacao' }),
      ],
      '2026-06',
    );

    expect(resumo.porCategoria).toEqual([
      { chave: 'Alimentacao', centavos: 40000, quantidade: 2 },
      { chave: 'Transporte', centavos: 5000, quantidade: 1 },
    ]);
  });

  it('agrupa por forma de pagamento', () => {
    const resumo = resumirMes(
      [
        despesa({ valorCentavos: 30000, formaPagamento: 'Credito' }),
        despesa({ valorCentavos: 5000, formaPagamento: 'Pix' }),
      ],
      '2026-06',
    );
    expect(resumo.porFormaPagamento.map((l) => l.chave)).toEqual(['Credito', 'Pix']);
  });

  it('conta quantos lancamentos esperam revisao', () => {
    const resumo = resumirMes(
      [despesa({ precisaRevisao: true }), despesa(), despesa({ precisaRevisao: true })],
      '2026-06',
    );
    expect(resumo.emRevisao).toBe(2);
  });

  it('mes sem lancamento devolve tudo zerado, nao erro', () => {
    const resumo = resumirMes([], '2026-06');
    expect(resumo.despesasPagasCentavos).toBe(0);
    expect(resumo.porCategoria).toEqual([]);
  });
});

describe('competenciasDisponiveis e evolucaoMensal', () => {
  it('lista as competencias da mais recente para a mais antiga', () => {
    const lancamentos = [
      despesa({ competencia: '2026-05' }),
      despesa({ competencia: '2026-07' }),
      despesa({ competencia: '2026-06' }),
    ];
    expect(competenciasDisponiveis(lancamentos)).toEqual(['2026-07', '2026-06', '2026-05']);
  });

  it('a serie do grafico vai do mais antigo para o mais novo', () => {
    const pontos = evolucaoMensal([
      despesa({ competencia: '2026-07', valorCentavos: 10000 }),
      despesa({ competencia: '2026-06', valorCentavos: 20000 }),
    ]);
    expect(pontos.map((p) => p.competencia)).toEqual(['2026-06', '2026-07']);
    expect(pontos[0]?.despesasCentavos).toBe(20000);
  });
});

describe('comprasParceladas', () => {
  const parceladas: Lancamento[] = [
    despesa({
      descricao: 'Mercearia Modelo',
      valorCentavos: 6300,
      competencia: '2026-05',
      parcela: { atual: 3, total: 6 },
    }),
    despesa({
      descricao: 'Mercearia Modelo',
      valorCentavos: 6300,
      competencia: '2026-06',
      parcela: { atual: 4, total: 6 },
    }),
    despesa({ descricao: 'Compra a vista', valorCentavos: 1000 }),
  ];

  it('considera a parcela mais recente de cada compra', () => {
    const [compra] = comprasParceladas(parceladas);
    expect(compra).toMatchObject({
      descricao: 'Mercearia Modelo',
      ultimaParcelaVista: 4,
      restantes: 2,
      valorRestanteCentavos: 12600,
    });
  });

  it('projeta quando a compra fica quitada', () => {
    expect(comprasParceladas(parceladas)[0]?.quitacaoPrevista).toBe('2026-08');
  });

  it('esquece o que ja acabou de pagar', () => {
    const quitada = [despesa({ descricao: 'Fim', parcela: { atual: 6, total: 6 } })];
    expect(comprasParceladas(quitada)).toHaveLength(0);
  });

  it('nao confunde compra a vista com parcelamento', () => {
    expect(comprasParceladas([despesa({ descricao: 'Compra a vista' })])).toHaveLength(0);
  });
});

describe('comprometimentoFuturo', () => {
  it('soma quanto das proximas faturas ja esta gasto', () => {
    const futuro = comprometimentoFuturo([
      despesa({
        descricao: 'Compra A',
        valorCentavos: 6300,
        competencia: '2026-06',
        parcela: { atual: 4, total: 6 },
      }),
      despesa({
        descricao: 'Compra B',
        valorCentavos: 10000,
        competencia: '2026-06',
        parcela: { atual: 1, total: 3 },
      }),
    ]);

    // A esta na 4 de 6 e B na 1 de 3: as duas tem duas parcelas pela frente.
    expect(futuro).toEqual([
      { competencia: '2026-07', centavos: 16300 },
      { competencia: '2026-08', centavos: 16300 },
    ]);
  });

  it('respeita o limite de meses pedido', () => {
    const futuro = comprometimentoFuturo(
      [despesa({ parcela: { atual: 1, total: 24 }, competencia: '2026-06' })],
      3,
    );
    expect(futuro).toHaveLength(3);
  });

  it('sem parcelamento, nada esta comprometido', () => {
    expect(comprometimentoFuturo([despesa()])).toEqual([]);
  });
});
