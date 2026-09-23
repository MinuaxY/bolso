import { categoriasDe, normalizar } from '@bolso/core';
import type { Competencia, Lancamento, RegraCategorizacao } from '@bolso/core';
import { useMemo, useState } from 'react';

import { dataCompleta, formatarCentavos, plural } from '../formato.js';

export function Extrato({
  lancamentos,
  competencia,
  regras,
  aoAtualizar,
  aoRemover,
}: {
  lancamentos: readonly Lancamento[];
  competencia: Competencia;
  regras: readonly RegraCategorizacao[];
  aoAtualizar: (lancamento: Lancamento) => Promise<void>;
  aoRemover: (id: string) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'despesa' | 'receita'>('todos');

  const categorias = useMemo(
    () => [
      ...new Set([
        ...categoriasDe(regras, 'despesa'),
        ...categoriasDe(regras, 'receita'),
        ...lancamentos.map((l) => l.categoria),
      ]),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [regras, lancamentos],
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return lancamentos
      .filter((l) => l.competencia === competencia)
      .filter((l) => tipo === 'todos' || l.tipo === tipo)
      .filter(
        (l) =>
          termo.length === 0 ||
          normalizar(l.descricao).includes(termo) ||
          normalizar(l.categoria).includes(termo) ||
          normalizar(l.origem?.descricaoOriginal ?? '').includes(termo),
      )
      .toSorted((a, b) => b.data.localeCompare(a.data));
  }, [lancamentos, competencia, tipo, busca]);

  return (
    <section className="cartao">
      <div className="barra-ferramentas">
        <input
          type="search"
          placeholder="Buscar descrição ou categoria"
          value={busca}
          onChange={(evento) => {
            setBusca(evento.target.value);
          }}
        />
        <select
          value={tipo}
          onChange={(evento) => {
            setTipo(evento.target.value as 'todos' | 'despesa' | 'receita');
          }}
        >
          <option value="todos">Tudo</option>
          <option value="despesa">Só despesas</option>
          <option value="receita">Só receitas</option>
        </select>
        <span className="contagem">{plural(visiveis.length, 'lançamento', 'lançamentos')}</span>
      </div>

      {visiveis.length === 0 ? (
        <p className="vazio">Nenhum lançamento aqui. Importe um extrato para começar.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Situação</th>
                <th className="direita">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((lancamento) => (
                <tr key={lancamento.id} className={lancamento.precisaRevisao === true ? 'revisar' : ''}>
                  <td className="num">{dataCompleta(lancamento.data)}</td>
                  <td>
                    <span title={lancamento.origem?.descricaoOriginal ?? lancamento.descricao}>
                      {lancamento.descricao}
                    </span>
                    {lancamento.tipo === 'despesa' && lancamento.parcela !== undefined && (
                      <span className="etiqueta">
                        {lancamento.parcela.atual}/{lancamento.parcela.total}
                      </span>
                    )}
                    {lancamento.natureza !== undefined && (
                      <span className="etiqueta etiqueta-suave">{lancamento.natureza}</span>
                    )}
                  </td>
                  <td>
                    <select
                      value={lancamento.categoria}
                      onChange={(evento) => {
                        void aoAtualizar({
                          ...lancamento,
                          categoria: evento.target.value,
                          precisaRevisao: false,
                        });
                      }}
                    >
                      {!categorias.includes(lancamento.categoria) && (
                        <option value={lancamento.categoria}>{lancamento.categoria}</option>
                      )}
                      {categorias.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={lancamento.status}
                      onChange={(evento) => {
                        const valor = evento.target.value;
                        void aoAtualizar(
                          lancamento.tipo === 'despesa'
                            ? { ...lancamento, status: valor as 'pago' | 'pendente' }
                            : { ...lancamento, status: valor as 'recebido' | 'pendente' },
                        );
                      }}
                    >
                      {lancamento.tipo === 'despesa' ? (
                        <>
                          <option value="pago">Pago</option>
                          <option value="pendente">A pagar</option>
                        </>
                      ) : (
                        <>
                          <option value="recebido">Recebido</option>
                          <option value="pendente">A receber</option>
                        </>
                      )}
                    </select>
                  </td>
                  <td
                    className={`num direita ${lancamento.tipo === 'receita' ? 'tom-positivo' : ''}`}
                  >
                    {formatarCentavos(lancamento.valorCentavos)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="apagar"
                      title="Apagar este lançamento"
                      onClick={() => {
                        void aoRemover(lancamento.id);
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
