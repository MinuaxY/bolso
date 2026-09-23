import { describe, expect, it } from 'vitest';

import { detectarFonte, lerArquivo, sugerirMapeamento } from './fontes.js';

/**
 * Amostras com a MESMA forma dos extratos reais e conteudo inventado.
 *
 * As quatro primeiras reproduzem os quatro dialetos encontrados em oito
 * arquivos do mesmo banco e do mesmo cartao: ISO com virgula decimal entre
 * aspas, ISO com ponto decimal, ponto e virgula com data brasileira, e o
 * extrato de conta. Nenhum valor ou estabelecimento aqui e real.
 */

const CARTAO_ISO_VIRGULA = `date,title,amount
2026-06-02,Padaria Central,"61,05"
2026-06-01,Livraria Exemplo,"43,48"
2026-05-31,Cafeteria Modelo,"52,40"
`;

const CARTAO_ISO_PONTO = `date,title,amount
2026-01-03,Aplicativo de Corrida,25.67
2026-01-04,Mercearia Modelo - Parcela 4/8,34.57
2026-01-05,Pagamento recebido,-4163.41
2026-01-06,"Estorno de ""Livraria Exemplo""",-32.64
`;

const CARTAO_PONTO_E_VIRGULA = `date;title;amount
03/03/2026;Recarga de Transporte;100
05/03/2026;Mercearia Modelo;50.25
`;

const CONTA = `Data,Valor,Identificador,Descrição
01/05/2026,6000.00,11111111-aaaa-4aaa-8aaa-111111111111,Transferência recebida pelo Pix - EMPRESA EXEMPLO LTDA - 00.000.000/0001-00
01/05/2026,-235.30,22222222-bbbb-4bbb-8bbb-222222222222,Transferência enviada pelo Pix - ESCOLA EXEMPLO
04/04/2026,-3958.01,33333333-cccc-4ccc-8ccc-333333333333,Pagamento de fatura
`;

const BANCO_DESCONHECIDO = `Data do Lançamento;Histórico;Valor (R$)
15/07/2026;COMPRA CARTAO EXEMPLO;-129,90
16/07/2026;RENDIMENTO POUPANCA;12,34
`;

/** Fatura da XP: `;`, data brasileira, `R$ 22,45` e coluna propria de parcela. */
const XP_FATURA = `﻿Data;Estabelecimento;Portador;Valor;Parcela
02/09/2026;DM*EXEMPLOCOM;FULANO DE TAL;R$ 22,45;-
05/09/2026;Pagamento de fatura;FULANO DE TAL;R$ -113,85; de 1
06/09/2026;LOJA EXEMPLO;FULANO DE TAL;R$ 300,00;3 de 10
`;

describe('fatura da XP', () => {
  const leitura = lerArquivo(XP_FATURA);

  it('reconhece o cabecalho e sabe que e cartao', () => {
    expect(leitura.fonte).toBe('xp-fatura');
    expect(leitura.ehCartao).toBe(true);
  });

  it('le valor escrito com simbolo de moeda e virgula decimal', () => {
    expect(leitura.lancamentos[0]).toMatchObject({ valorCentavos: 2245, tipo: 'despesa' });
  });

  it('engole a marca de bytes que o Excel deixa no comeco', () => {
    expect(leitura.lancamentos[0]?.data).toBe('2026-09-02');
  });

  it('usa a coluna de parcela, em vez de procurar na descricao', () => {
    expect(leitura.lancamentos[2]?.parcela).toEqual({ atual: 3, total: 10 });
  });

  it('ignora a coluna de parcela quando ela nao diz nada', () => {
    // A XP escreve `-` para compra a vista e ` de 1` quando nao ha parcelamento.
    expect(leitura.lancamentos[0]?.parcela).toBeUndefined();
    expect(leitura.lancamentos[1]?.parcela).toBeUndefined();
  });

  it('trata o pagamento da fatura como transferencia', () => {
    expect(leitura.lancamentos[1]?.natureza).toBe('transferencia');
  });

  it('nao importa o nome do portador, que e dado pessoal sem uso hoje', () => {
    const texto = JSON.stringify(leitura.lancamentos);
    expect(texto).not.toContain('FULANO');
  });
});

