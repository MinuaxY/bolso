import { describe, expect, it } from 'vitest';

import { custoAnualCentavos, detectarAssinaturas } from './assinaturas.js';
import type { Competencia } from './tipos.js';
import type { Despesa, Lancamento } from './tipos.js';

let contador = 0;
function cobranca(
  descricao: string,
  competencia: Competencia,
  valor: number,
  parcial: Partial<Despesa> = {},
): Despesa {
  contador++;
  return {
    id: `d${String(contador)}`,
    tipo: 'despesa',
    data: `${competencia}-08`,
    competencia,
    valorCentavos: Math.round(valor * 100),
    descricao,
    categoria: 'Assinaturas',
    status: 'pago',
    formaPagamento: 'Credito',
    ...parcial,
  };
}

/** A mesma cobranca, mesmo valor, em meses seguidos a partir do primeiro. */
function mensal(
  descricao: string,
  valor: number,
  competencias: readonly Competencia[],
  parcial: Partial<Despesa> = {},
): Despesa[] {
  return competencias.map((c) => cobranca(descricao, c, valor, parcial));
}

const reais = (valor: number): number => Math.round(valor * 100);

describe('detectarAssinaturas', () => {
  it('encontra a cobranca mensal e projeta o custo do ano', () => {
    const lancamentos = mensal('Netflix', 44.9, ['2026-06', '2026-07', '2026-08', '2026-09']);

    const [netflix] = detectarAssinaturas(lancamentos);

    expect(netflix?.descricao).toBe('Netflix');
    expect(netflix?.valorCentavos).toBe(reais(44.9));
    expect(netflix?.anualCentavos).toBe(reais(538.8));
    expect(netflix?.meses).toBe(4);
    expect(netflix?.totalPagoCentavos).toBe(reais(179.6));
    expect(netflix?.situacao).toBe('ativa');
  });

  it('dois meses nao sao um padrao', () => {
    const lancamentos = mensal('Spotify', 21.9, ['2026-08', '2026-09']);
    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });
});

describe('detectarAssinaturas — o que parece assinatura e nao e', () => {
  it('compra parcelada nao e assinatura, por mais identica que pareca', () => {
    // A armadilha central deste modulo: uma compra em 10x produz dez
    // lancamentos do mesmo valor, no mesmo lugar, em meses seguidos. A
    // diferenca e que ela acaba — e so o campo `parcela` sabe disso.
    const lancamentos = [
      cobranca('Amazon Marketplace Cc', '2026-06', 89.9, {
        parcela: { atual: 1, total: 10 },
        categoria: 'Compras',
      }),
      cobranca('Amazon Marketplace Cc', '2026-07', 89.9, {
        parcela: { atual: 2, total: 10 },
        categoria: 'Compras',
      }),
      cobranca('Amazon Marketplace Cc', '2026-08', 89.9, {
        parcela: { atual: 3, total: 10 },
        categoria: 'Compras',
      }),
      cobranca('Amazon Marketplace Cc', '2026-09', 89.9, {
        parcela: { atual: 4, total: 10 },
        categoria: 'Compras',
      }),
    ];

    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });

  it('parcela escrita so no texto tambem fica de fora', () => {
    // Lancamento digitado a mao, em que ninguem preencheu o campo `parcela`.
    const lancamentos = mensal(
      'Amsacessoriosltda - Parcela 3/6',
      120,
      ['2026-06', '2026-07', '2026-08'],
      { categoria: 'Compras' },
    );

    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });

  it('mercado nao e assinatura: assinatura cobra uma vez por mes', () => {
    const lancamentos = [
      ...mensal('Supermercado Dia', 95, ['2026-07', '2026-08', '2026-09'], {
        categoria: 'Alimentacao',
      }),
      ...mensal('Supermercado Dia', 95, ['2026-07', '2026-08', '2026-09'], {
        categoria: 'Alimentacao',
      }),
      ...mensal('Supermercado Dia', 95, ['2026-07', '2026-08', '2026-09'], {
        categoria: 'Alimentacao',
      }),
    ];

    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });

  it('pagamento de fatura e mensal e parecido, mas e transferencia', () => {
    const lancamentos = mensal(
      'Pagamento de fatura',
      1200,
      ['2026-06', '2026-07', '2026-08', '2026-09'],
      { natureza: 'transferencia', categoria: 'Transferencia' },
    );

    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });

  it('buraco de dois meses no meio nao e cobranca mensal', () => {
    const lancamentos = mensal('Academia Local', 99, ['2026-04', '2026-07', '2026-10'], {
      categoria: 'Saude',
    });

    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });

  it('valores que nao se parecem nao sao a mesma assinatura', () => {
    // Mesma padaria todo mes, valores de compra avulsa.
    const lancamentos = [
      cobranca('Padaria do Bairro', '2026-07', 12.5, { categoria: 'Alimentacao' }),
      cobranca('Padaria do Bairro', '2026-08', 78.3, { categoria: 'Alimentacao' }),
      cobranca('Padaria do Bairro', '2026-09', 41.0, { categoria: 'Alimentacao' }),
    ];

    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });

  it('um mes sem cobranca passa: cartao trocado nao cancela assinatura', () => {
    const lancamentos = mensal('Spotify', 21.9, ['2026-06', '2026-07', '2026-09', '2026-10']);

    const [spotify] = detectarAssinaturas(lancamentos);
    expect(spotify?.meses).toBe(4);
  });
});

