/**
 * As regras de categorizacao que vem de fabrica.
 *
 * Sao as 124 regras da planilha de origem, na ordem original — e a ordem e
 * parte da regra, nao apresentacao. Ver `docs/convencoes.md`.
 *
 * O mesmo validador serve para regra que a pessoa importar depois: e a porta
 * de entrada de dado que nao veio daqui.
 */

import dadosPadrao from '../dados/regras-padrao.json';
import type { RegraCategorizacao, StatusDespesa, StatusReceita, TipoLancamento } from './tipos.js';

const TIPOS: readonly TipoLancamento[] = ['despesa', 'receita'];
const STATUS: readonly (StatusDespesa | StatusReceita)[] = ['pago', 'pendente', 'recebido'];

function ehTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * Valida uma lista de regras vinda de fora e devolve a lista tipada.
 *
 * Falha alto, apontando o indice e o campo: uma regra silenciosamente
 * ignorada faria a categorizacao errar sem ninguem entender por que.
 */
export function validarRegras(dados: unknown): RegraCategorizacao[] {
  if (!Array.isArray(dados)) {
    throw new TypeError('Regras invalidas: esperado um array.');
  }

  return dados.map((bruta: unknown, indice) => {
    const onde = `Regra ${String(indice + 1)}`;

    if (typeof bruta !== 'object' || bruta === null) {
      throw new TypeError(`${onde}: esperado um objeto.`);
    }
    const r = bruta as Record<string, unknown>;

    if (!ehTexto(r['palavraChave'])) {
      throw new TypeError(`${onde}: "palavraChave" e obrigatoria e nao pode ser vazia.`);
    }
    if (!ehTexto(r['categoria'])) {
      throw new TypeError(`${onde} (${r['palavraChave']}): "categoria" e obrigatoria.`);
    }
    if (!TIPOS.includes(r['aplicaEm'] as TipoLancamento)) {
      throw new TypeError(
        `${onde} (${r['palavraChave']}): "aplicaEm" deve ser "despesa" ou "receita", nao ${JSON.stringify(r['aplicaEm'])}.`,
      );
    }
    if (r['status'] !== undefined && !STATUS.includes(r['status'] as StatusDespesa)) {
      throw new TypeError(
        `${onde} (${r['palavraChave']}): "status" deve ser um de ${STATUS.join(', ')}.`,
      );
    }

    const regra: RegraCategorizacao = {
      palavraChave: r['palavraChave'],
      aplicaEm: r['aplicaEm'] as TipoLancamento,
      categoria: r['categoria'],
      ...(ehTexto(r['descricaoPadrao']) ? { descricaoPadrao: r['descricaoPadrao'] } : {}),
      ...(ehTexto(r['formaPagamento']) ? { formaPagamento: r['formaPagamento'] } : {}),
      ...(r['status'] !== undefined ? { status: r['status'] as StatusDespesa | StatusReceita } : {}),
    };

    return regra;
  });
}

/** Regras de fabrica, ja validadas no carregamento do modulo. */
export const REGRAS_PADRAO: readonly RegraCategorizacao[] = Object.freeze(
  validarRegras(dadosPadrao),
);

/** Todas as categorias que as regras de fabrica usam, para popular listas. */
export function categoriasDe(
  regras: readonly RegraCategorizacao[],
  tipo: TipoLancamento,
): readonly string[] {
  const vistas = new Set<string>();
  for (const regra of regras) {
    if (regra.aplicaEm === tipo) vistas.add(regra.categoria);
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