describe('detectarFonte', () => {
  it('reconhece a fatura do cartao', () => {
    expect(detectarFonte(['date', 'title', 'amount'])).toBe('nubank-credito');
  });

  it('reconhece o extrato de conta mesmo com acento no cabecalho', () => {
    expect(detectarFonte(['Data', 'Valor', 'Identificador', 'Descrição'])).toBe('nubank-debito');
  });

  it('chama de generico o que nao conhece', () => {
    expect(detectarFonte(['Data do Lançamento', 'Histórico', 'Valor (R$)'])).toBe('generico');
  });
});

describe('lerArquivo — os quatro dialetos do mesmo banco', () => {
  it('le ISO com virgula decimal entre aspas', () => {
    const leitura = lerArquivo(CARTAO_ISO_VIRGULA);

    expect(leitura.fonte).toBe('nubank-credito');
    expect(leitura.dialeto).toEqual({
      delimitador: ',',
      formatoData: 'iso',
      decimalVirgula: true,
    });
    expect(leitura.erros).toHaveLength(0);
    expect(leitura.lancamentos).toHaveLength(3);
    expect(leitura.lancamentos[0]).toMatchObject({
      data: '2026-06-02',
      valorCentavos: 6105,
      tipo: 'despesa',
      descricaoOriginal: 'Padaria Central',
      linha: 2,
    });
  });

  it('le ISO com ponto decimal', () => {
    const leitura = lerArquivo(CARTAO_ISO_PONTO);

    expect(leitura.dialeto.decimalVirgula).toBe(false);
    expect(leitura.lancamentos[0]?.valorCentavos).toBe(2567);
  });

  it('le ponto e virgula com data brasileira, que e o arquivo que passou pelo Excel', () => {
    const leitura = lerArquivo(CARTAO_PONTO_E_VIRGULA);

    expect(leitura.fonte).toBe('nubank-credito');
    expect(leitura.dialeto.delimitador).toBe(';');
    expect(leitura.dialeto.formatoData).toBe('brasileiro');
    expect(leitura.lancamentos[0]).toMatchObject({ data: '2026-03-03', valorCentavos: 10000 });
  });

  it('le o extrato de conta com o identificador do banco', () => {
    const leitura = lerArquivo(CONTA);

    expect(leitura.fonte).toBe('nubank-debito');
    expect(leitura.lancamentos[0]).toMatchObject({
      tipo: 'receita',
      valorCentavos: 600000,
      identificadorBanco: '11111111-aaaa-4aaa-8aaa-111111111111',
    });
    expect(leitura.lancamentos[1]).toMatchObject({ tipo: 'despesa', valorCentavos: 23530 });
  });
});

describe('lerArquivo — convencao de sinal e natureza', () => {
  it('no cartao, valor positivo e despesa', () => {
    const leitura = lerArquivo(CARTAO_ISO_VIRGULA);
    expect(leitura.lancamentos.every((l) => l.tipo === 'despesa')).toBe(true);
  });

  it('pagamento da fatura nao vira receita: e transferencia', () => {
    // Sem isto, o pagamento entra como renda no cartao E como gasto na conta,
    // e o mesmo dinheiro aparece tres vezes no mes.
    const doCartao = lerArquivo(CARTAO_ISO_PONTO).lancamentos.find((l) =>
      l.descricaoOriginal.includes('Pagamento recebido'),
    );
    expect(doCartao?.natureza).toBe('transferencia');

    const daConta = lerArquivo(CONTA).lancamentos.find((l) =>
      l.descricaoOriginal.includes('Pagamento de fatura'),
    );
    expect(daConta?.natureza).toBe('transferencia');
  });

  it('estorno e despesa negativa, nao receita', () => {
    const estorno = lerArquivo(CARTAO_ISO_PONTO).lancamentos.find((l) =>
      l.descricaoOriginal.startsWith('Estorno'),
    );
    expect(estorno).toMatchObject({ tipo: 'despesa', natureza: 'estorno', valorCentavos: 3264 });
  });

  it('transferencia de Pix comum continua sendo receita ou despesa de verdade', () => {
    const leitura = lerArquivo(CONTA);
    expect(leitura.lancamentos[0]?.natureza).toBeUndefined();
    expect(leitura.lancamentos[1]?.natureza).toBeUndefined();
  });
});

