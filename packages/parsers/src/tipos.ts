import type { DataCivil, Natureza, TipoLancamento } from '@bolso/core';

/**
 * Uma linha de extrato ja lida e normalizada, antes de virar lancamento.
 *
 * Aqui o dado ainda nao passou por regra de categorizacao: e o arquivo do
 * banco traduzido para o vocabulario do dominio, e nada mais.
 */
export interface LancamentoImportado {
  readonly data: DataCivil;
  /** Sempre positivo e inteiro. O sinal do arquivo virou `tipo`. */
  readonly valorCentavos: number;
  readonly tipo: TipoLancamento;
  readonly descricaoOriginal: string;
  /** Identificador dado pelo banco, quando o arquivo traz um. */
  readonly identificadorBanco?: string;
  /** Estorno ou transferencia entre contas proprias, quando for o caso. */
  readonly natureza?: Natureza;
  /** Linha do arquivo, contando o cabecalho como 1. Serve para apontar erro. */
  readonly linha: number;
}

/** Uma linha que nao deu para ler. Nao interrompe a importacao. */
export interface ErroLinha {
  readonly linha: number;
  readonly conteudo: string;
  readonly motivo: string;
}

export type FormatoData = 'iso' | 'brasileiro';

/**
 * O jeito particular como um arquivo especifico foi escrito.
 *
 * Existe porque o mesmo banco produz formatos diferentes: dos oito extratos de
 * cartao usados para escrever este pacote, tres tinham decimal com virgula
 * entre aspas, tres com ponto, e dois vinham com ponto e virgula como
 * separador e data em DD/MM/AAAA — provavelmente por terem passado pelo Excel
 * em portugues. Assumir formato quebraria em metade dos arquivos.
 */
export interface Dialeto {
  readonly delimitador: string;
  readonly formatoData: FormatoData;
  /** Verdadeiro quando o arquivo escreve decimal com virgula: `61,05`. */
  readonly decimalVirgula: boolean;
}

export type IdFonte = 'nubank-credito' | 'nubank-debito' | 'generico';

/** Resultado de ler um arquivo inteiro. */
export interface Leitura {
  readonly fonte: IdFonte;
  readonly dialeto: Dialeto;
  readonly lancamentos: readonly LancamentoImportado[];
  /** Linhas recusadas, com motivo. Uma linha ruim nao derruba o arquivo. */
  readonly erros: readonly ErroLinha[];
}

/** Qual coluna e o que, para arquivo de banco que o Bolso ainda nao conhece. */
export interface Mapeamento {
  readonly data: number;
  readonly valor: number;
  readonly descricao: number;
  readonly identificador?: number;
  /**
   * Alguns bancos escrevem despesa como positivo (fatura de cartao), outros
   * como negativo (conta corrente). Verdadeiro inverte a leitura do sinal.
   */
  readonly despesaPositiva?: boolean;
}
