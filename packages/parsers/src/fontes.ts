/**
 * Reconhecimento de fonte e leitura de arquivo.
 *
 * Os bancos conhecidos nao tem leitor proprio: eles sao um mapeamento de
 * colunas mais uma convencao de sinal, entregues ao mesmo motor que le arquivo
 * desconhecido. Assim o caminho generico — o que a maioria das pessoas vai
 * usar, porque ninguem usa so Nubank — e o mesmo caminho testado com dado real
 * todo dia, em vez de um plano B que ninguem exercita.
 */

import { classificarNatureza } from '@bolso/core';
import type { Parcela } from '@bolso/core';

import { chaveDeColuna, detectarDelimitador, lerCsv, removerBom } from './csv.js';
import { analisarData, detectarFormatoData } from './datas.js';
import { analisarValorCentavos, detectarDecimalVirgula } from './dinheiro.js';
import { ehOfx, lerOfx } from './ofx.js';
import type {
  Dialeto,
  ErroLinha,
  IdFonte,
  LancamentoImportado,
  Leitura,
  Mapeamento,
} from './tipos.js';

interface FonteConhecida {
  readonly id: IdFonte;
  readonly mapeamento: Mapeamento;
  readonly ehCartao: boolean;
  reconhece(colunas: readonly string[]): boolean;
}

const FONTES: readonly FonteConhecida[] = [
  {
    // Fatura do cartao: `date,title,amount`, despesa como positivo.
    id: 'nubank-credito',
    ehCartao: true,
    mapeamento: { data: 0, descricao: 1, valor: 2, despesaPositiva: true },
    reconhece: (colunas) =>
      colunas.length >= 3 &&
      colunas[0] === 'date' &&
      colunas[1] === 'title' &&
      colunas[2] === 'amount',
  },
  {
    // Extrato de conta: `Data,Valor,Identificador,Descricao`, saida negativa.
    id: 'nubank-debito',
    ehCartao: false,
    mapeamento: { data: 0, valor: 1, identificador: 2, descricao: 3, despesaPositiva: false },
    reconhece: (colunas) =>
      colunas.length >= 4 &&
      colunas[0] === 'data' &&
      colunas[1] === 'valor' &&
      colunas[2] === 'identificador' &&
      colunas[3] === 'descricao',
  },
  {
    // Fatura da XP: `Data;Estabelecimento;Portador;Valor;Parcela`, valores
    // escritos como `R$ 22,45` e despesa positiva. A coluna `Portador` diz
    // qual cartao da conta gastou; o Bolso ainda nao usa, e ela carrega nome
    // de pessoa, entao fica de fora ate ter uso claro.
    id: 'xp-fatura',
    ehCartao: true,
    mapeamento: { data: 0, descricao: 1, valor: 3, parcela: 4, despesaPositiva: true },
    reconhece: (colunas) =>
      colunas.length >= 4 && colunas[0] === 'data' && colunas[1] === 'estabelecimento',
  },
];

/**
 * Le a coluna de parcelamento de uma fatura que tem uma.
 *
 * A XP escreve `3 de 10`, e escreve `-` quando a compra e a vista. Quando o
 * formato nao bate, devolve `undefined` em vez de inventar parcela.
 */
function lerColunaParcela(bruto: string): Parcela | undefined {
  const achado = /(\d{1,3})\s*de\s*(\d{1,3})/i.exec(bruto);
  if (achado === null) return undefined;

  const atual = Number(achado[1]);
  const total = Number(achado[2]);
  if (atual < 1 || total < 1 || atual > total) return undefined;

  return { atual, total };
}

const PISTAS: Record<'data' | 'valor' | 'descricao' | 'identificador', readonly RegExp[]> = {
  data: [/^data/, /^date/, /lancamento$/, /^dia$/, /movimenta/],
  valor: [/^valor/, /^amount/, /^quantia/, /^montante/, /^vlr/],
  descricao: [/descri/, /^title/, /historic/, /^memo/, /estabelec/, /^lancamento/, /^detalhe/],
  identificador: [/^identificador/, /^id$/, /documento/, /^doc$/, /transa/],
};

function acharColuna(colunas: readonly string[], pistas: readonly RegExp[]): number {
  for (const pista of pistas) {
    const indice = colunas.findIndex((coluna) => pista.test(coluna));
    if (indice >= 0) return indice;
  }
  return -1;
}

/**
 * Chuta o mapeamento de um arquivo desconhecido pelos nomes das colunas.
 *
 * Devolve `null` quando nao acha data, valor e descricao — nesse caso a pessoa
 * escolhe as colunas na tela, que e melhor do que importar errado calado.
 */
export function sugerirMapeamento(colunas: readonly string[]): Mapeamento | null {
  const normalizadas = colunas.map(chaveDeColuna);
  const data = acharColuna(normalizadas, PISTAS.data);
  const valor = acharColuna(normalizadas, PISTAS.valor);
  const descricao = acharColuna(normalizadas, PISTAS.descricao);

  if (data < 0 || valor < 0 || descricao < 0) return null;

  const identificador = acharColuna(normalizadas, PISTAS.identificador);

  return {
    data,
    valor,
    descricao,
    ...(identificador >= 0 && identificador !== data && identificador !== valor
      ? { identificador }
      : {}),
  };
}

/** Qual banco escreveu este arquivo, se for algum que o Bolso conhece. */
export function detectarFonte(colunas: readonly string[]): IdFonte {
  const normalizadas = colunas.map(chaveDeColuna);
  return FONTES.find((fonte) => fonte.reconhece(normalizadas))?.id ?? 'generico';
}

/**
 * Decide a convencao de sinal de um arquivo desconhecido.
 *
 * Se aparece valor negativo, o arquivo usa negativo para saida — e o padrao de
 * extrato de conta. Se nao aparece nenhum, e fatura de cartao: tudo ali e
 * despesa.
 */
