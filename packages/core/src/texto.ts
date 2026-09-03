/**
 * Normalizacao de texto para comparar descricao de banco.
 *
 * Traduz `NormalizeText` e `CorrigirCodificacao` do VBA de origem.
 */

/**
 * Deixa o texto comparavel: sem caixa, sem acento e sem espaco sobrando.
 *
 * O VBA fazia isso com uma tabela de 24 caracteres montada a mao com
 * `ChrW()`, porque literais acentuados no `.bas` viravam mojibake na
 * importacao. `normalize('NFD')` cobre todo o Unicode e nao tem esse problema.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primeiro byte de uma sequencia UTF-8 lida como CP1252. */
const MARCADOR_A = 0xc3;
const MARCADOR_B = 0xc2;
/** Faixa dos bytes de continuacao de UTF-8. */
const CONTINUACAO_MIN = 0x80;
const CONTINUACAO_MAX = 0xbf;
/** Caractere de substituicao: se aparecer, a decodificacao falhou. */
const SUBSTITUICAO = String.fromCharCode(0xfffd);

/**
 * Conserta acento quebrado por leitura errada de codificacao.
 *
 * Acontece quando um arquivo em UTF-8 e lido como CP1252: o c-cedilha vira
 * dois caracteres, e uma palavra acentuada chega com lixo no lugar do
 * acento. O extrato do banco vem assim com frequencia, dependendo de quem
 * exportou o arquivo e de quem o abriu antes.
 *
 * O VBA corrigia com uma tabela de substituicao caso a caso, caractere por
 * caractere. Aqui a correcao e a operacao inversa exata: reinterpretar cada
 * caractere como o byte que ele era e decodificar de novo como UTF-8. Se o
 * resultado nao fizer sentido, devolve o texto original - melhor deixar feio
 * do que estragar mais.
 */
export function corrigirMojibake(texto: string): string {
  let temMarcador = false;

  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i);

    // Algum caractere fora de um byte significa que o texto nao veio dessa
    // leitura errada, e reinterpretar seria destrutivo.
    if (codigo > 0xff) return texto;

    if (codigo === MARCADOR_A || codigo === MARCADOR_B) {
      const seguinte = texto.charCodeAt(i + 1);
      if (seguinte >= CONTINUACAO_MIN && seguinte <= CONTINUACAO_MAX) temMarcador = true;
    }
  }

  if (!temMarcador) return texto;

  const bytes = Uint8Array.from(texto, (c) => c.charCodeAt(0));
  const decodificado = new TextDecoder('utf-8').decode(bytes);

  return decodificado.includes(SUBSTITUICAO) ? texto : decodificado;
}
