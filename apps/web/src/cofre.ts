/**
 * O cofre: onde a cifragem em repouso vai entrar.
 *
 * Hoje ele e transparente — grava o que recebe. A interface existe desde
 * agora de proposito: quando a senha chegar, ligar a cifra sera implementar
 * este contrato, e nao migrar o formato de tudo que ja esta gravado no
 * navegador das pessoas. Migracao de dado gravado e o tipo de mudanca que
 * quebra app de financas.
 *
 * Quando existir, o cofre tera uma segunda funcao alem de proteger de quem
 * senta na mesma maquina: como o Bolso divide origem com outros projetos da
 * mesma conta do GitHub Pages, dado cifrado em repouso significa que uma
 * pagina vizinha le texto cifrado. Ver `docs/seguranca.md`, secao 4.
 */

export interface Cofre {
  /** Prepara o dado para ir ao disco. */
  proteger(dado: unknown): Promise<unknown>;
  /** Devolve o dado lido do disco ao formato do dominio. */
  revelar(bruto: unknown): Promise<unknown>;
}

export const cofreAberto: Cofre = {
  proteger: (dado) => Promise.resolve(dado),
  revelar: (bruto) => Promise.resolve(bruto),
};
