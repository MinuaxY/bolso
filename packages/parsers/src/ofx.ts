/**
 * Leitor de OFX.
 *
 * OFX e o formato que os bancos brasileiros exportam quando querem ser lidos
 * por software, e ele resolve tres problemas que o CSV cria:
 *
 * - a data tem formato unico, `AAAAMMDD`, sem ambiguidade entre dia e mes;
 * - o valor sempre usa ponto decimal, sem depender do idioma de quem exportou;
 * - cada transacao traz um `FITID`, identificador que o banco garante unico.
 *   E identidade de verdade: a deduplicacao deixa de depender de heuristica.
 *
 * O arquivo tambem diz se a conta e cartao de credito, pela estrutura: extrato
 * de conta vem em `BANKMSGSRSV1`, fatura vem em `CREDITCARDMSGSRSV1`. Por isso
 * o Bolso nao precisa perguntar.
 *
 * Escrito contra a versao 102 em SGML, que e a que Nubank e XP emitem. O
 * dialeto SGML permite tag sem fechamento (`<TRNAMT>-25.04` numa linha), entao
 * o valor de uma tag termina no proximo `<` ou no fim da linha — nunca assume
 * que existe `</TAG>`.
 */

import { classificarNatureza } from '@bolso/core';
import type { DataCivil } from '@bolso/core';

import { analisarValorCentavos } from './dinheiro.js';
import type { ErroLinha, LancamentoImportado, Leitura } from './tipos.js';

const CABECALHO = /OFXHEADER\s*:\s*\d+/i;
const TRANSACAO = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;

/** Reconhece um arquivo OFX antes de tentar le-lo como CSV. */
export function ehOfx(texto: string): boolean {
  const inicio = texto.slice(0, 2000);
  return CABECALHO.test(inicio) || /<OFX>/i.test(inicio);
}

/**
 * Le o valor de uma tag, com ou sem fechamento.
 *
 * `<TRNAMT>-25.04</TRNAMT>` e `<TRNAMT>-25.04` devolvem a mesma coisa.
 */
function valorDaTag(bloco: string, tag: string): string | undefined {
  const padrao = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const achado = padrao.exec(bloco);
  return achado === null ? undefined : achado[1]?.trim();
}

/**
 * `20260902000000[-3:BRT]` e `20260704` viram `2026-09-02` e `2026-07-04`.
 *
 * A hora e o fuso sao descartados de proposito: o carimbo ja vem na hora
 * local do banco, e uma compra do dia 2 e do dia 2. Ver a nota sobre data
 * civil em `packages/core/src/tipos.ts`.
 */
function dataDoCarimbo(carimbo: string): DataCivil | null {
  const achado = /^(\d{4})(\d{2})(\d{2})/.exec(carimbo.trim());
  if (achado === null) return null;

  const [, ano, mes, dia] = achado;
  const data = `${ano ?? ''}-${mes ?? ''}-${dia ?? ''}`;

  // Validacao minima: o resto e conferido por quem monta o lancamento.
  const mesNumero = Number(mes);
  const diaNumero = Number(dia);
  if (mesNumero < 1 || mesNumero > 12 || diaNumero < 1 || diaNumero > 31) return null;

  return data;
}

/** A fatura de cartao vem numa arvore propria, e o arquivo diz qual e. */
function ehFaturaDeCartao(texto: string): boolean {
  return /<CREDITCARDMSGSRSV1>|<CCSTMTRS>|<CCACCTFROM>/i.test(texto);
}

export function lerOfx(texto: string): Leitura {
  const ehCartao = ehFaturaDeCartao(texto);
  const lancamentos: LancamentoImportado[] = [];
  const erros: ErroLinha[] = [];

  let achado: RegExpExecArray | null;
  let indice = 0;
  TRANSACAO.lastIndex = 0;

  while ((achado = TRANSACAO.exec(texto)) !== null) {
    indice++;
    const bloco = achado[1] ?? '';
    // Em OFX nao ha numero de linha util para a pessoa; a posicao da transacao
    // e o que permite encontrar o registro no arquivo.
    const posicao = indice;

    const carimbo = valorDaTag(bloco, 'DTPOSTED');
    const data = carimbo === undefined ? null : dataDoCarimbo(carimbo);
    if (data === null) {
      erros.push({ linha: posicao, conteudo: bloco.trim().slice(0, 120), motivo: 'Data ilegivel' });
      continue;
    }

    const valorBruto = valorDaTag(bloco, 'TRNAMT');
    const valor = valorBruto === undefined ? null : analisarValorCentavos(valorBruto);
    if (valor === null) {
      erros.push({ linha: posicao, conteudo: bloco.trim().slice(0, 120), motivo: 'Valor ilegivel' });
      continue;
    }
    if (valor === 0) {
      erros.push({ linha: posicao, conteudo: bloco.trim().slice(0, 120), motivo: 'Valor zerado' });
      continue;
    }

    // `MEMO` e o campo usual; alguns bancos so preenchem `NAME`.
    const descricao = (valorDaTag(bloco, 'MEMO') ?? valorDaTag(bloco, 'NAME') ?? '').trim();
    if (descricao.length === 0) {
      erros.push({
        linha: posicao,
        conteudo: bloco.trim().slice(0, 120),
        motivo: 'Descricao vazia',
      });
      continue;
    }

    const natureza = classificarNatureza(descricao);
    const identificador = valorDaTag(bloco, 'FITID');

    // Em OFX o sinal e universal, ao contrario do CSV: saida e negativa tanto
    // no extrato de conta quanto na fatura do cartao.
    const ehDespesa = natureza === 'estorno' ? true : valor < 0;

    lancamentos.push({
      data,
      valorCentavos: Math.abs(valor),
      tipo: ehDespesa ? 'despesa' : 'receita',
      descricaoOriginal: descricao,
      ...(identificador !== undefined && identificador.length > 0
        ? { identificadorBanco: identificador }
        : {}),
      ...(natureza !== undefined ? { natureza } : {}),
      linha: posicao,
    });
  }

  if (lancamentos.length === 0 && erros.length === 0) {
    throw new Error(
      'Este arquivo parece OFX, mas nao tem nenhuma transacao (`STMTTRN`) dentro. ' +
        'Confira se a exportacao cobriu algum periodo com movimento.',
    );
  }

  return {
    fonte: ehCartao ? 'ofx-cartao' : 'ofx-conta',
    ehCartao,
    dialeto: { delimitador: 'OFX', formatoData: 'iso', decimalVirgula: false },
    lancamentos,
    erros,
  };
}
