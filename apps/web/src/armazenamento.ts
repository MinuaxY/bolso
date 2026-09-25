/**
 * Armazenamento local, no IndexedDB do proprio navegador.
 *
 * Nenhum dado sai daqui. Nao ha requisicao de rede em lugar nenhum do app —
 * a politica de seguranca declara `connect-src 'none'`, entao o navegador
 * bloquearia mesmo se houvesse.
 *
 * Escrito a mao em vez de trazer uma biblioteca de IndexedDB: o que
 * precisamos sao duas colecoes e quatro operacoes, e cada dependencia num app
 * que guarda extrato bancario custa risco de cadeia de suprimento.
 */

import type { Anexo, AtividadeMei, Lancamento, Meta, RegraCategorizacao } from '@bolso/core';

import { cofreAberto } from './cofre.js';
import type { Cofre } from './cofre.js';

const BANCO = 'bolso';
const VERSAO = 1;
const LANCAMENTOS = 'lancamentos';
const AJUSTES = 'ajustes';

/** Como a empresa da pessoa e tributada. Vazio quando ela nao tem CNPJ. */
export interface AjustesFiscais {
  readonly regime: 'nenhum' | 'simples' | 'mei';
  /** Atividade escolhida na lista. `null` quando a pessoa preferiu o anexo na mao. */
  readonly atividadeId: string | null;
  readonly anexo: Anexo;
  /** Atividades sujeitas ao Fator R trocam de anexo conforme a folha. */
  readonly sujeitoAoFatorR: boolean;
  readonly folha12Centavos: number;
  /** Retirada mensal do socio, base do INSS e do IRRF em DARF. */
  readonly proLaboreCentavos: number;
  readonly atividadeMei: AtividadeMei;
  /**
   * Aliquota efetiva informada a mao, em pontos-base (8,08% e 808). Existe
   * para quem sabe a propria aliquota — ela sai no extrato do PGDAS — e nao
   * quer depender da nossa leitura do anexo. `null` usa a conta do Bolso.
   */
  readonly aliquotaManualBase: number | null;
  /**
   * Faturamento e RBT12 digitados a mao, por competencia. Guardados por mes
   * porque sao valores de um mes especifico — um numero so estaria errado em
   * todos os outros.
   */
  readonly faturamentoPorMes: Readonly<Record<string, number>>;
  readonly rbt12PorMes: Readonly<Record<string, number>>;
}

export interface Ajustes {
  /** Dia em que a fatura do cartao fecha. O VBA de origem fixava em 5. */
  readonly diaFechamento: number;
  /** Regras do usuario. Vazio significa usar as de fabrica. */
  readonly regrasProprias: readonly RegraCategorizacao[];
  readonly fiscal: AjustesFiscais;
  /** Teto mensal por categoria. Vazio significa que a pessoa nao usa metas. */
  readonly metas: readonly Meta[];
}

export const FISCAL_INICIAL: AjustesFiscais = {
  regime: 'nenhum',
  atividadeId: null,
  anexo: 'III',
  sujeitoAoFatorR: true,
  folha12Centavos: 0,
  proLaboreCentavos: 0,
  atividadeMei: 'servicos',
  aliquotaManualBase: null,
  faturamentoPorMes: {},
  rbt12PorMes: {},
};

export const AJUSTES_INICIAIS: Ajustes = {
  diaFechamento: 5,
  regrasProprias: [],
  fiscal: FISCAL_INICIAL,
  metas: [],
};

/**
 * O ponto onde a cifragem vai entrar.
 *
 * Hoje e identidade. Quando o cofre com senha existir, e aqui que o dado
 * passa a ser cifrado antes de tocar o disco — sem migrar formato de
 * armazenamento, que e o tipo de mudanca que quebra app de financas.
 */
let cofre: Cofre = cofreAberto;

export function usarCofre(novo: Cofre): void {
  cofre = novo;
}

