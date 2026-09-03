/**
 * Tipos do dominio do Bolso.
 *
 * Duas decisoes atravessam este arquivo inteiro e valem para tudo que vier
 * depois:
 *
 * 1. DINHEIRO E INTEIRO, EM CENTAVOS. Ponto flutuante nao representa 0,10
 *    exatamente, e somar mil lancamentos em `number` decimal produz erro
 *    visivel no total do mes. Todo valor no dominio e `valorCentavos`,
 *    inteiro e sempre positivo — o sinal vem do `tipo` do lancamento.
 *
 * 2. DATA DE COMPRA NAO TEM FUSO. Uma compra do dia 02/06 e do dia 02/06 em
 *    qualquer lugar do mundo. Usar `Date` aqui faria uma compra virar do dia
 *    anterior ao serializar em UTC. Datas civis sao strings `AAAA-MM-DD`.
 */

/** Data civil no formato `AAAA-MM-DD`. Sem hora, sem fuso. */
export type DataCivil = string;

/** Mes de competencia no formato `AAAA-MM`. */
export type Competencia = string;

export type TipoLancamento = 'despesa' | 'receita';

/** Uma despesa esta paga ou ainda vai vencer. */
export type StatusDespesa = 'pago' | 'pendente';

/** Uma receita ja caiu ou ainda vai cair. */
export type StatusReceita = 'recebido' | 'pendente';

/**
 * Categoria, forma de pagamento e conta sao `string` de proposito: sao listas
 * que a pessoa edita. Fechar em union seria decidir pelo usuario que ele nunca
 * vai ter uma categoria que a planilha original nao tinha.
 */
export type Categoria = string;
export type FormaPagamento = string;
export type Conta = string;

/** Compra parcelada: a 3 de 10, por exemplo. */
export interface Parcela {
  readonly atual: number;
  readonly total: number;
}

/** De onde este lancamento veio, para auditoria e para nao importar duas vezes. */
export interface OrigemLancamento {
  /** Identificador que o proprio banco deu a transacao, quando existe. */
  readonly identificadorBanco?: string;
  /** Descricao exatamente como veio do banco, antes de qualquer regra. */
  readonly descricaoOriginal: string;
  /** Nome do arquivo importado, so para a pessoa se localizar. */
  readonly arquivo?: string;
}

/** Por que este lancamento precisa de olho humano. */
export type MotivoRevisao =
  /** Nenhuma regra casou: caiu na categoria padrao. */
  | 'sem-regra'
  /** A regra casou, mas ela mesma se declara ambigua. O caso do "99". */
  | 'regra-ambigua';

interface LancamentoBase {
  readonly id: string;
  readonly data: DataCivil;
  /** Sempre positivo, sempre inteiro. Ver nota no topo do arquivo. */
  readonly valorCentavos: number;
  readonly descricao: string;
  readonly categoria: Categoria;
  readonly observacao?: string;
  readonly origem?: OrigemLancamento;
  readonly precisaRevisao?: boolean;
  readonly motivoRevisao?: MotivoRevisao;
  /**
   * Separa a vida pessoal da empresa. Existe desde a primeira versao, ainda
   * que o modulo fiscal so chegue na sprint 7: incluir o campo agora custa
   * nada e evita migrar dado ja gravado no navegador de quem usa.
   */
  readonly escopo?: 'pessoal' | 'empresa';
}

export interface Despesa extends LancamentoBase {
  readonly tipo: 'despesa';
  readonly status: StatusDespesa;
  readonly formaPagamento: FormaPagamento;
  readonly parcela?: Parcela;
}

export interface Receita extends LancamentoBase {
  readonly tipo: 'receita';
  readonly status: StatusReceita;
  readonly conta: Conta;
}

export type Lancamento = Despesa | Receita;

/**
 * Regra de categorizacao automatica.
 *
 * A ordem do array importa: vale a primeira regra que casar, igual a planilha
 * de origem. E por isso que `99food` precisa vir antes de `99` na lista.
 */
export interface RegraCategorizacao {
  /** Trecho procurado na descricao do banco, ja comparado sem acento e sem caixa. */
  readonly palavraChave: string;
  readonly aplicaEm: TipoLancamento;
  readonly categoria: Categoria;
  /** Nome limpo que substitui a sujeira do extrato. `99food *Jyk Food` vira `99Food`. */
  readonly descricaoPadrao?: string;
  readonly formaPagamento?: FormaPagamento;
  readonly status?: StatusDespesa | StatusReceita;
}
