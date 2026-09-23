/**
 * Leitura do arquivo escolhido pela pessoa, com deteccao de codificacao.
 *
 * Extrato brasileiro chega em UTF-8 ou em Windows-1252, dependendo do banco e
 * de quem abriu o arquivo antes. Ler em UTF-8 um arquivo que nao e UTF-8
 * produz acento quebrado em toda descricao — e descricao quebrada faz a regra
 * de categorizacao errar calada.
 *
 * A deteccao usa o proprio decodificador: com `fatal`, ele recusa byte
 * invalido em vez de devolver caractere de substituicao.
 */

const LIMITE_BYTES = 20 * 1024 * 1024;

export async function lerTextoDoArquivo(arquivo: File): Promise<string> {
  if (arquivo.size > LIMITE_BYTES) {
    throw new Error(
      `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. ` +
        'Extrato de banco nao chega perto disso — confira se e o arquivo certo.',
    );
  }

  const bytes = await arquivo.arrayBuffer();

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Nao e UTF-8 valido: quase sempre Windows-1252, que e o que o Excel
    // brasileiro grava.
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Oferece um arquivo para a pessoa salvar, sem passar por servidor nenhum. */
export function baixar(nome: string, conteudo: string, tipo = 'application/json'): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