function promessa<T>(requisicao: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    requisicao.onsuccess = () => {
      resolver(requisicao.result);
    };
    requisicao.onerror = () => {
      rejeitar(requisicao.error ?? new Error('Falha no armazenamento local.'));
    };
  });
}

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  conexao ??= new Promise((resolver, rejeitar) => {
    if (typeof indexedDB === 'undefined') {
      rejeitar(
        new Error(
          'Este navegador nao oferece armazenamento local. ' +
            'Em janela anonima, alguns navegadores desligam o IndexedDB.',
        ),
      );
      return;
    }

    const requisicao = indexedDB.open(BANCO, VERSAO);

    requisicao.onupgradeneeded = () => {
      const bd = requisicao.result;
      if (!bd.objectStoreNames.contains(LANCAMENTOS)) {
        const colecao = bd.createObjectStore(LANCAMENTOS, { keyPath: 'id' });
        colecao.createIndex('competencia', 'competencia', { unique: false });
      }
      if (!bd.objectStoreNames.contains(AJUSTES)) {
        bd.createObjectStore(AJUSTES, { keyPath: 'chave' });
      }
    };

    requisicao.onsuccess = () => {
      resolver(requisicao.result);
    };
    requisicao.onerror = () => {
      rejeitar(requisicao.error ?? new Error('Nao consegui abrir o armazenamento local.'));
    };
  });

  return conexao;
}

async function transacao<T>(
  colecao: string,
  modo: IDBTransactionMode,
  acao: (loja: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const bd = await abrir();
  const tx = bd.transaction(colecao, modo);
  const resultado = await acao(tx.objectStore(colecao));

  await new Promise<void>((resolver, rejeitar) => {
    tx.oncomplete = () => {
      resolver();
    };
    tx.onerror = () => {
      rejeitar(tx.error ?? new Error('Transacao falhou.'));
    };
    tx.onabort = () => {
      rejeitar(tx.error ?? new Error('Transacao cancelada.'));
    };
  });

  return resultado;
}

/**
 * Pede ao navegador para nao descartar os dados sob pressao de espaco.
 *
 * Sem isto, o navegador pode limpar o armazenamento de um site que ele
 * considera descartavel — e perder o historico financeiro de alguem calado
 * seria imperdoavel. Falhar aqui nao e erro: alguns navegadores so concedem
 * depois que o site vira favorito.
 */
export async function pedirPersistencia(): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function carregarLancamentos(): Promise<Lancamento[]> {
  const brutos = await transacao(LANCAMENTOS, 'readonly', (loja) =>
    promessa(loja.getAll() as IDBRequest<unknown[]>),
  );
  const revelados = await Promise.all(brutos.map((bruto) => cofre.revelar(bruto)));
  return revelados as Lancamento[];
}

export async function gravarLancamentos(lancamentos: readonly Lancamento[]): Promise<void> {
  const protegidos = await Promise.all(lancamentos.map((l) => cofre.proteger(l)));
  await transacao(LANCAMENTOS, 'readwrite', async (loja) => {
    for (const protegido of protegidos) loja.put(protegido);
    return Promise.resolve();
  });
}

export async function removerLancamento(id: string): Promise<void> {
  await transacao(LANCAMENTOS, 'readwrite', async (loja) => {
    loja.delete(id);
    return Promise.resolve();
  });
}

export async function carregarAjustes(): Promise<Ajustes> {
  const bruto = await transacao(AJUSTES, 'readonly', (loja) =>
    promessa(loja.get('ajustes') as IDBRequest<{ chave: string; valor: Ajustes } | undefined>),
  );
  // Quem ja usava o Bolso antes do modulo fiscal tem ajustes sem esse bloco.
  // Completar na leitura evita migracao de dado gravado no navegador.
  const guardados = bruto?.valor;
  if (guardados === undefined) return AJUSTES_INICIAIS;

  return { ...AJUSTES_INICIAIS, ...guardados, fiscal: { ...FISCAL_INICIAL, ...guardados.fiscal } };
}

export async function gravarAjustes(ajustes: Ajustes): Promise<void> {
  await transacao(AJUSTES, 'readwrite', async (loja) => {
    loja.put({ chave: 'ajustes', valor: ajustes });
    return Promise.resolve();
  });
}

/** Apaga tudo. Sem confirmacao aqui: quem confirma e a tela. */
export async function apagarTudo(): Promise<void> {
  await transacao(LANCAMENTOS, 'readwrite', async (loja) => {
    loja.clear();
    return Promise.resolve();
  });
  await transacao(AJUSTES, 'readwrite', async (loja) => {
    loja.clear();
    return Promise.resolve();
  });
}
