import { describe, expect, it } from 'vitest';

import { categorizar } from './categorizacao.js';
import { REGRAS_PADRAO, categoriasDe, validarRegras } from './regras.js';

describe('REGRAS_PADRAO', () => {
  it('carrega as regras da planilha de origem', () => {
    expect(REGRAS_PADRAO.length).toBeGreaterThan(100);
  });

  it('preserva a ordem, que e o que faz a categorizacao acertar', () => {
    const chaves = REGRAS_PADRAO.map((r) => r.palavraChave);
    const posFood = chaves.indexOf('99food');
    const posApp = chaves.indexOf('99app');
    const posGenerica = chaves.indexOf('99');

    expect(posFood).toBeGreaterThanOrEqual(0);
    expect(posGenerica).toBeGreaterThan(posFood);
    expect(posGenerica).toBeGreaterThan(posApp);
  });

  it('classifica corretamente as descricoes reais do extrato', () => {
    const casos: readonly [string, string][] = [
      ['99food *Jyk Food', 'Alimentacao'],
      ['99app *99app', 'Transporte'],
      ['99 - Viagem', 'Transporte'],
      ['Ifd*Ifood Club', 'Alimentacao'],
      ['Recargapay *Bilh Unic', 'Transporte'],
      ['Amazonmktplc*Maxferram - Parcela 5/8', 'Compras'],
      ['Amazonprimebr', 'Assinaturas'],
    ];

    for (const [descricao, categoria] of casos) {
      expect(categorizar(descricao, 'despesa', REGRAS_PADRAO).categoria, descricao).toBe(categoria);
    }
  });

  it('a regra especifica vence a generica, e nenhuma delas pede revisao', () => {
    // `99 - viagem` e `amazonmktplc` sao regras proprias: decidem sozinhas.
    for (const descricao of ['99 - Viagem', 'Amazonmktplc*Maxferram']) {
      expect(categorizar(descricao, 'despesa', REGRAS_PADRAO).precisaRevisao, descricao).toBe(
        false,
      );
    }
  });

  it('as regras genericas que o autor marcou como ambiguas caem na fila de revisao', () => {
    // Duas regras da planilha se declaram ambiguas na propria descricao: `99`
    // (corrida ou comida?) e `amazon` (assinatura ou compra?). Elas atribuem
    // uma categoria util e ao mesmo tempo pedem conferencia.
    for (const descricao of ['Compra 99', 'Amazon']) {
      const resultado = categorizar(descricao, 'despesa', REGRAS_PADRAO);
      expect(resultado.precisaRevisao, descricao).toBe(true);
      expect(resultado.motivoRevisao, descricao).toBe('regra-ambigua');
    }
  });

  it('reconhece receita sem confundir com despesa', () => {
    expect(categorizar('Salario', 'receita', REGRAS_PADRAO).categoria).toBe('Salario');
    expect(categorizar('Pix recebido de alguem', 'receita', REGRAS_PADRAO).categoria).toBe(
      'Pix recebido',
    );
  });

  it('nao tem regra sem categoria nem palavra-chave vazia', () => {
    for (const regra of REGRAS_PADRAO) {
      expect(regra.palavraChave.trim().length, JSON.stringify(regra)).toBeGreaterThan(0);
      expect(regra.categoria.trim().length, JSON.stringify(regra)).toBeGreaterThan(0);
    }
  });
});

describe('a fila de revisao so recebe o que precisa de gente', () => {
  it('transferencia entre contas proprias nao vai para a fila', () => {
    // Pedir para a pessoa classificar o pagamento da propria fatura e pedir
    // trabalho por nada: a natureza ja diz o que aquilo e. Nos extratos reais
    // isso enchia a fila com um quarto das descricoes.
    for (const descricao of [
      'PAGAMENTO DE FATURA',
      'Pagamento recebido',
      'Aplicação RDB',
      'Resgate RDB',
      'Transferência enviada para conta investimento',
    ]) {
      const resultado = categorizar(descricao, 'despesa', REGRAS_PADRAO);
      expect(resultado.precisaRevisao, descricao).toBe(false);
    }
  });

  it('estorno tambem nao, porque ele se explica sozinho', () => {
    expect(categorizar('Estorno de compra', 'despesa', REGRAS_PADRAO).precisaRevisao).toBe(false);
  });

  it('o que e desconhecido de verdade continua indo', () => {
    expect(categorizar('Loja Nunca Vista XPTO', 'despesa', REGRAS_PADRAO).precisaRevisao).toBe(true);
  });

  it('reconhece as abreviacoes que o banco usa', () => {
    // O Nubank escreve `Ifd*` no lugar de iFood, e a planilha so tinha `ifood`.
    expect(categorizar('Ifd*61960239 Restaurante', 'despesa', REGRAS_PADRAO).categoria).toBe(
      'Alimentacao',
    );
  });
});

describe('validarRegras', () => {
  it('recusa o que nao e lista', () => {
    expect(() => validarRegras({})).toThrow(TypeError);
  });

  it('aponta qual regra esta errada, com o numero e o campo', () => {
    const regras = [
      { palavraChave: 'ok', aplicaEm: 'despesa', categoria: 'Casa' },
      { palavraChave: 'ruim', aplicaEm: 'saida', categoria: 'Casa' },
    ];
    expect(() => validarRegras(regras)).toThrow(/Regra 2 \(ruim\).*aplicaEm/s);
  });

  it('recusa palavra-chave vazia, que casaria com tudo', () => {
    expect(() => validarRegras([{ palavraChave: '  ', aplicaEm: 'despesa', categoria: 'X' }])).toThrow(
      /palavraChave/,
    );
  });

  it('recusa status fora do dominio', () => {
    const regras = [
      { palavraChave: 'x', aplicaEm: 'despesa', categoria: 'Casa', status: 'quitado' },
    ];
    expect(() => validarRegras(regras)).toThrow(/status/);
  });

  it('omite campo opcional vazio em vez de guardar string vazia', () => {
    const [regra] = validarRegras([
      { palavraChave: 'x', aplicaEm: 'despesa', categoria: 'Casa', descricaoPadrao: '' },
    ]);
    expect(regra).not.toHaveProperty('descricaoPadrao');
  });
});

describe('categoriasDe', () => {
  it('lista as categorias de despesa em ordem alfabetica', () => {
    const categorias = categoriasDe(REGRAS_PADRAO, 'despesa');
    expect(categorias).toContain('Alimentacao');
    expect(categorias).toContain('Transporte');
    expect([...categorias]).toEqual([...categorias].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('separa as categorias de receita', () => {
    expect(categoriasDe(REGRAS_PADRAO, 'receita')).toContain('Salario');
    expect(categoriasDe(REGRAS_PADRAO, 'receita')).not.toContain('Alimentacao');
  });
});
