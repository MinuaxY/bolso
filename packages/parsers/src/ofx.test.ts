import { describe, expect, it } from 'vitest';

import { lerArquivo } from './fontes.js';
import { ehOfx, lerOfx } from './ofx.js';

/**
 * Amostras com a MESMA estrutura dos arquivos reais e conteudo inventado.
 *
 * Reproduzem o que Nubank e XP emitem de fato: OFX SGML versao 102, extrato de
 * conta em `BANKMSGSRSV1` e fatura em `CREDITCARDMSGSRSV1`, carimbo de data com
 * e sem hora, e o sufixo `:reversal` que o Nubank acrescenta ao identificador
 * de um estorno.
 */

const CABECALHO = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:NONE
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
`;

const CONTA = `${CABECALHO}
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM><BANKID>260</BANKID><ACCTID>0000000-0</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901</DTSTART>
<DTEND>20260922</DTEND>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260902000000[-3:BRT]</DTPOSTED>
<TRNAMT>-25.04</TRNAMT>
<FITID>11111111-aaaa-4aaa-8aaa-111111111111</FITID>
<MEMO>Transferência enviada pelo Pix - EMPRESA EXEMPLO</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260905</DTPOSTED>
<TRNAMT>6000.00</TRNAMT>
<FITID>22222222-bbbb-4bbb-8bbb-222222222222</FITID>
<CHECKNUM>348</CHECKNUM>
<MEMO>Transferência recebida pelo Pix - CLIENTE EXEMPLO</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260910</DTPOSTED>
<TRNAMT>-3958.01</TRNAMT>
<FITID>33333333-cccc-4ccc-8ccc-333333333333</FITID>
<MEMO>Pagamento de fatura</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const FATURA = `${CABECALHO}
<OFX>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CURDEF>BRL</CURDEF>
<CCACCTFROM><ACCTID>0000000000000000</ACCTID></CCACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260923000000[-3:BRT]</DTPOSTED>
<TRNAMT>-19.90</TRNAMT>
<FITID>44444444-dddd-4ddd-8ddd-444444444444</FITID>
<MEMO>Assinatura Exemplo</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260904000000[-3:BRT]</DTPOSTED>
<TRNAMT>1500.00</TRNAMT>
<FITID>55555555-eeee-4eee-8eee-555555555555</FITID>
<MEMO>Pagamento recebido</MEMO>
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

/** Dialeto SGML sem fechamento de tag, que a especificacao permite. */
const SEM_FECHAMENTO = `${CABECALHO}
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260902
<TRNAMT>-10.50
<FITID>66666666-ffff-4fff-8fff-666666666666
<MEMO>Padaria Exemplo
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe('ehOfx', () => {
  it('reconhece pelo cabecalho', () => {
    expect(ehOfx(CONTA)).toBe(true);
  });

  it('nao confunde CSV com OFX', () => {
    expect(ehOfx('date,title,amount\n2026-06-02,Padaria,"61,05"')).toBe(false);
  });
});

describe('lerOfx — extrato de conta', () => {
  const leitura = lerOfx(CONTA);

  it('sabe que nao e cartao pela estrutura do arquivo', () => {
    expect(leitura.fonte).toBe('ofx-conta');
    expect(leitura.ehCartao).toBe(false);
  });

  it('le data com hora e fuso, descartando os dois', () => {
    // O carimbo ja vem na hora local do banco: a compra do dia 2 e do dia 2.
    expect(leitura.lancamentos[0]?.data).toBe('2026-09-02');
  });

  it('le data sem hora', () => {
    expect(leitura.lancamentos[1]?.data).toBe('2026-09-05');
  });

  it('usa o sinal como convencao: negativo e saida', () => {
    expect(leitura.lancamentos[0]).toMatchObject({ tipo: 'despesa', valorCentavos: 2504 });
    expect(leitura.lancamentos[1]).toMatchObject({ tipo: 'receita', valorCentavos: 600000 });
  });

  it('guarda o FITID, que e identidade dada pelo banco', () => {
    expect(leitura.lancamentos[0]?.identificadorBanco).toBe('11111111-aaaa-4aaa-8aaa-111111111111');
  });

  it('reconhece o pagamento de fatura como transferencia', () => {
    expect(leitura.lancamentos[2]?.natureza).toBe('transferencia');
  });

  it('nao recusa nenhuma linha de um arquivo bem formado', () => {
    expect(leitura.erros).toHaveLength(0);
    expect(leitura.lancamentos).toHaveLength(3);
  });
});

describe('lerOfx — fatura de cartao', () => {
  const leitura = lerOfx(FATURA);

  it('sabe que e cartao sem ninguem precisar dizer', () => {
    expect(leitura.fonte).toBe('ofx-cartao');
    expect(leitura.ehCartao).toBe(true);
  });

  it('no OFX a compra do cartao e negativa, ao contrario do CSV do mesmo banco', () => {
    expect(leitura.lancamentos[0]).toMatchObject({ tipo: 'despesa', valorCentavos: 1990 });
  });

  it('o pagamento recebido continua sendo transferencia, nao receita', () => {
    expect(leitura.lancamentos[1]?.natureza).toBe('transferencia');
  });
});

describe('lerOfx — tolerancia ao dialeto', () => {
  it('le tag sem fechamento, que o SGML permite', () => {
    const leitura = lerOfx(SEM_FECHAMENTO);
    expect(leitura.lancamentos).toHaveLength(1);
    expect(leitura.lancamentos[0]).toMatchObject({
      data: '2026-09-02',
      valorCentavos: 1050,
      tipo: 'despesa',
      descricaoOriginal: 'Padaria Exemplo',
    });
  });

  it('avisa quando o arquivo e OFX mas nao tem transacao', () => {
    expect(() => lerOfx(`${CABECALHO}\n<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>`)).toThrow(
      /nenhuma transacao/,
    );
  });
});

describe('lerArquivo despacha OFX sozinho', () => {
  it('nao tenta ler OFX como CSV', () => {
    expect(lerArquivo(CONTA).fonte).toBe('ofx-conta');
    expect(lerArquivo(FATURA).ehCartao).toBe(true);
  });
});
