import { categoriasDe, normalizar } from '@bolso/core';
import type { Lancamento, RegraCategorizacao } from '@bolso/core';
import { useMemo, useState } from 'react';

import { dataCompleta, formatarCentavos, plural } from '../formato.js';

/** Chuta uma palavra-chave a partir da descricao do banco. */
function chutarPalavraChave(descricao: string): string {
  const limpa = normalizar(descricao).replace(/[*]/g, ' ');
  const palavras = limpa.split(' ').filter((palavra) => palavra.length >= 3 && !/^\d+$/.test(palavra));
  return palavras.slice(0, 2).join(' ') || limpa.slice(0, 12);
}

function LinhaRevisao({
  lancamento,
  categorias,
  aoAtualizar,
  aoCriarRegra,
}: {
  lancamento: Lancamento;
  categorias: readonly string[];
  aoAtualizar: (lancamento: Lancamento) => Promise<void>;
  aoCriarRegra: (regra: RegraCategorizacao) => Promise<void>;
}) {
  const original = lancamento.origem?.descricaoOriginal ?? lancamento.descricao;
  const [categoria, setCategoria] = useState(lancamento.categoria);
  const [palavraChave, setPalavraChave] = useState(() => chutarPalavraChave(original));

  return (
    <li className="revisao-item">
      <div className="revisao-cabeca">
        <div>
          <strong>{original}</strong>
          <span className="revisao-meta">
            {dataCompleta(lancamento.data)} · {formatarCentavos(lancamento.valorCentavos)} ·{' '}
            {lancamento.motivoRevisao === 'sem-regra'
              ? 'nenhuma regra reconheceu'
              : 'a regra pediu conferência'}
          </span>
        </div>
        <select
          value={categoria}
          onChange={(evento) => {
            setCategoria(evento.target.value);
          }}
        >
          {!categorias.includes(categoria) && <option value={categoria}>{categoria}</option>}
          {categorias.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="revisao-acoes">
        <button
          type="button"
          onClick={() => {
            void aoAtualizar({ ...lancamento, categoria, precisaRevisao: false });
          }}
        >
          Só este
        </button>

        <div className="revisao-regra">
          <label>
            Sempre que a descrição contiver
            <input
              type="text"
              value={palavraChave}
              onChange={(evento) => {
                setPalavraChave(evento.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="principal"
            disabled={palavraChave.trim().length === 0}
            onClick={() => {
              void (async () => {
                await aoCriarRegra({
                  palavraChave: palavraChave.trim(),
                  aplicaEm: lancamento.tipo,
                  categoria,
                });
                await aoAtualizar({ ...lancamento, categoria, precisaRevisao: false });
              })();
            }}
          >
            Criar regra
          </button>
        </div>
      </div>
    </li>
  );
}

export function Revisao({
  lancamentos,
  regras,
  aoAtualizar,
  aoCriarRegra,
}: {
  lancamentos: readonly Lancamento[];
  regras: readonly RegraCategorizacao[];
  aoAtualizar: (lancamento: Lancamento) => Promise<void>;
  aoCriarRegra: (regra: RegraCategorizacao) => Promise<void>;
}) {
  const pendentes = useMemo(
    () =>
      lancamentos
        .filter((l) => l.precisaRevisao === true)
        .toSorted((a, b) => b.data.localeCompare(a.data)),
    [lancamentos],
  );

  const categorias = useMemo(
    () =>
      [
        ...new Set([...categoriasDe(regras, 'despesa'), ...categoriasDe(regras, 'receita')]),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [regras],
  );

  if (pendentes.length === 0) {
    return (
      <section className="cartao">
        <h2>Fila de revisão</h2>
        <p className="vazio">
          Nada esperando. Todo lançamento importado casou com alguma regra e nenhuma delas pediu
          conferência.
        </p>
      </section>
    );
  }

  return (
    <section className="cartao">
      <h2>Fila de revisão</h2>
      <p className="nota">
        {plural(pendentes.length, 'lançamento precisa', 'lançamentos precisam')} de um olhar. Criar
        uma regra resolve todos os próximos iguais — a regra vale da próxima importação em diante.
      </p>
      <ul className="revisao">
        {pendentes.map((lancamento) => (
          <LinhaRevisao
            key={lancamento.id}
            lancamento={lancamento}
            categorias={categorias}
            aoAtualizar={aoAtualizar}
            aoCriarRegra={aoCriarRegra}
          />
        ))}
      </ul>
    </section>
  );
}
