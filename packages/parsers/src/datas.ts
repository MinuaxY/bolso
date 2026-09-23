/**
 * Leitura de data vinda de extrato.
 *
 * O mesmo banco entrega `2026-06-02` em alguns arquivos e `03/03/2026` em
 * outros, porque abrir e salvar no Excel em portugues reescreve a coluna. O
 * formato e detectado no arquivo, nunca assumido.
 */

import { ehDataCivil } from '@bolso/core';
import type { DataCivil } from '@bolso/core';

import type { FormatoData } from './tipos.js';

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const BRASILEIRO = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/;

function doisDigitos(valor: string): string {
  return valor.padStart(2, '0');
}

function montar(ano: string, mes: string, dia: string): DataCivil | null {
  let anoCompleto = ano;
  if (ano.length === 2) {
    // Extrato de banco nao tem data do seculo passado: 26 e 2026.
    anoCompleto = `20${ano}`;
  }
  const data = `${anoCompleto}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
  return ehDataCivil(data) ? data : null;
}

/** Le uma data no formato informado. Devolve `null` se nao servir. */
export function analisarData(bruto: string, formato: FormatoData): DataCivil | null {
  const texto = bruto.trim();
  if (texto.length === 0) return null;

  if (formato === 'iso') {
    const achado = ISO.exec(texto);
    if (achado === null) return null;
    return montar(achado[1] as string, achado[2] as string, achado[3] as string);
  }

  const achado = BRASILEIRO.exec(texto);
  if (achado === null) return null;
  return montar(achado[3] as string, achado[2] as string, achado[1] as string);
}

/**
 * Descobre o formato de data do arquivo.
 *
 * Qualquer valor que comece com quatro digitos e um hifen decide por ISO. Do
 * contrario assume o brasileiro, que e o que os bancos daqui entregam — e a
 * ambiguidade entre DD/MM e MM/DD nao tem como ser resolvida por um extrato
 * brasileiro: `05/03` e 5 de marco.
 */
export function detectarFormatoData(amostras: readonly string[]): FormatoData {
  for (const amostra of amostras) {
    if (ISO.test(amostra.trim())) return 'iso';
  }
  return 'brasileiro';
}