describe('lerArquivo — banco desconhecido', () => {
  it('adivinha as colunas pelos nomes do cabecalho', () => {
    const leitura = lerArquivo(BANCO_DESCONHECIDO);

    expect(leitura.fonte).toBe('generico');
    expect(leitura.lancamentos).toHaveLength(2);
    expect(leitura.lancamentos[0]).toMatchObject({
      data: '2026-07-15',
      valorCentavos: 12990,
      tipo: 'despesa',
    });
    expect(leitura.lancamentos[1]).toMatchObject({ tipo: 'receita', valorCentavos: 1234 });
  });

  it('deduz a convencao de sinal pelo arquivo: sem negativo, tudo e despesa', () => {
    const faturaDesconhecida = `Data;Descricao;Valor
01/06/2026;Loja A;100,00
02/06/2026;Loja B;50,00
`;
    const leitura = lerArquivo(faturaDesconhecida);
    expect(leitura.lancamentos.every((l) => l.tipo === 'despesa')).toBe(true);
  });

  it('pede ajuda em vez de chutar quando nao reconhece coluna nenhuma', () => {
    expect(() => lerArquivo('a;b;c\n1;2;3\n')).toThrow(/Escolha qual coluna/);
  });

  it('aceita o mapeamento escolhido na tela', () => {
    const leitura = lerArquivo('a;b;c\n01/06/2026;Loja A;-100,00\n', {
      mapeamento: { data: 0, descricao: 1, valor: 2 },
    });
    expect(leitura.lancamentos[0]).toMatchObject({ data: '2026-06-01', valorCentavos: 10000 });
  });
});

describe('lerArquivo — linha ruim nao derruba o arquivo', () => {
  const COM_SUJEIRA = `date,title,amount
2026-06-02,Padaria Central,"61,05"
Total do mes,,
2026-06-03,,"10,00"
2026-06-04,Sem valor,abc
2026-06-05,Zerado,"0,00"
2026-06-06,Livraria Exemplo,"20,00"
`;

  it('importa o que da e explica o que recusou', () => {
    const leitura = lerArquivo(COM_SUJEIRA);

    expect(leitura.lancamentos).toHaveLength(2);
    expect(leitura.erros).toHaveLength(4);
    expect(leitura.erros.map((e) => e.motivo)).toEqual([
      'Data ilegivel',
      'Descricao vazia',
      'Valor ilegivel',
      'Valor zerado',
    ]);
  });

  it('aponta o numero da linha como a pessoa ve no editor', () => {
    const leitura = lerArquivo(COM_SUJEIRA);
    expect(leitura.erros[0]?.linha).toBe(3);
    expect(leitura.lancamentos[1]?.linha).toBe(7);
  });

  it('recusa arquivo sem nada', () => {
    expect(() => lerArquivo('')).toThrow(/vazio/);
  });
});

describe('sugerirMapeamento', () => {
  it('acha as colunas por nome, ignorando acento e caixa', () => {
    expect(sugerirMapeamento(['Data do Lançamento', 'Histórico', 'Valor (R$)'])).toEqual({
      data: 0,
      descricao: 1,
      valor: 2,
    });
  });

  it('inclui o identificador quando o arquivo tem um', () => {
    expect(sugerirMapeamento(['Data', 'Valor', 'Identificador', 'Descrição'])).toMatchObject({
      identificador: 2,
    });
  });

  it('devolve null quando falta coluna essencial', () => {
    expect(sugerirMapeamento(['coluna1', 'coluna2'])).toBeNull();
  });
});