function despesaEhPositiva(valores: readonly number[]): boolean {
  return !valores.some((valor) => valor < 0);
}

function lerLinhas(
  linhas: readonly string[][],
  mapeamento: Mapeamento,
  dialeto: Dialeto,
  despesaPositiva: boolean,
): { lancamentos: LancamentoImportado[]; erros: ErroLinha[] } {
  const lancamentos: LancamentoImportado[] = [];
  const erros: ErroLinha[] = [];

  linhas.forEach((campos, indice) => {
    // +2: a primeira linha do arquivo e o cabecalho, e humano conta do 1.
    const numeroLinha = indice + 2;
    const cru = campos.join(dialeto.delimitador);

    if (campos.every((campo) => campo.trim().length === 0)) return;

    const data = analisarData(campos[mapeamento.data] ?? '', dialeto.formatoData);
    if (data === null) {
      erros.push({ linha: numeroLinha, conteudo: cru, motivo: 'Data ilegivel' });
      return;
    }

    const valor = analisarValorCentavos(campos[mapeamento.valor] ?? '');
    if (valor === null) {
      erros.push({ linha: numeroLinha, conteudo: cru, motivo: 'Valor ilegivel' });
      return;
    }
    if (valor === 0) {
      erros.push({ linha: numeroLinha, conteudo: cru, motivo: 'Valor zerado' });
      return;
    }

    const descricao = (campos[mapeamento.descricao] ?? '').trim();
    if (descricao.length === 0) {
      erros.push({ linha: numeroLinha, conteudo: cru, motivo: 'Descricao vazia' });
      return;
    }

    const natureza = classificarNatureza(descricao);

    // Estorno e despesa com sinal trocado, nunca receita: assim ele abate a
    // categoria que devolveu o dinheiro em vez de inventar renda.
    const ehDespesa =
      natureza === 'estorno' ? true : despesaPositiva ? valor > 0 : valor < 0;

    const identificador =
      mapeamento.identificador === undefined
        ? undefined
        : (campos[mapeamento.identificador] ?? '').trim();

    const parcela =
      mapeamento.parcela === undefined
        ? undefined
        : lerColunaParcela(campos[mapeamento.parcela] ?? '');

    lancamentos.push({
      data,
      valorCentavos: Math.abs(valor),
      tipo: ehDespesa ? 'despesa' : 'receita',
      descricaoOriginal: descricao,
      ...(identificador !== undefined && identificador.length > 0
        ? { identificadorBanco: identificador }
        : {}),
      ...(natureza !== undefined ? { natureza } : {}),
      ...(parcela !== undefined ? { parcela } : {}),
      linha: numeroLinha,
    });
  });

  return { lancamentos, erros };
}

export interface OpcoesLeitura {
  /** Mapeamento escolhido na tela, para arquivo que o Bolso nao reconhece. */
  readonly mapeamento?: Mapeamento;
}

/**
 * Le um arquivo de extrato inteiro.
 *
 * Nunca lanca por causa de conteudo: linha ruim vai para `erros` e o resto
 * importa. Lanca apenas quando o arquivo nao da nem para comecar — sem
 * cabecalho, ou sem como saber que coluna e o que.
 */
export function lerArquivo(texto: string, opcoes: OpcoesLeitura = {}): Leitura {
  const conteudo = removerBom(texto);

  // OFX antes de tudo: e outro formato, nao outro dialeto de CSV.
  if (ehOfx(conteudo)) return lerOfx(conteudo);

  const primeiraQuebra = conteudo.search(/\r|\n/);
  const primeiraLinha = primeiraQuebra < 0 ? conteudo : conteudo.slice(0, primeiraQuebra);

  if (primeiraLinha.trim().length === 0) {
    throw new Error('Arquivo vazio: nao ha nem cabecalho para ler.');
  }

  const delimitador = detectarDelimitador(primeiraLinha);
  const todasAsLinhas = lerCsv(conteudo, delimitador);
  const cabecalho = todasAsLinhas[0] ?? [];
  const corpo = todasAsLinhas.slice(1);

  const fonte = detectarFonte(cabecalho);
  const conhecida = FONTES.find((f) => f.id === fonte);
  const mapeamento = conhecida?.mapeamento ?? opcoes.mapeamento ?? sugerirMapeamento(cabecalho);

  if (mapeamento === null || mapeamento === undefined) {
    throw new Error(
      `Nao reconheci as colunas deste arquivo (${cabecalho.join(', ')}). ` +
        'Escolha qual coluna e a data, qual e o valor e qual e a descricao.',
    );
  }

  const amostrasData = corpo.slice(0, 20).map((linha) => linha[mapeamento.data] ?? '');
  const amostrasValor = corpo.slice(0, 20).map((linha) => linha[mapeamento.valor] ?? '');

  const dialeto: Dialeto = {
    delimitador,
    formatoData: detectarFormatoData(amostrasData),
    decimalVirgula: detectarDecimalVirgula(amostrasValor),
  };

  const despesaPositiva =
    mapeamento.despesaPositiva ??
    despesaEhPositiva(
      corpo
        .map((linha) => analisarValorCentavos(linha[mapeamento.valor] ?? ''))
        .filter((valor): valor is number => valor !== null),
    );

  const { lancamentos, erros } = lerLinhas(corpo, mapeamento, dialeto, despesaPositiva);

  // Arquivo desconhecido: se nao ha valor negativo, o arquivo so tem despesa,
  // que e o jeito de uma fatura. E palpite, e a tela deixa corrigir.
  const ehCartao = conhecida?.ehCartao ?? despesaPositiva;

  return { fonte, ehCartao, dialeto, lancamentos, erros };
}
