import { comprasParceladas, comprometimentoFuturo, resumirMes } from '@bolso/core';
import type { Competencia, Lancamento } from '@bolso/core';
import { useMemo } from 'react';

import { dataCompleta, formatarCentavos, nomeCompetencia, plural } from '../formato.js';

export function Cartao({
  lancamentos,
  competencia,
  diaFechamento,
}: {
  lancamentos: readonly Lancamento[];
  competencia: Competencia;
  diaFechamento: number;
}) {
  const doCartao = useMemo(
    () =>
      lancamentos.filter(
        (l) => l.tipo === 'despesa' && l.formaPagamento === 'Credito' && l.natureza === undefined,
      ),
    [lancamentos],
  );

  const daFatura = useMemo(
    () =>
      doCartao
        .filter((l) => l.competencia === competencia)
        .toSorted((a, b) => b.valorCentavos - a.valorCentavos),
    [doCartao, competencia],
  );

  const resumo = useMemo(() => resumirMes(lancamentos, competencia), [lancamentos, competencia]);
  const parceladas = useMemo(() => comprasParceladas(lancamentos), [lancamentos]);
  const futuro = useMemo(() => comprometimentoFuturo(lancamentos, 12), [lancamentos]);

  const totalFatura = daFatura.reduce((soma, l) => soma + l.valorCentavos, 0);
  const totalRestante = parceladas.reduce((soma, c) => soma + c.valorRestanteCentavos, 0);

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>Fatura de {nomeCompetencia(competencia)}</h2>
        <div className="indicadores">
          <div className="indicador">
            <span className="indicador-rotulo">Total no crédito</span>
            <strong className="indicador-valor num tom-negativo">
              {formatarCentavos(totalFatura)}
            </strong>
            <span className="indicador-detalhe">
              {plural(daFatura.length, 'compra', 'compras')}
            </span>
          </div>
          <div className="indicador">
            <span className="indicador-rotulo">Ainda devo em parcelas</span>
            <strong className="indicador-valor num tom-negativo">
              {formatarCentavos(totalRestante)}
            </strong>
            <span className="indicador-detalhe">
              {plural(parceladas.length, 'compra em aberto', 'compras em aberto')}
            </span>
          </div>
          <div className="indicador">
            <span className="indicador-rotulo">Fecha no dia</span>
            <strong className="indicador-valor num">{diaFechamento}</strong>
            <span className="indicador-detalhe">compra depois disso vai para o mês seguinte</span>
          </div>
        </div>
      </section>

      <section className="cartao">
        <h3>Em que foi o dinheiro do cartão</h3>
        {resumo.porCategoria.length === 0 ? (
          <p className="vazio">Nenhuma compra no crédito neste mês.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="direita">Valor</th>
                </tr>
              </thead>
              <tbody>
                {daFatura.map((lancamento) => (
                  <tr key={lancamento.id}>
                    <td className="num">{dataCompleta(lancamento.data)}</td>
                    <td>
                      {lancamento.descricao}
                      {lancamento.tipo === 'despesa' && lancamento.parcela !== undefined && (
                        <span className="etiqueta">
                          {lancamento.parcela.atual}/{lancamento.parcela.total}
                        </span>
                      )}
                    </td>
                    <td>{lancamento.categoria}</td>
                    <td className="num direita">{formatarCentavos(lancamento.valorCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cartao">
        <h3>Parcelamentos em aberto</h3>
        {parceladas.length === 0 ? (
          <p className="vazio">Nenhuma compra parcelada em aberto. Bom sinal.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th className="direita">Parcela</th>
                  <th className="direita">Faltam</th>
                  <th className="direita">Ainda devo</th>
                  <th>Quita em</th>
                </tr>
              </thead>
              <tbody>
                {parceladas.map((compra) => (
                  <tr key={`${compra.descricao}-${String(compra.total)}`}>
                    <td>{compra.descricao}</td>
                    <td className="num direita">
                      {compra.ultimaParcelaVista}/{compra.total}
                    </td>
                    <td className="num direita">{compra.restantes}</td>
                    <td className="num direita">
                      {formatarCentavos(compra.valorRestanteCentavos)}
                    </td>
                    <td>{nomeCompetencia(compra.quitacaoPrevista)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {futuro.length > 0 && (
        <section className="cartao destaque">
          <h3>O que já está gasto nas próximas faturas</h3>
          <p className="nota">
            Antes de parcelar mais uma coisa, é este o valor que já sai todo mês.
          </p>
          <ul className="futuro">
            {futuro.map((compromisso) => (
              <li key={compromisso.competencia}>
                <span>{nomeCompetencia(compromisso.competencia)}</span>
                <span className="num">{formatarCentavos(compromisso.centavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
