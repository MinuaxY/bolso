/**
 * Leitura de valor monetario vindo de extrato.
 *
 * A conversao e feita por manipulacao de string, nunca por ponto flutuante:
 * `Number('61,05'.replace(',', '.')) * 100` da 6105.000000000001, e arredondar
 * isso mil vezes por importacao e como se perde centavo.
 */

// `\s` em JavaScript ja inclui espaco nao separavel e espaco fino, que e o
// que o exportador do banco costuma deixar entre o simbolo e o numero.
const LIXO = /[R$\s]/g;

/**
 * Le um valor de extrato e devolve centavos, ou `null` se nao for numero.
 *
 * Decide o separador decimal olhando o proprio valor, porque o mesmo banco
 * escreve `61,05`, `25.67` e `1.259,27` em arquivos diferentes:
 *
 * - com virgula E ponto, o ultimo dos dois e o decimal;
 * - com so um deles, e decimal quando sobram uma ou duas casas depois dele, e
 *   separador de milhar quando sobram exatamente tres;
 * - repetido (`1.259.000`), e sempre separador de milhar.
 */
export function analisarValorCentavos(bruto: string): number | null {
  let texto = bruto.replace(LIXO, '');
  if (texto.length === 0) return null;

  // Sinal: aceita `-10`, `10-` e `(10)`, que aparecem dependendo do exportador.
  let negativo = false;
  if (texto.startsWith('(') && texto.endsWith(')')) {
    negativo = true;
    texto = texto.slice(1, -1);
  }
  if (texto.startsWith('-')) {
    negativo = true;
    texto = texto.slice(1);
  } else if (texto.endsWith('-')) {
    negativo = true;
    texto = texto.slice(0, -1);
  }
  if (texto.startsWith('+')) texto = texto.slice(1);

  if (!/^[\d.,]+$/.test(texto)) return null;

  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');
  let posicaoDecimal = -1;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    posicaoDecimal = Math.max(ultimaVirgula, ultimoPonto);
  } else {
    const posicao = Math.max(ultimaVirgula, ultimoPonto);
    if (posicao >= 0) {
      const separador = texto[posicao] as string;
      const repetido = texto.indexOf(separador) !== posicao;
      const casas = texto.length - posicao - 1;
      if (!repetido && casas >= 1 && casas <= 2) posicaoDecimal = posicao;
    }
  }

  const inteiroBruto =
    posicaoDecimal >= 0 ? texto.slice(0, posicaoDecimal) : texto;
  const fracaoBruta = posicaoDecimal >= 0 ? texto.slice(posicaoDecimal + 1) : '';

  const inteiro = inteiroBruto.replace(/[.,]/g, '');
  const fracao = fracaoBruta.replace(/[.,]/g, '');

  if (inteiro.length === 0 && fracao.length === 0) return null;
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao)) return null;

  const centavos = Number(inteiro || '0') * 100 + Number(fracao.padEnd(2, '0').slice(0, 2) || '0');

  if (!Number.isFinite(centavos)) return null;

  return negativo ? -centavos : centavos;
}

/** Descobre se o arquivo escreve decimal com virgula, olhando varios valores. */
export function detectarDecimalVirgula(amostras: readonly string[]): boolean {
  let comVirgula = 0;
  let comPonto = 0;

  for (const amostra of amostras) {
    const texto = amostra.replace(LIXO, '');
    if (/,\d{1,2}$/.test(texto)) comVirgula++;
    else if (/\.\d{1,2}$/.test(texto)) comPonto++;
  }

  return comVirgula > comPonto;
}

/** Formata centavos como moeda brasileira. Usado em previa e em relatorio. */
export function formatarCentavos(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const inteiro = Math.trunc(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, '0');
  const comMilhar = String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sinal}R$ ${comMilhar},${resto}`;
}
