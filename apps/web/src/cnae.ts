/**
 * Descricao oficial de um CNAE.
 *
 * A tabela vem do IBGE — 1.332 subclasses, gravadas por
 * `scripts/atualizar-cnae.mjs` — e viaja dentro do app. O navegador de quem
 * usa nunca consulta o IBGE, nem ninguem: o app declara `connect-src 'none'`.
 * Sao 21 kB comprimidos, carregados sob demanda so quando a tela do DAS abre.
 *
 * Atencao ao limite disto: o IBGE diz o que o codigo SIGNIFICA. Ele nao diz em
 * que anexo do Simples a empresa cai, porque essa classificacao nao existe por
 * codigo — ver `packages/core/src/atividades.ts`.
 */

export type TabelaCnae = Readonly<Record<string, string>>;

let tabela: TabelaCnae | null = null;

/** Carrega a tabela sob demanda. Chamar de novo devolve a que ja esta em memoria. */
export async function carregarCnaes(): Promise<TabelaCnae> {
  tabela ??= (await import('./dados/cnae.json')).default as TabelaCnae;
  return tabela;
}

/** `6201-5/01`, `62.01-5/01` e `6201501` viram `6201501`. */
export function normalizarCnae(bruto: string): string {
  return bruto.replace(/\D/g, '').slice(0, 7);
}

/**
 * Descricao oficial do codigo, se ele existir na tabela do IBGE.
 *
 * Serve para a pessoa confirmar que digitou o codigo certo antes de confiar em
 * qualquer conta feita em cima dele.
 */
export function descricaoDoCnae(bruto: string, tabelaCarregada: TabelaCnae | null): string | null {
  if (tabelaCarregada === null) return null;
  const codigo = normalizarCnae(bruto);
  if (codigo.length !== 7) return null;
  return tabelaCarregada[codigo] ?? null;
}