describe('detectarAssinaturas — o preco muda', () => {
  it('reajuste nao quebra a deteccao, e aparece como aumento', () => {
    const lancamentos = [
      ...mensal('Netflix', 39.9, ['2026-05', '2026-06', '2026-07']),
      ...mensal('Netflix', 44.9, ['2026-08', '2026-09']),
    ];

    const [netflix] = detectarAssinaturas(lancamentos);

    expect(netflix?.meses).toBe(5);
    expect(netflix?.valorCentavos).toBe(reais(44.9));
    expect(netflix?.aumentoCentavos).toBe(reais(5));
    // O custo do ano usa o preco de hoje, nao a media do que ja foi pago.
    expect(netflix?.anualCentavos).toBe(reais(538.8));
  });

  it('variacao de centavos de cambio nao vira "aumento"', () => {
    const lancamentos = [
      cobranca('Claude Pro', '2026-07', 109.9),
      cobranca('Claude Pro', '2026-08', 110.4),
      cobranca('Claude Pro', '2026-09', 110.2),
    ];

    const [claude] = detectarAssinaturas(lancamentos);

    expect(claude).toBeDefined();
    expect(claude?.aumentoCentavos).toBeUndefined();
  });
});

describe('detectarAssinaturas — o que parou de cobrar', () => {
  it('marca como encerrada a que sumiu ha mais de um mes', () => {
    const lancamentos = [
      ...mensal('Globoplay', 29.9, ['2026-04', '2026-05', '2026-06']),
      ...mensal('Netflix', 44.9, ['2026-07', '2026-08', '2026-09']),
    ];

    const assinaturas = detectarAssinaturas(lancamentos);
    const globoplay = assinaturas.find((a) => a.descricao === 'Globoplay');

    expect(globoplay?.situacao).toBe('encerrada');
    expect(globoplay?.ultimaCompetencia).toBe('2026-06');
  });

  it('o mes mais recente vem do extrato, nao do relogio da maquina', () => {
    // Extrato antigo importado hoje: nada aqui esta "encerrado" por causa da
    // data de hoje, porque o fim dos dados e o presente dos dados.
    const lancamentos = mensal('Netflix', 44.9, ['2024-01', '2024-02', '2024-03']);

    const [netflix] = detectarAssinaturas(lancamentos);
    expect(netflix?.situacao).toBe('ativa');
  });

  it('a cobranca do mes que ainda nao caiu nao encerra a assinatura', () => {
    // Importou ate outubro; a Netflix cobra dia 28 e ainda nao apareceu.
    const lancamentos = [
      ...mensal('Netflix', 44.9, ['2026-07', '2026-08', '2026-09']),
      cobranca('Mercado', '2026-10', 230, { categoria: 'Alimentacao' }),
    ];

    const [netflix] = detectarAssinaturas(lancamentos);
    expect(netflix?.situacao).toBe('ativa');
  });
});

