import { describe, expect, it } from 'vitest';

import {
  CATEGORIA_PADRAO_DESPESA,
  CATEGORIA_PADRAO_RECEITA,
  categorizar,
  encontrarRegra,
} from './categorizacao.js';
import type { RegraCategorizacao } from './tipos.js';

/**
 * Recorte fiel da planilha de origem, na ordem original. A ordem e o teste:
 * `99food` e `99app` precisam vir antes de `99`.
 */
const REGRAS: readonly RegraCategorizacao[] = [
  {
    palavraChave: 'ifood',
    aplicaEm: 'despesa',
    categoria: 'Alimentacao',
    descricaoPadrao: 'iFood',
    formaPagamento: 'Credito',
    status: 'pago',
  },
  {
    palavraChave: '99food',
    aplicaEm: 'despesa',
    categoria: 'Alimentacao',
    descricaoPadrao: '99Food',
    formaPagamento: 'Credito',
    status: 'pago',
  },
  {
    palavraChave: '99app',
    aplicaEm: 'despesa',
    categoria: 'Transporte',
    descricaoPadrao: '99 (Corrida)',
    formaPagamento: 'Credito',
    status: 'pago',
  },
  {
    palavraChave: 'farmacia',
    aplicaEm: 'despesa',
    categoria: 'Saude',
    descricaoPadrao: 'Farmacia',
    formaPagamento: 'Credito',
    status: 'pago',
  },
  {
    palavraChave: '99',
    aplicaEm: 'despesa',
    categoria: 'Transporte',
    descricaoPadrao: '99 (verificar: corrida ou food?)',
    formaPagamento: 'Credito',
    status: 'pago',
  },
  {
    palavraChave: 'salario',
    aplicaEm: 'receita',
    categoria: 'Salario',
    descricaoPadrao: 'Salario mensal',
    status: 'recebido',
  },
];

describe('encontrarRegra', () => {
  it('vale a primeira regra da lista, nao a mais especifica', () => {
    // Descricao real do extrato. Casa com `99food`, que vem antes de `99`.
    const regra = encontrarRegra('99food *Jyk Food', 'despesa', REGRAS);
    expect(regra?.palavraChave).toBe('99food');
  });

  it('distingue corrida de comida pela ordem das regras', () => {
    expect(encontrarRegra('99app *99app', 'despesa', REGRAS)?.categoria).toBe('Transporte');
    expect(encontrarRegra('99food *99food', 'despesa', REGRAS)?.categoria).toBe('Alimentacao');
  });

  it('acha a palavra-chave no meio da sujeira do extrato', () => {
    expect(encontrarRegra('Ifd*Ifood Club', 'despesa', REGRAS)?.descricaoPadrao).toBe('iFood');
  });

  it('compara sem acento dos dois lados', () => {
    expect(encontrarRegra('DROGARIA FARMÁCIA SÃO PAULO', 'despesa', REGRAS)?.categoria).toBe(
      'Saude',
    );
  });

  it('nao deixa regra de receita capturar despesa', () => {
    // Divergencia deliberada do VBA de origem, que ignorava o tipo e permitia
    // que a regra de "salario" casasse com uma despesa qualquer.
    expect(encontrarRegra('Pagamento Salario Terceirizado', 'despesa', REGRAS)).toBeUndefined();
    expect(encontrarRegra('Salario', 'receita', REGRAS)?.categoria).toBe('Salario');
  });

  it('ignora regra com palavra-chave vazia', () => {
    const comVazia: RegraCategorizacao[] = [
      { palavraChave: '   ', aplicaEm: 'despesa', categoria: 'Errado' },
      ...REGRAS,
    ];
    expect(encontrarRegra('99food *Jyk Food', 'despesa', comVazia)?.categoria).toBe('Alimentacao');
  });
});

describe('categorizar', () => {
  it('troca a sujeira do extrato pelo nome limpo da regra', () => {
    const resultado = categorizar('99food *53.982.254 Ell', 'despesa', REGRAS);
    expect(resultado.categoria).toBe('Alimentacao');
    expect(resultado.descricao).toBe('99Food');
    expect(resultado.formaPagamento).toBe('Credito');
    expect(resultado.status).toBe('pago');
    expect(resultado.precisaRevisao).toBe(false);
  });

  it('manda para revisao o que nenhuma regra reconheceu', () => {
    const resultado = categorizar('Dm *Helphbomaxcom', 'despesa', REGRAS);
    expect(resultado.categoria).toBe(CATEGORIA_PADRAO_DESPESA);
    expect(resultado.precisaRevisao).toBe(true);
    expect(resultado.motivoRevisao).toBe('sem-regra');
    // A descricao original e preservada: e por ela que a pessoa vai criar a regra.
    expect(resultado.descricao).toBe('Dm *Helphbomaxcom');
  });

  it('usa a categoria padrao de receita quando a receita nao casa', () => {
    const resultado = categorizar('Deposito de origem desconhecida', 'receita', REGRAS);
    expect(resultado.categoria).toBe(CATEGORIA_PADRAO_RECEITA);
    expect(resultado.motivoRevisao).toBe('sem-regra');
  });

  it('marca revisao quando a propria regra se declara ambigua', () => {
    // O caso do "99" sem sufixo: a regra atribui categoria e pede conferencia.
    const resultado = categorizar('99 - Viagem', 'despesa', REGRAS);
    expect(resultado.categoria).toBe('Transporte');
    expect(resultado.precisaRevisao).toBe(true);
    expect(resultado.motivoRevisao).toBe('regra-ambigua');
  });

  it('tira o sufixo de parcela da descricao quando nao ha nome padrao', () => {
    const resultado = categorizar('Amazon Marketplace Cc - Parcela 4/8', 'despesa', REGRAS);
    expect(resultado.descricao).toBe('Amazon Marketplace Cc');
  });

  it('conserta codificacao antes de comparar', () => {
    const quebrado = Array.from(new TextEncoder().encode('Farmácia Preço Bom'), (b) =>
      String.fromCharCode(b),
    ).join('');
    expect(categorizar(quebrado, 'despesa', REGRAS).categoria).toBe('Saude');
  });

  it('devolve qual regra casou, para a tela poder explicar a decisao', () => {
    expect(categorizar('Ifd*Ifood Club', 'despesa', REGRAS).regra?.palavraChave).toBe('ifood');
  });
});
