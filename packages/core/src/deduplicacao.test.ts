import { describe, expect, it } from 'vitest';

import { chaveDeDuplicacao, classificarImportacao } from './deduplicacao.js';
import type { ItemDeduplicavel } from './deduplicacao.js';

function compra(
  data: string,
  valorCentavos: number,
  descricaoOriginal: string,
  identificadorBanco?: string,
): ItemDeduplicavel {
  return identificadorBanco === undefined
    ? { data, valorCentavos, descricaoOriginal }
    : { data, valorCentavos, descricaoOriginal, identificadorBanco };
}

describe('chaveDeDuplicacao', () => {
  it('usa o identificador do banco quando ele existe', () => {
    // O CSV de conta do Nubank traz um UUID por linha: identidade de verdade.
    const chave = chaveDeDuplicacao(
      compra('2026-05-01', 23530, 'Pix enviado', '69f4eb22-4be6-4955-b645-0668d80c50b1'),
    );
    expect(chave).toContain('69f4eb22-4be6-4955-b645-0668d80c50b1');
  });

  it('cai na heuristica quando o banco nao da identificador', () => {
    const a = chaveDeDuplicacao(compra('2026-06-02', 6105, '99food *Jyk Food'));
    const b = chaveDeDuplicacao(compra('2026-06-02', 6105, '99FOOD  *jyk food'));
    // Mesma transacao escrita com caixa e espaco diferentes: mesma chave.
    expect(a).toBe(b);
  });

  it('separa lancamentos que diferem no valor ou na data', () => {
    const base = chaveDeDuplicacao(compra('2026-06-02', 6105, 'Padaria'));
    expect(chaveDeDuplicacao(compra('2026-06-02', 6106, 'Padaria'))).not.toBe(base);
    expect(chaveDeDuplicacao(compra('2026-06-03', 6105, 'Padaria'))).not.toBe(base);
  });
});

describe('chaveDeDuplicacao — o identificador do banco nao e identidade', () => {
  it('separa a compra do estorno que carrega o MESMO identificador', () => {
    // Achado no extrato real de setembro de 2026: quando uma compra e
    // estornada, o CSV do Nubank repete o UUID da compra no estorno. Sem a
    // natureza na chave, um dos dois sumiria na importacao.
    const compra = chaveDeDuplicacao({
      data: '2026-09-09',
      valorCentavos: 5100,
      descricaoOriginal: 'Compra no debito - LANCHONETE',
      identificadorBanco: 'aaaa-1111',
    });
    const estorno = chaveDeDuplicacao({
      data: '2026-09-09',
      valorCentavos: 5100,
      descricaoOriginal: 'Estorno - Compra no debito - LANCHONETE',
      identificadorBanco: 'aaaa-1111',
      natureza: 'estorno',
    });

    expect(compra).not.toBe(estorno);
  });

  it('reconhece o mesmo estorno nos dois formatos do mesmo banco', () => {
    // O CSV escreve o UUID puro; o OFX acrescenta `:reversal`.
    const doCsv = chaveDeDuplicacao({
      data: '2026-09-09',
      valorCentavos: 5100,
      descricaoOriginal: 'Estorno - Compra no debito',
      identificadorBanco: 'aaaa-1111',
      natureza: 'estorno',
    });
    const doOfx = chaveDeDuplicacao({
      data: '2026-09-09',
      valorCentavos: 5100,
      descricaoOriginal: 'Estorno - Compra no debito',
      identificadorBanco: 'aaaa-1111:reversal',
      natureza: 'estorno',
    });

    expect(doCsv).toBe(doOfx);
  });

  it('a heuristica tambem separa por natureza', () => {
    const base = {
      data: '2026-09-09',
      valorCentavos: 5100,
      descricaoOriginal: 'Loja',
    };
    expect(chaveDeDuplicacao(base)).not.toBe(chaveDeDuplicacao({ ...base, natureza: 'estorno' }));
  });
});

describe('classificarImportacao', () => {
  it('reimportar o mesmo arquivo nao duplica nada', () => {
    const arquivo = [
      compra('2026-06-02', 6105, '99food *Jyk Food'),
      compra('2026-06-01', 4348, 'Amazon'),
    ];

    const primeira = classificarImportacao(arquivo, [], (item) => item);
    expect(primeira.novos).toHaveLength(2);
    expect(primeira.duplicados).toHaveLength(0);

    const segunda = classificarImportacao(arquivo, primeira.novos, (item) => item);
    expect(segunda.novos).toHaveLength(0);
    expect(segunda.duplicados).toHaveLength(2);
  });

  it('duas compras identicas no mesmo dia sao duas compras', () => {
    // Dois cafes de sete reais na mesma padaria. Nao e duplicata.
    const arquivo = [compra('2026-06-02', 700, 'Padaria'), compra('2026-06-02', 700, 'Padaria')];

    const resultado = classificarImportacao(arquivo, [], (item) => item);
    expect(resultado.novos).toHaveLength(2);
  });

  it('importa so o que passou a existir quando o arquivo cresce', () => {
    const existentes = [compra('2026-06-02', 700, 'Padaria'), compra('2026-06-02', 700, 'Padaria')];
    const arquivoMaior = [
      compra('2026-06-02', 700, 'Padaria'),
      compra('2026-06-02', 700, 'Padaria'),
      compra('2026-06-02', 700, 'Padaria'),
    ];

    const resultado = classificarImportacao(arquivoMaior, existentes, (item) => item);
    expect(resultado.novos).toHaveLength(1);
    expect(resultado.duplicados).toHaveLength(2);
  });

  it('preserva a ordem do arquivo', () => {
    const arquivo = [
      compra('2026-06-01', 100, 'A'),
      compra('2026-06-02', 200, 'B'),
      compra('2026-06-03', 300, 'C'),
    ];
    const existentes = [compra('2026-06-02', 200, 'B')];

    const resultado = classificarImportacao(arquivo, existentes, (item) => item);
    expect(resultado.novos.map((l) => l.descricaoOriginal)).toEqual(['A', 'C']);
    expect(resultado.duplicados.map((l) => l.descricaoOriginal)).toEqual(['B']);
  });

  it('identificador do banco vence a heuristica', () => {
    // Mesma data, valor e descricao, mas o banco disse que sao transacoes
    // diferentes. O banco tem razao.
    const arquivo = [
      compra('2026-05-01', 5540, 'Transferencia', 'aaaa-1111'),
      compra('2026-05-01', 5540, 'Transferencia', 'bbbb-2222'),
    ];

    const resultado = classificarImportacao(arquivo, [], (item) => item);
    expect(resultado.novos).toHaveLength(2);
  });
});
