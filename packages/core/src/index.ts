/**
 * Nucleo de dominio do Bolso.
 *
 * Nada aqui sabe que existe navegador, React, armazenamento ou arquivo. E de
 * proposito: e a parte que precisa continuar correta quando tudo em volta
 * mudar, e a unica que da para testar inteira sem abrir uma tela.
 */

export type {
  Categoria,
  Competencia,
  Conta,
  DataCivil,
  Despesa,
  FormaPagamento,
  Lancamento,
  MotivoRevisao,
  OrigemLancamento,
  Parcela,
  Receita,
  RegraCategorizacao,
  StatusDespesa,
  StatusReceita,
  TipoLancamento,
} from './tipos.js';

export {
  competenciaDaData,
  competenciaDe,
  ehDataCivil,
  partesDaCompetencia,
  partesDe,
  somarMeses,
} from './data.js';
export type { PartesData } from './data.js';

export { corrigirMojibake, normalizar } from './texto.js';

export {
  descricaoSemParcela,
  detectarParcela,
  parcelasRestantes,
  valorRestanteCentavos,
} from './parcelas.js';

export {
  CATEGORIA_PADRAO_DESPESA,
  CATEGORIA_PADRAO_RECEITA,
  categorizar,
  encontrarRegra,
} from './categorizacao.js';
export type { ResultadoCategorizacao } from './categorizacao.js';

export { competenciaDaCompra, competenciaDeDebito } from './fatura.js';

export { chaveDeDuplicacao, classificarImportacao } from './deduplicacao.js';
export type { ItemDeduplicavel, ResultadoImportacao } from './deduplicacao.js';

export { REGRAS_PADRAO, categoriasDe, validarRegras } from './regras.js';

export { classificarNatureza } from './natureza.js';
export type { Natureza } from './natureza.js';

export {
  competenciasDisponiveis,
  comprasParceladas,
  comprometimentoFuturo,
  evolucaoMensal,
  resumirMes,
} from './relatorios.js';
export type {
  CompraParcelada,
  CompromissoFuturo,
  LinhaAgrupada,
  PontoMensal,
  ResumoMes,
} from './relatorios.js';

export {
  TABELA_SIMPLES,
  anexoPorFatorR,
  calcularDas,
  calcularDasMei,
  calcularFatorRBase,
  compararDas,
  dasPorAliquota,
  faixaDe,
  rbt12Proporcional,
} from './simples.js';
export type {
  Anexo,
  AtividadeMei,
  AvisoSimples,
  Comparacao,
  EntradaDas,
  FaixaSimples,
  ResultadoDas,
  TabelaSimples,
  Veredito,
} from './simples.js';

export { ATIVIDADES, AVISO_ATIVIDADES, atividadePorCnae, buscarAtividades } from './atividades.js';
export type { Atividade } from './atividades.js';

export {
  TABELA_PESSOA_FISICA,
  calcularInssProLabore,
  calcularProLabore,
  calcularRedutor,
} from './prolabore.js';
export type {
  AvisoProLabore,
  EntradaProLabore,
  FaixaIrrf,
  ResultadoProLabore,
} from './prolabore.js';
