/**
 * Leitor de CSV.
 *
 * Escrito a mao em vez de trazer biblioteca: um app que le extrato bancario
 * paga cada dependencia em risco de cadeia de suprimento, e o que precisamos
 * aqui sao campos entre aspas e delimitador variavel.
 */

const DELIMITADORES_CANDIDATOS = [',', ';', '\t', '|'] as const;

/** Remove a marca de ordem de bytes que o Excel adora deixar no comeco. */
export function removerBom(texto: string): string {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

/**
 * Descobre o delimitador contando ocorrencias fora de aspas na primeira linha.
 *
 * O vencedor e o que aparece mais vezes. Empate em zero cai na virgula, que e
 * o caso mais comum.
 */
export function detectarDelimitador(primeiraLinha: string): string {
  let melhor = ',';
  let maior = 0;

  for (const candidato of DELIMITADORES_CANDIDATOS) {
    let contagem = 0;
    let dentroDeAspas = false;

    for (const caractere of primeiraLinha) {
      if (caractere === '"') dentroDeAspas = !dentroDeAspas;
      else if (caractere === candidato && !dentroDeAspas) contagem++;
    }

    if (contagem > maior) {
      maior = contagem;
      melhor = candidato;
    }
  }

  return melhor;
}

/**
 * Quebra o texto em linhas de campos.
 *
 * Trata aspas duplas, aspas escapadas como `""`, quebra de linha dentro de
 * campo entre aspas, e os tres fins de linha (LF, CRLF, CR).
 */
export function lerCsv(texto: string, delimitador: string): string[][] {
  const conteudo = removerBom(texto);
  const linhas: string[][] = [];
  let campos: string[] = [];
  let campo = '';
  let dentroDeAspas = false;
  let i = 0;

  const fecharCampo = (): void => {
    campos.push(campo);
    campo = '';
  };
  const fecharLinha = (): void => {
    fecharCampo();
    linhas.push(campos);
    campos = [];
  };

  while (i < conteudo.length) {
    const caractere = conteudo[i] as string;

    if (dentroDeAspas) {
      if (caractere === '"') {
        if (conteudo[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentroDeAspas = false;
        i++;
        continue;
      }
      campo += caractere;
      i++;
      continue;
    }

    if (caractere === '"') {
      dentroDeAspas = true;
      i++;
      continue;
    }
    if (caractere === delimitador) {
      fecharCampo();
      i++;
      continue;
    }
    if (caractere === '\r') {
      // CRLF conta como uma quebra so.
      fecharLinha();
      i += conteudo[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (caractere === '\n') {
      fecharLinha();
      i++;
      continue;
    }

    campo += caractere;
    i++;
  }

  // Ultima linha sem quebra no fim do arquivo.
  if (campo.length > 0 || campos.length > 0) fecharLinha();

  // Linha em branco no fim do arquivo nao e dado.
  return linhas.filter((linha) => !(linha.length === 1 && linha[0]?.trim() === ''));
}

/** Compara nome de coluna ignorando acento, caixa e espaco. */
export function chaveDeColuna(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}
