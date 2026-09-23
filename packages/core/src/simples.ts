/**
 * Conferencia do Simples Nacional.
 *
 * O Bolso nao calcula o seu imposto: ele refaz a conta para voce comparar com
 * o que o contador cobrou. A diferenca entre as duas coisas e importante e
 * esta escrita em toda tela deste modulo.
 *
 * TRES DECISOES QUE ATRAVESSAM O ARQUIVO
 *
 * 1. A TABELA E DADO, NAO CODIGO. Faixas, aliquotas e parcelas a deduzir vivem
 *    em `dados/simples-nacional-<ano>.json`, com o ano de vigencia declarado.
 *    Atualizar para 2027 e acrescentar um arquivo e um teste, nunca cacar
 *    numero solto no meio da logica.
 *
 * 2. A ARITMETICA E INTEIRA. O calculo usa `BigInt` do comeco ao fim e
 *    arredonda uma unica vez, no fim. Imposto conferido contra guia emitida
 *    pela Receita precisa bater centavo a centavo; ponto flutuante erraria o
 *    ultimo digito em alguns casos, e um centavo de diferenca destroi a
 *    confianca na ferramenta inteira.
 *
 * 3. QUANDO NAO DA PARA AFIRMAR, AVISA. Empresa acima do sublimite, sem
 *    historico de 12 meses ou fora do teto do regime recebe aviso explicito em
 *    vez de um numero com ar de certeza.
 */

import tabela2026 from '../dados/simples-nacional-2026.json';

/** Os cinco anexos da Lei Complementar 123/2006. */
export type Anexo = 'I' | 'II' | 'III' | 'IV' | 'V';

export interface FaixaSimples {
  /** Teto da faixa, em centavos. */
  readonly ate: number;
  /** Aliquota nominal em pontos-base de percentual: 7,30% e 730. */
  readonly aliquotaBase: number;
  readonly deduzirCentavos: number;
}

export interface TabelaSimples {
  readonly anoVigencia: number;
  readonly fundamento: string;
  readonly conferidoEm: string;
  readonly limiteAnualCentavos: number;
  readonly sublimiteCentavos: number;
  readonly fatorRMinimoBase: number;
  readonly anexos: Readonly<Record<Anexo, { readonly nome: string; readonly faixas: readonly FaixaSimples[] }>>;
  readonly mei: {
    readonly salarioMinimoCentavos: number;
    readonly limiteAnualCentavos: number;
    readonly inssBase: number;
    readonly icmsCentavos: number;
    readonly issCentavos: number;
  };
}

export const TABELA_SIMPLES = tabela2026 as TabelaSimples;

export type AvisoSimples =
  /** Receita passou do teto do regime: a empresa sai do Simples. */
  | 'acima-do-teto'
  /** Acima do sublimite: ICMS e ISS saem do DAS e sao recolhidos a parte. */
  | 'acima-do-sublimite'
  /** RBT12 estimado por proporcionalidade, porque a empresa tem menos de 12 meses. */
  | 'rbt12-proporcional'
  /** Primeira faixa com RBT12 zerado: sem historico nao ha o que conferir. */
  | 'sem-historico';

export interface EntradaDas {
  /** Faturamento do mes que esta sendo calculado, em centavos. */
  readonly receitaMesCentavos: number;
  /** Receita bruta dos 12 meses anteriores, em centavos. */
  readonly rbt12Centavos: number;
  readonly anexo: Anexo;
  /** Verdadeiro quando o RBT12 veio de estimativa, e nao de 12 meses cheios. */
  readonly rbt12Estimado?: boolean;
}

export interface ResultadoDas {
  readonly anexo: Anexo;
  readonly nomeDoAnexo: string;
  /** Faixa de 1 a 6. */
  readonly faixa: number;
  readonly aliquotaNominalPercentual: number;
  readonly deduzirCentavos: number;
  /** Aliquota efetiva, que e a que realmente incide sobre o mes. */
  readonly aliquotaEfetivaPercentual: number;
  readonly dasCentavos: number;
  readonly avisos: readonly AvisoSimples[];
}

