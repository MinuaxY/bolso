/**
 * Leitores de extrato bancario.
 *
 * Regra do pacote: nada aqui assume formato. Delimitador, formato de data e
 * separador decimal sao detectados por arquivo, porque o mesmo banco entrega
 * os tres de maneiras diferentes conforme quem exportou e o que abriu o
 * arquivo depois.
 */

export { chaveDeColuna, detectarDelimitador, lerCsv, removerBom } from './csv.js';
export { analisarData, detectarFormatoData } from './datas.js';
export {
  analisarValorCentavos,
  detectarDecimalVirgula,
  formatarCentavos,
} from './dinheiro.js';
export { detectarFonte, lerArquivo, sugerirMapeamento } from './fontes.js';
export type { OpcoesLeitura } from './fontes.js';
export type {
  Dialeto,
  ErroLinha,
  FormatoData,
  IdFonte,
  LancamentoImportado,
  Leitura,
  Mapeamento,
} from './tipos.js';
