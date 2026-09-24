/**
 * Baixa a tabela de CNAE do IBGE e grava enxuta no app.
 *
 * Roda na maquina de quem mantem o projeto, nao no navegador de quem usa: o
 * app declara `connect-src 'none'` e nao faz requisicao nenhuma. A tabela do
 * IBGE muda de tempos em tempos, entao este script existe para atualizar sem
 * trabalho manual.
 *
 *     node scripts/atualizar-cnae.mjs
 */
import { writeFileSync } from 'node:fs';

const FONTE = 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses';
const DESTINO = new URL('../apps/web/src/dados/cnae.json', import.meta.url);

const resposta = await fetch(FONTE);
if (!resposta.ok) throw new Error(`IBGE respondeu ${String(resposta.status)}`);

const subclasses = await resposta.json();
const enxuto = Object.fromEntries(subclasses.map((s) => [s.id, s.descricao]));

writeFileSync(DESTINO, JSON.stringify(enxuto), 'utf8');
console.log(`${String(Object.keys(enxuto).length)} subclasses gravadas em apps/web/src/dados/cnae.json`);