function exigirPositivo(valor: number, nome: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser um inteiro de centavos maior ou igual a zero.`);
  }
}

/** Em que faixa da tabela um RBT12 cai. A ultima faixa absorve o que passar. */
export function faixaDe(rbt12Centavos: number, anexo: Anexo): { indice: number; faixa: FaixaSimples } {
  const faixas = TABELA_SIMPLES.anexos[anexo].faixas;

  for (const [indice, faixa] of faixas.entries()) {
    if (rbt12Centavos <= faixa.ate) return { indice: indice + 1, faixa };
  }

  const ultima = faixas[faixas.length - 1] as FaixaSimples;
  return { indice: faixas.length, faixa: ultima };
}

/**
 * Arredonda uma divisao de inteiros para o centavo mais proximo, meio para
 * cima — a mesma regra que a Receita usa na guia.
 */
function dividirArredondando(numerador: bigint, denominador: bigint): number {
  if (denominador === 0n) return 0;
  const dobro = 2n * numerador + denominador;
  return Number(dobro / (2n * denominador));
}

/**
 * Calcula o DAS do mes.
 *
 *     aliquota efetiva = (RBT12 x aliquota nominal - parcela a deduzir) / RBT12
 *     DAS do mes       = receita do mes x aliquota efetiva
 */
export function calcularDas(entrada: EntradaDas): ResultadoDas {
  exigirPositivo(entrada.receitaMesCentavos, 'Receita do mes');
  exigirPositivo(entrada.rbt12Centavos, 'RBT12');

  const avisos: AvisoSimples[] = [];
  const { indice, faixa } = faixaDe(entrada.rbt12Centavos, entrada.anexo);

  if (entrada.rbt12Centavos === 0) {
    avisos.push('sem-historico');
  }
  if (entrada.rbt12Estimado === true) {
    avisos.push('rbt12-proporcional');
  }
  if (entrada.rbt12Centavos > TABELA_SIMPLES.limiteAnualCentavos) {
    avisos.push('acima-do-teto');
  } else if (entrada.rbt12Centavos > TABELA_SIMPLES.sublimiteCentavos) {
    avisos.push('acima-do-sublimite');
  }

  // Com RBT12 zero nao existe aliquota efetiva: a primeira faixa vale cheia.
  const rbt12 = BigInt(entrada.rbt12Centavos);
  const base = BigInt(faixa.aliquotaBase);
  const deduzir = BigInt(faixa.deduzirCentavos);
  const receita = BigInt(entrada.receitaMesCentavos);

  const efetivaNumerador = entrada.rbt12Centavos === 0 ? base : rbt12 * base - deduzir * 10000n;
  const efetivaDenominador = entrada.rbt12Centavos === 0 ? 1n : rbt12;

  const dasCentavos = dividirArredondando(receita * efetivaNumerador, efetivaDenominador * 10000n);

  return {
    anexo: entrada.anexo,
    nomeDoAnexo: TABELA_SIMPLES.anexos[entrada.anexo].nome,
    faixa: indice,
    aliquotaNominalPercentual: faixa.aliquotaBase / 100,
    deduzirCentavos: faixa.deduzirCentavos,
    aliquotaEfetivaPercentual: Number(efetivaNumerador) / Number(efetivaDenominador) / 100,
    dasCentavos,
    avisos,
  };
}

/**
 * Fator R: quanto da receita do ano virou folha de pagamento.
 *
 * Devolve pontos-base arredondados — 28% e 2800 — para EXIBICAO. Quem decide o
 * anexo e `anexoPorFatorR`, que compara sem arredondar.
 */
export function calcularFatorRBase(folha12Centavos: number, rbt12Centavos: number): number {
  exigirPositivo(folha12Centavos, 'Folha de 12 meses');
  exigirPositivo(rbt12Centavos, 'RBT12');

  if (rbt12Centavos === 0) return 0;

  return dividirArredondando(BigInt(folha12Centavos) * 10000n, BigInt(rbt12Centavos));
}

/**
 * Qual anexo se aplica a um prestador de servico sujeito ao Fator R.
 *
 * Folha igual ou acima de 28% da receita leva para o Anexo III, que e mais
 * barato. Abaixo disso, Anexo V. Vale so para as atividades que a lei sujeita
 * ao Fator R — quem esta no I, II ou IV nao entra nesta conta.
 */
export function anexoPorFatorR(folha12Centavos: number, rbt12Centavos: number): Anexo {
  exigirPositivo(folha12Centavos, 'Folha de 12 meses');
  exigirPositivo(rbt12Centavos, 'RBT12');

  if (rbt12Centavos === 0) return 'V';

  // A comparacao e exata, por multiplicacao cruzada, e NAO usa o Fator R
  // arredondado: um centavo abaixo de 28% arredonda para 28% e mudaria o
  // anexo indevidamente. Arredondar serve para mostrar na tela, nunca para
  // decidir. O teste que cobre isso existe porque a primeira versao errava.
  const folha = BigInt(folha12Centavos) * 10000n;
  const minimo = BigInt(rbt12Centavos) * BigInt(TABELA_SIMPLES.fatorRMinimoBase);

  return folha >= minimo ? 'III' : 'V';
}

/**
 * RBT12 de empresa com menos de doze meses de atividade.
 *
 * A regra nao e somar o que existe: e a media dos meses ja completos
 * multiplicada por doze. Somar produziria RBT12 baixo demais e imposto menor
 * que o devido — erro que so aparece na fiscalizacao.
 */
export function rbt12Proporcional(receitasMensaisCentavos: readonly number[]): number {
  const meses = receitasMensaisCentavos.length;
  if (meses === 0) return 0;
  if (meses >= 12) {
    return receitasMensaisCentavos.slice(-12).reduce((soma, valor) => soma + valor, 0);
  }

  const soma = receitasMensaisCentavos.reduce((total, valor) => total + valor, 0);
  return dividirArredondando(BigInt(soma) * 12n, BigInt(meses));
}

export type AtividadeMei = 'comercio-industria' | 'servicos' | 'comercio-e-servicos';

/**
 * DAS do MEI, que e valor fixo e nao depende do faturamento.
 *
 * INSS e 5% do salario minimo; ICMS e ISS sao valores fixos que nao mudam com
 * ele. Caminhoneiro tem INSS de 12% e fica fora desta conta.
 */
export function calcularDasMei(atividade: AtividadeMei): number {
  const { salarioMinimoCentavos, inssBase, icmsCentavos, issCentavos } = TABELA_SIMPLES.mei;
  const inss = dividirArredondando(BigInt(salarioMinimoCentavos) * BigInt(inssBase), 10000n);

  switch (atividade) {
    case 'comercio-industria':
      return inss + icmsCentavos;
    case 'servicos':
      return inss + issCentavos;
    case 'comercio-e-servicos':
      return inss + icmsCentavos + issCentavos;
  }
}

export type Veredito = 'confere' | 'cobrou-a-mais' | 'cobrou-a-menos';

export interface Comparacao {
  readonly calculadoCentavos: number;
  readonly cobradoCentavos: number;
  /** Positivo quando cobraram mais do que a conta dá. */
  readonly diferencaCentavos: number;
  readonly diferencaPercentual: number;
  readonly veredito: Veredito;
}

/**
 * Compara o valor calculado com o que foi cobrado.
 *
 * A tolerancia de um centavo existe porque sistemas diferentes arredondam em
 * momentos diferentes do calculo. Divergencia maior que isso merece uma
 * pergunta ao contador — e a pergunta e o produto aqui, nao a acusacao.
 */
export function compararDas(calculadoCentavos: number, cobradoCentavos: number): Comparacao {
  const diferenca = cobradoCentavos - calculadoCentavos;
  const veredito: Veredito =
    Math.abs(diferenca) <= 1 ? 'confere' : diferenca > 0 ? 'cobrou-a-mais' : 'cobrou-a-menos';

  return {
    calculadoCentavos,
    cobradoCentavos,
    diferencaCentavos: diferenca,
    diferencaPercentual: calculadoCentavos === 0 ? 0 : (diferenca / calculadoCentavos) * 100,
    veredito,
  };
}