describe('detectarAssinaturas — ordem', () => {
  it('a mais cara do ano vem primeiro, e a encerrada vai para o fim', () => {
    const lancamentos = [
      ...mensal('Spotify', 21.9, ['2026-07', '2026-08', '2026-09']),
      ...mensal('Microsoft 365', 51.0, ['2026-07', '2026-08', '2026-09']),
      ...mensal('HBO Max', 300.0, ['2026-02', '2026-03', '2026-04']),
    ];

    expect(detectarAssinaturas(lancamentos).map((a) => a.descricao)).toEqual([
      'Microsoft 365',
      'Spotify',
      'HBO Max',
    ]);
  });
});

describe('detectarAssinaturas — onde ficam exatamente os limites', () => {
  // Os quatro numeros que decidem tudo neste modulo estao fixados aqui de
  // proposito. Mexer em qualquer um deles e uma decisao de produto — muda o
  // que a tela afirma sobre o dinheiro de quem usa — e tem que quebrar um
  // teste com nome, nao passar despercebido.
  const serie = (valores: readonly [Competencia, number][]): Despesa[] =>
    valores.map(([comp, valor]) => cobranca('Servico X', comp, valor));

  it('tres meses entram; dois nao', () => {
    expect(
      detectarAssinaturas(serie([['2026-07', 50], ['2026-08', 50]])),
    ).toHaveLength(0);
    expect(
      detectarAssinaturas(serie([['2026-07', 50], ['2026-08', 50], ['2026-09', 50]])),
    ).toHaveLength(1);
  });

  it('uma cobranca repetida passa; duas ja sao outro padrao', () => {
    const base: [Competencia, number][] = [['2026-07', 50], ['2026-08', 50], ['2026-09', 50]];
    expect(detectarAssinaturas(serie([...base, ['2026-08', 50]]))).toHaveLength(1);
    expect(
      detectarAssinaturas(serie([...base, ['2026-08', 50], ['2026-09', 50]])),
    ).toHaveLength(0);
  });

  it('buraco de um mes passa; de dois, nao', () => {
    expect(
      detectarAssinaturas(serie([['2026-06', 50], ['2026-08', 50], ['2026-09', 50]])),
    ).toHaveLength(1);
    expect(
      detectarAssinaturas(serie([['2026-05', 50], ['2026-08', 50], ['2026-09', 50]])),
    ).toHaveLength(0);
  });

  it('um valor fora da faixa de 15% passa; dois de tres derrubam', () => {
    expect(
      detectarAssinaturas(serie([['2026-07', 50], ['2026-08', 50], ['2026-09', 58]])),
    ).toHaveLength(1);
    expect(
      detectarAssinaturas(serie([['2026-07', 50], ['2026-08', 90], ['2026-09', 20]])),
    ).toHaveLength(0);
  });

  it('caixa e acento nao separam a mesma assinatura', () => {
    const lancamentos = [
      cobranca('Academia', '2026-07', 99),
      cobranca('ACADEMIA', '2026-08', 99),
      cobranca('academia', '2026-09', 99),
    ];
    expect(detectarAssinaturas(lancamentos)).toHaveLength(1);
  });

  it('estorno nao conta como cobranca do mes', () => {
    const lancamentos = [
      cobranca('Servico X', '2026-07', 50),
      cobranca('Servico X', '2026-08', 50),
      cobranca('Servico X', '2026-09', 50, { natureza: 'estorno' }),
    ];
    expect(detectarAssinaturas(lancamentos)).toHaveLength(0);
  });
});

describe('custoAnualCentavos', () => {
  it('soma so as ativas, porque e o numero que a pessoa usa para decidir', () => {
    const lancamentos: Lancamento[] = [
      ...mensal('Spotify', 21.9, ['2026-07', '2026-08', '2026-09']),
      ...mensal('Globoplay', 29.9, ['2026-01', '2026-02', '2026-03']),
    ];

    expect(custoAnualCentavos(detectarAssinaturas(lancamentos))).toBe(reais(262.8));
  });

  it('sem assinatura nenhuma, o custo e zero', () => {
    expect(custoAnualCentavos([])).toBe(0);
  });
});
